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

  it("スマホ画面UIを既知園地より前で除外し、欠けた日付区切りを補正する", async () => {
    const parsed = await new SurveyMemoOcrParser().parse({
      ocrResult: ocrResult(`17:46
.:!!
つ
16
-
20261
年7月21日
17:46
7121
徳田
早生
401
402
403
10.5
1.0
接続テスト
-`, 0.9, "handwritten"),
      referenceDate: new Date("2026-07-21T00:00:00.000Z"),
    });

    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.candidates[0]).toMatchObject({
      measuredDate: "2026-07-21",
      orchard: "徳田",
      variety: "早生",
      diametersMm: [40.1, 40.2, 40.3],
      brix: 10.5,
      acidity: 1,
      notes: "接続テスト",
    });
  });

  it("未知の新園地を含む文字列は既存の補正フローへ残す", async () => {
    const parsed = await new SurveyMemoOcrParser().parse({
      ocrResult: ocrResult("7/21\n新園地\n早生\n401\n10.5"),
      referenceDate: new Date("2026-07-21T00:00:00.000Z"),
    });

    expect(parsed.candidates[0].sourceText).toContain("新園地");
  });

  it("手書き表の複数園地行を別候補へ分け、カタカナ園地名を正規化する", async () => {
    const parsed = await new SurveyMemoOcrParser().parse({
      ocrResult: ocrResult(`トクダ,早生,396,402,410,382,7.5,4.0
上中島,早生,421,435,387,356,408,7.5,4.0`, 0.8, "handwritten"),
      referenceDate: new Date("2026-07-21T00:00:00.000Z"),
    });

    expect(parsed.candidates).toHaveLength(2);
    expect(parsed.candidates[0]).toMatchObject({
      orchard: "徳田", variety: "早生", diametersMm: [39.6, 40.2, 41, 38.2], brix: 7.5, acidity: 4,
    });
    expect(parsed.candidates[1]).toMatchObject({
      orchard: "上中島", variety: "早生", diametersMm: [42.1, 43.5, 38.7, 35.6, 40.8], brix: 7.5, acidity: 4,
    });
  });

  it("新園地を含む手書き表の行を補正可能な候補として残す", async () => {
    const parsed = await new SurveyMemoOcrParser().parse({
      ocrResult: ocrResult("国道,フィガロン処理前,早生,419,398,455,7.6", 0.8, "handwritten"),
      referenceDate: new Date("2026-07-21T00:00:00.000Z"),
    });

    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.candidates[0]).toMatchObject({
      orchard: "国道", variety: "早生", diametersMm: [41.9, 39.8, 45.5], brix: 7.6, acidity: null,
      notes: "フィガロン処理前",
    });
  });
});
