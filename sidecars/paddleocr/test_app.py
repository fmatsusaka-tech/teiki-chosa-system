import base64
from pathlib import Path
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import app


class PaddleOcrSidecarTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health(self) -> None:
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})

    @patch("app.prepare_image")
    @patch("app.get_ocr")
    def test_ocr_maps_paddle_result(self, get_ocr, prepare_image) -> None:
        prepare_image.return_value = "prepared-image"
        get_ocr.return_value.ocr.return_value = [[
            [[[1, 2], [11, 2], [11, 7], [1, 7]], ("糖度 7.3", 0.92)],
        ]]
        response = self.client.post("/ocr", json={
            "imageBase64": base64.b64encode(b"image").decode(),
            "mimeType": "image/png",
            "fileName": "survey.png",
        })
        self.assertEqual(response.status_code, 200)
        prepare_image.assert_called_once()
        get_ocr.return_value.ocr.assert_called_once_with("prepared-image", cls=True)
        image_path = Path(get_ocr.return_value.ocr.call_args.args[0])
        self.assertFalse(image_path.exists())
        self.assertEqual(response.json()["lines"][0], {
            "text": "糖度 7.3",
            "confidence": 0.92,
            "boundingBox": {"x": 1.0, "y": 2.0, "width": 10.0, "height": 5.0},
        })

    @patch("app.recognize_handwritten_orientations")
    @patch("app.prepare_image")
    @patch("app.get_ocr")
    def test_handwritten_source_is_preprocessed(self, get_ocr, prepare_image, recognize_orientations) -> None:
        prepare_image.return_value = "enhanced-image"
        recognize_orientations.return_value = []

        response = self.client.post("/ocr", json={
            "imageBase64": base64.b64encode(b"image").decode(),
            "mimeType": "image/jpeg",
            "fileName": "memo.jpg",
            "sourceKind": "handwritten",
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(prepare_image.call_args.args[1], "handwritten")
        recognize_orientations.assert_called_once_with(get_ocr.return_value, "enhanced-image")

    @patch("cv2.rotate")
    def test_handwritten_orientation_uses_highest_text_score(self, rotate) -> None:
        from app import recognize_handwritten_orientations

        rotate.side_effect = ["clockwise", "upside-down", "counterclockwise"]
        weak = [[[[[0, 0], [1, 0], [1, 1], [0, 1]], ("ト", 0.5)]]]
        strong = [[[[[0, 0], [1, 0], [1, 1], [0, 1]], ("トクダ 39.6 40.2", 0.9)]]]
        ocr = unittest.mock.Mock()
        ocr.ocr.side_effect = [weak, strong, weak, weak]

        self.assertIs(recognize_handwritten_orientations(ocr, "original"), strong)
        self.assertEqual(ocr.ocr.call_count, 4)

    def test_handwritten_fragments_are_grouped_into_spatial_rows(self) -> None:
        from app import merge_handwritten_rows

        lines = [
            {"text": "39.6", "confidence": 0.9, "boundingBox": {"x": 100, "y": 12, "width": 20, "height": 10}},
            {"text": "上中島", "confidence": 0.8, "boundingBox": {"x": 10, "y": 52, "width": 30, "height": 12}},
            {"text": "トクダ", "confidence": 0.7, "boundingBox": {"x": 10, "y": 10, "width": 30, "height": 12}},
            {"text": "42.1", "confidence": 0.9, "boundingBox": {"x": 100, "y": 53, "width": 20, "height": 10}},
        ]

        merged = merge_handwritten_rows(lines)

        self.assertEqual([line["text"] for line in merged], ["トクダ,39.6", "上中島,42.1"])

    @patch("app.enhance_image")
    @patch("app.prepare_image")
    @patch("app.get_ocr")
    def test_screenshot_retries_with_contrast_when_first_pass_is_empty(
        self, get_ocr, prepare_image, enhance_image
    ) -> None:
        prepare_image.return_value = "original-image"
        enhance_image.return_value = "enhanced-image"
        get_ocr.return_value.ocr.side_effect = [[], [[
            [[[1, 2], [11, 2], [11, 7], [1, 7]], ("徳田", 0.92)],
        ]]]

        response = self.client.post("/ocr", json={
            "imageBase64": base64.b64encode(b"image").decode(),
            "mimeType": "image/png",
            "fileName": "memo.png",
            "sourceKind": "screenshot",
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["lines"][0]["text"], "徳田")
        self.assertEqual(get_ocr.return_value.ocr.call_count, 2)
        get_ocr.return_value.ocr.assert_any_call("original-image", cls=True)
        get_ocr.return_value.ocr.assert_any_call("enhanced-image", cls=True)
        enhance_image.assert_called_once()

    def test_rejects_invalid_image(self) -> None:
        response = self.client.post("/ocr", json={
            "imageBase64": "not-base64",
            "mimeType": "image/png",
        })
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
