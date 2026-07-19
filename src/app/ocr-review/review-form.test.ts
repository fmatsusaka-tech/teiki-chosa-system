import { describe, expect, it } from "vitest";
import type { SurveyParseCandidate } from "../../services/ocr-parser";
import { parseOptionalDiameters, parseOptionalNumber, validateReviewCandidate } from "./review-form";

const candidate: SurveyParseCandidate = {
  measuredDate: "2026-07-19", orchard: "徳田", variety: "早生", treatment: null,
  diametersMm: null, brix: null, acidity: null, notes: null, confidence: null,
  sourceText: "", unparsedText: [], warnings: [],
};

describe("OCR review form", () => {
  it("accepts a candidate when the three required fields exist", () => {
    expect(validateReviewCandidate(candidate)).toEqual({});
  });

  it("reports only missing required fields and permits missing measurements", () => {
    expect(validateReviewCandidate({ ...candidate, measuredDate: null, orchard: null, variety: null })).toEqual({
      measuredDate: "調査日を入力してください",
      orchard: "園地を選択してください",
      variety: "品種を選択してください",
    });
  });

  it("keeps empty optional numbers as null rather than zero", () => {
    expect(parseOptionalNumber("")).toBeNull();
    expect(parseOptionalDiameters(["", " "])).toBeNull();
    expect(parseOptionalDiameters(["51.2", "52"])).toEqual([51.2, 52]);
  });
});
