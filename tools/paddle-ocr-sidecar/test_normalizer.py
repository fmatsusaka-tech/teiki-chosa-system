from __future__ import annotations

import unittest

from normalizer import normalize_result


class PaddleResult:
    json = {
        "res": {
            "rec_texts": ["ゆら早生", "糖度 7.3"],
            "rec_scores": [0.91, 0.82],
            "rec_polys": [
                [[1, 2], [31, 2], [31, 12], [1, 12]],
                [[2, 20], [42, 20], [42, 30], [2, 30]],
            ],
        }
    }


class NormalizeResultTest(unittest.TestCase):
    def test_normalizes_paddleocr_v3_result_object(self) -> None:
        lines = normalize_result([PaddleResult()])

        self.assertEqual([line["text"] for line in lines], ["ゆら早生", "糖度 7.3"])
        self.assertEqual(lines[0]["confidence"], 0.91)
        self.assertEqual(
            lines[0]["boundingBox"],
            {"x": 1.0, "y": 2.0, "width": 30.0, "height": 10.0},
        )

    def test_preserves_missing_confidence_as_none(self) -> None:
        lines = normalize_result({"rec_texts": ["文字"], "rec_scores": []})

        self.assertIsNone(lines[0]["confidence"])
        self.assertIsNone(lines[0]["boundingBox"])

    def test_accepts_generator_results(self) -> None:
        lines = normalize_result(page for page in [PaddleResult()])

        self.assertEqual(len(lines), 2)

    def test_supports_classic_result_for_compatibility(self) -> None:
        result = [[[[[0, 0], [10, 0], [10, 5], [0, 5]], ("classic", 0.75)]]]

        lines = normalize_result(result)

        self.assertEqual(lines[0]["text"], "classic")
        self.assertEqual(lines[0]["confidence"], 0.75)


if __name__ == "__main__":
    unittest.main()
