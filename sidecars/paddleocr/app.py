import base64
import binascii
import os
import tempfile
import time
from statistics import median
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
    sourceKind: str | None = None


def enhance_image(image_path: Path) -> Any:
    import cv2

    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError("image could not be decoded")
    grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    # 局所コントラストを整え、薄い鉛筆や罫線入り用紙でも文字を残しやすくする。
    return cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(grayscale)


def prepare_image(image_path: Path, source_kind: str | None) -> Any:
    if source_kind != "handwritten":
        return str(image_path)
    return enhance_image(image_path)


def has_recognized_lines(result: Any) -> bool:
    return any(page for page in (result or []))


def recognition_score(result: Any) -> float:
    score = 0.0
    for page in result or []:
        for item in page or []:
            text, confidence = item[1]
            meaningful = sum(character.isalnum() for character in str(text))
            score += meaningful * (float(confidence) if confidence is not None else 0.5)
    return score


def recognize_handwritten_orientations(ocr: Any, image: Any) -> Any:
    import cv2

    candidates = [
        image,
        cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE),
        cv2.rotate(image, cv2.ROTATE_180),
        cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE),
    ]
    results = [ocr.ocr(candidate, cls=True) for candidate in candidates]
    return max(results, key=recognition_score)


def merge_handwritten_rows(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(lines) < 2:
        return lines
    threshold = max(12.0, median(line["boundingBox"]["height"] for line in lines) * 0.8)
    rows: list[list[dict[str, Any]]] = []
    for line in sorted(lines, key=lambda item: item["boundingBox"]["y"] + item["boundingBox"]["height"] / 2):
        center = line["boundingBox"]["y"] + line["boundingBox"]["height"] / 2
        matching_row = next((row for row in rows if abs(center - sum(
            item["boundingBox"]["y"] + item["boundingBox"]["height"] / 2 for item in row
        ) / len(row)) <= threshold), None)
        if matching_row is None:
            rows.append([line])
        else:
            matching_row.append(line)

    merged = []
    for row in rows:
        ordered = sorted(row, key=lambda item: item["boundingBox"]["x"])
        left = min(item["boundingBox"]["x"] for item in ordered)
        top = min(item["boundingBox"]["y"] for item in ordered)
        right = max(item["boundingBox"]["x"] + item["boundingBox"]["width"] for item in ordered)
        bottom = max(item["boundingBox"]["y"] + item["boundingBox"]["height"] for item in ordered)
        confidences = [item["confidence"] for item in ordered if item["confidence"] is not None]
        merged.append({
            "text": ",".join(item["text"] for item in ordered),
            "confidence": sum(confidences) / len(confidences) if confidences else None,
            "boundingBox": {"x": left, "y": top, "width": right - left, "height": bottom - top},
        })
    return merged


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
        ocr = get_ocr()
        prepared_image = prepare_image(image_path, request.sourceKind)
        result = recognize_handwritten_orientations(ocr, prepared_image) if request.sourceKind == "handwritten" else ocr.ocr(prepared_image, cls=True)
        # Smartphone memo screenshots often use low-contrast gray text. Keep the
        # normal path fast, but retry once with contrast enhancement when it found nothing.
        if request.sourceKind == "screenshot" and not has_recognized_lines(result):
            result = ocr.ocr(enhance_image(image_path), cls=True)
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
    if request.sourceKind == "handwritten":
        lines = merge_handwritten_rows(lines)
    return {
        "lines": lines,
        "elapsedMs": round((time.perf_counter() - started) * 1000, 3),
        "model": "PaddleOCR",
    }
