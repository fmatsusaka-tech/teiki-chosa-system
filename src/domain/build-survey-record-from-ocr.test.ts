import { describe, expect, it } from "vitest";
import type { SurveyParseCandidate } from "../services/ocr-parser";
import { buildSurveyRecordFromOcr } from "./build-survey-record-from-ocr";

const candidate: SurveyParseCandidate = {
  measuredDate: "2026-07-19", orchard: "徳田", variety: "早生", treatment: "マルチ",
  diametersMm: null, brix: null, acidity: 0, notes: null, confidence: 0.8,
  sourceText: "OCR text", unparsedText: [], warnings: [],
};

describe("buildSurveyRecordFromOcr", () => {
  it("builds a confirmed record and preserves treatment and measured zero", () => {
    expect(buildSurveyRecordFromOcr(candidate, {
      registeredAt: "2026-07-19T01:00:00.000Z", source: "photo",
    })).toMatchObject({
      measuredAt: "2026-07-19T00:00:00.000Z", treatment: "マルチ", acidity: 0, source: "photo",
    });
  });

  it("preserves missing optional measurements without substituting zero", () => {
    const record = buildSurveyRecordFromOcr(candidate, {
      registeredAt: "2026-07-19T01:00:00.000Z", source: "screenshot",
    });
    expect(record.diametersMm).toEqual([]);
    expect(record.brix).toBeNull();
  });

  it("rejects a candidate whose required field is still missing", () => {
    expect(() => buildSurveyRecordFromOcr({ ...candidate, orchard: null }, {
      registeredAt: "2026-07-19T01:00:00.000Z", source: "photo",
    })).toThrow();
  });

  it("uses the registration date when the measured date is missing", () => {
    const record = buildSurveyRecordFromOcr({ ...candidate, measuredDate: null }, {
      registeredAt: "2026-07-21T15:30:00.000Z", source: "screenshot",
    });

    expect(record.measuredAt).toBe("2026-07-21T00:00:00.000Z");
  });
});
