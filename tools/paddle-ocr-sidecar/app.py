from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from normalizer import normalize_result
from paddleocr import PaddleOCR

DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/bmp", "image/jpeg", "image/png", "image/tiff", "image/webp"}

app = FastAPI(title="teiki-chosa PaddleOCR sidecar")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "PADDLE_OCR_ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_ocr: Any | None = None


def get_ocr() -> Any:
    global _ocr
    if _ocr is None:
        _ocr = PaddleOCR(
            lang=os.getenv("PADDLE_OCR_LANG", "japan"),
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=True,
        )
    return _ocr


def max_image_bytes() -> int:
    raw_value = os.getenv("PADDLE_OCR_MAX_IMAGE_BYTES", str(DEFAULT_MAX_IMAGE_BYTES))
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise RuntimeError("PADDLE_OCR_MAX_IMAGE_BYTES must be a positive integer") from exc
    if value <= 0:
        raise RuntimeError("PADDLE_OCR_MAX_IMAGE_BYTES must be a positive integer")
    return value


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ocr")
async def ocr(image: UploadFile = File(...)) -> dict[str, Any]:
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported image content type")

    image_bytes = await image.read(max_image_bytes() + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image is empty")
    if len(image_bytes) > max_image_bytes():
        raise HTTPException(status_code=413, detail="Image exceeds the configured size limit")

    started_at = time.perf_counter()
    suffix = Path(image.filename or "image").suffix or ".img"
    temporary_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary_file:
            temporary_file.write(image_bytes)
            temporary_path = temporary_file.name
        result = get_ocr().predict(temporary_path)
        lines = normalize_result(result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="PaddleOCR processing failed") from exc
    finally:
        if temporary_path is not None:
            Path(temporary_path).unlink(missing_ok=True)

    return {
        "rawText": "\n".join(line["text"] for line in lines),
        "lines": lines,
        "blocks": lines,
        "warnings": [],
        "metadata": {
            "model": "paddleocr",
            "elapsedMs": round((time.perf_counter() - started_at) * 1000),
        },
    }
