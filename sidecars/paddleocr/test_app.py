import base64
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import app


class PaddleOcrSidecarTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health(self) -> None:
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})

    @patch("app.get_ocr")
    def test_ocr_maps_paddle_result(self, get_ocr) -> None:
        get_ocr.return_value.ocr.return_value = [[
            [[[1, 2], [11, 2], [11, 7], [1, 7]], ("糖度 7.3", 0.92)],
        ]]
        response = self.client.post("/ocr", json={
            "imageBase64": base64.b64encode(b"image").decode(),
            "mimeType": "image/png",
            "fileName": "survey.png",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["lines"][0], {
            "text": "糖度 7.3",
            "confidence": 0.92,
            "boundingBox": {"x": 1.0, "y": 2.0, "width": 10.0, "height": 5.0},
        })

    def test_rejects_invalid_image(self) -> None:
        response = self.client.post("/ocr", json={
            "imageBase64": "not-base64",
            "mimeType": "image/png",
        })
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
