import { describe, expect, it } from "vitest";
import type { OcrResult } from "../ocr";
import { SurveyMemoOcrParser } from "./survey-memo-ocr-parser";

function ocrResult(
  rawText: string,
  confidence: number | null = 0.92,
  sourceKind?: "screenshot" | "handwritten",
): OcrResult {
  return {
    provider: "paddle",
    rawText,
    blocks: [],
    lines: [],
    confidence,
    warnings: [],
    metadata: { mode: "economy", processedAt: "2026-07-21T00:00:00.000Z", sourceKind },
  };
}

describe("SurveyMemoOcrParser", () => {
  it("スマホメモの縦並びOCR文字列を複数候補へ変換する", async () => {
    const parsed = await new SurveyMemoOcrParser().parse({
      ocrResult: ocrResult(`11/16

有中
無処理区
506
504
561
570
513
572
14.5
1.1

スキー
602
580
607
541
562
535
13.5
1.2
受精よし`),
      referenceDate: new Date("2026-07-21T00:00:00.000Z"),
    });

    expect(parsed.candidates).toHaveLength(2);
    expect(parsed.candidates[0]).toMatchObject({
      orchard: "有中",
      variety: "ゆら早生",
      treatment: "無処理区",
      diametersMm: [50.6, 50.4, 56.1, 57, 51.3, 57.2],
      brix: 14.5,
      acidity: 1.1,
    });
    expect(parsed.candidates[1]).toMatchObject({
      orchard: "有中",
      treatment: "スキー",
      notes: "受精よし",
      brix: 13.5,
      acidity: 1.2,
    });
  });

  it("低信頼度を候補の警告として保持する", async () => {
    const parsed = await new SurveyMemoOcrParser().parse({
      ocrResult: ocrResult("徳田 早生 41.2 42.0 糖度8.9 酸2.7", 0.5),
    });

    expect(parsed.candidates[0].warnings.map((item) => item.code)).toContain("LOW_CONFIDENCE");
  });

  it("手書きメモは原画像との照合を促す", async () => {
    const parsed = await new SurveyMemoOcrParser().parse({
      ocrResult: ocrResult("徳田 早生 41.2 糖度8.9", 0.9, "handwritten"),
    });

    expect(parsed.candidates[0].warnings).toContainEqual(expect.objectContaining({
      code: "LOW_CONFIDENCE",
      message: expect.stringContaining("原画像"),
    }));
  });
});
