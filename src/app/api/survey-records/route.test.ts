import { describe, expect, it } from "vitest";
import { surveyRecordsRequestSchema } from "./request-schema";

const candidate = {
  measuredDate: null,
  orchard: "徳田",
  variety: "早生",
  treatment: null,
  diametersMm: [40.1],
  brix: 10.5,
  acidity: null,
  notes: null,
  confidence: 0.8,
  sourceText: "徳田 早生 401 10.5",
  unparsedText: [],
  warnings: [],
};

describe("surveyRecordsRequestSchema", () => {
  it("accepts confirmed handwritten OCR candidates", () => {
    const result = surveyRecordsRequestSchema.parse({
      candidates: [candidate],
      warningsConfirmed: true,
      sourceKind: "handwritten",
    });

    expect(result.sourceKind).toBe("handwritten");
  });

  it("continues to reject unknown input sources", () => {
    expect(surveyRecordsRequestSchema.safeParse({
      candidates: [candidate],
      warningsConfirmed: true,
      sourceKind: "unknown",
    }).success).toBe(false);
  });
});
