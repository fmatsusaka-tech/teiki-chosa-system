import base64
import binascii
import os
import tempfile
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="PaddleOCR sidecar")
_ocr: Any | None = None


class OcrRequest(BaseModel):
    imageBase64: str
    mimeType: str
    fileName: str | None = None


def get_ocr() -> Any:
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR

        _ocr = PaddleOCR(use_angle_cls=True, lang=os.getenv("PADDLE_OCR_LANG", "japan"), show_log=False)
    return _ocr


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ocr")
def recognize(request: OcrRequest) -> dict[str, Any]:
    if not request.mimeType.startswith("image/"):
        raise HTTPException(status_code=400, detail="mimeType must be an image type")
    try:
        image = base64.b64decode(request.imageBase64, validate=True)
    except (ValueError, binascii.Error) as error:
        raise HTTPException(status_code=400, detail="imageBase64 is invalid") from error
    if not image:
        raise HTTPException(status_code=400, detail="image is empty")

    suffix = Path(request.fileName or "image.png").suffix or ".png"
    started = time.perf_counter()
    image_path: Path | None = None
    try:
        # Windowsでは開いたままのNamedTemporaryFileを別処理から読み取れないため、
        # OCRへ渡す前にファイルを閉じ、処理後に明示的に削除する。
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as image_file:
            image_file.write(image)
            image_path = Path(image_file.name)
        result = get_ocr().ocr(str(image_path), cls=True)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"PaddleOCR failed: {error}") from error
    finally:
        if image_path is not None:
            image_path.unlink(missing_ok=True)

    lines = []
    for page in result or []:
        for item in page or []:
            points, recognition = item
            text, confidence = recognition
            xs = [float(point[0]) for point in points]
            ys = [float(point[1]) for point in points]
            lines.append({
                "text": str(text),
                "confidence": float(confidence) if confidence is not None else None,
                "boundingBox": {
                    "x": min(xs),
                    "y": min(ys),
                    "width": max(xs) - min(xs),
                    "height": max(ys) - min(ys),
                },
            })
    return {
        "lines": lines,
        "elapsedMs": round((time.perf_counter() - started) * 1000, 3),
        "model": "PaddleOCR",
    }
