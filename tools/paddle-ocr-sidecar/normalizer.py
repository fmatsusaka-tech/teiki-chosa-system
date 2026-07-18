from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from typing import Any


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if hasattr(value, "tolist"):
        value = value.tolist()
    return value if isinstance(value, list) else []


def normalize_box(points: Any) -> dict[str, float] | None:
    points = _as_list(points)
    if not points:
        return None
    try:
        xs = [float(point[0]) for point in points]
        ys = [float(point[1]) for point in points]
    except (TypeError, ValueError, IndexError):
        return None
    return {
        "x": min(xs),
        "y": min(ys),
        "width": max(xs) - min(xs),
        "height": max(ys) - min(ys),
    }


def _result_payload(page: Any) -> Mapping[str, Any] | None:
    if isinstance(page, Mapping):
        payload = page
    else:
        payload = getattr(page, "json", None)
        if callable(payload):
            payload = payload()
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError:
                return None
        if not isinstance(payload, Mapping):
            return None

    nested = payload.get("res")
    return nested if isinstance(nested, Mapping) else payload


def _normalize_v3_result(result: Any) -> list[dict[str, Any]]:
    pages: Iterable[Any] = (
        result
        if isinstance(result, Iterable) and not isinstance(result, (str, bytes, Mapping))
        else [result]
    )
    lines: list[dict[str, Any]] = []
    for page in pages:
        payload = _result_payload(page)
        if payload is None:
            continue
        texts = _as_list(payload.get("rec_texts"))
        scores = _as_list(payload.get("rec_scores"))
        boxes = _as_list(payload.get("rec_polys")) or _as_list(payload.get("dt_polys"))
        for index, text in enumerate(texts):
            score = scores[index] if index < len(scores) else None
            confidence = float(score) if isinstance(score, (int, float)) else None
            lines.append(
                {
                    "text": str(text),
                    "confidence": confidence,
                    "boundingBox": normalize_box(boxes[index] if index < len(boxes) else None),
                    "metadata": {},
                }
            )
    return lines


def _normalize_classic_result(result: Any) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    for page in result or []:
        for item in page or []:
            if not isinstance(item, (tuple, list)) or len(item) < 2:
                continue
            text_part = item[1]
            if not isinstance(text_part, (tuple, list)) or not text_part:
                continue
            score = text_part[1] if len(text_part) >= 2 else None
            lines.append(
                {
                    "text": str(text_part[0]),
                    "confidence": float(score) if isinstance(score, (int, float)) else None,
                    "boundingBox": normalize_box(item[0]),
                    "metadata": {},
                }
            )
    return lines


def normalize_result(result: Any) -> list[dict[str, Any]]:
    return _normalize_v3_result(result) or _normalize_classic_result(result)
