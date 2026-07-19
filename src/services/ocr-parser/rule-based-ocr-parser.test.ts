import { describe, expect, it } from "vitest";
import type { OcrResult } from "../ocr";
import { RuleBasedOcrParser } from "./rule-based-ocr-parser";

function result(rawText: string, confidence: number | null = 0.9): OcrResult {
  return {
    provider: "paddle",
    rawText,
    blocks: [],
    lines: [],
    confidence,
    warnings: [],
    metadata: { mode: "economy", processedAt: "2026-07-19T00:00:00.000Z" },
  };
}

describe("RuleBasedOcrParser", () => {
  it("parses provider-independent labelled OCR text", async () => {
    const parsed = await new RuleBasedOcrParser().parse({
      ocrResult: result([
        "調査日：２０２６／７／１５",
        "園地 徳田",
        "品種 ゆら早生",
        "処理区 マルチ",
        "横径 39.6-40.5-42.7",
        "糖度 8.4",
        "酸度 3.8%",
        "備考 少し小玉",
      ].join("\n")),
    });

    expect(parsed.candidates[0]).toMatchObject({
      measuredDate: "2026-07-15",
      orchard: "徳田",
      variety: "ゆら早生",
      treatment: "マルチ",
      diametersMm: [39.6, 40.5, 42.7],
      brix: 8.4,
      acidity: 3.8,
      notes: "少し小玉",
      warnings: [],
    });
  });

  it("keeps missing measurements as null and warns for missing required fields", async () => {
    const parsed = await new RuleBasedOcrParser().parse({
      ocrResult: result("園地: 徳田", null),
      referenceDate: new Date("2026-07-19T00:00:00Z"),
    });
    const candidate = parsed.candidates[0];

    expect(candidate).toMatchObject({
      measuredDate: null,
      orchard: "徳田",
      variety: null,
      diametersMm: null,
      brix: null,
      acidity: null,
      notes: null,
      confidence: null,
    });
    expect(candidate?.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "measuredDate" }),
      expect.objectContaining({ field: "variety" }),
    ]));
  });

  it("preserves unknown text for review instead of turning it into notes", async () => {
    const parsed = await new RuleBasedOcrParser().parse({
      ocrResult: result("調査日 7月15日\n園地 徳田\n品種 早生\n判読不能な断片", 0.5),
      referenceDate: new Date("2026-07-19T00:00:00Z"),
    });

    expect(parsed.candidates[0]?.unparsedText).toEqual(["判読不能な断片"]);
    expect(parsed.candidates[0]?.notes).toBeNull();
    expect(parsed.candidates[0]?.warnings.map((warning) => warning.code)).toEqual([
      "LOW_CONFIDENCE",
      "UNPARSED_TEXT",
    ]);
  });
});
