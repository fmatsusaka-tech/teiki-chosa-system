import { describe, expect, it } from "vitest";
import { surveyRecordSchema } from "./survey-record";

describe("surveyRecordSchema", () => {
  it("accepts a valid survey record with variable diameter count", () => {
    const result = surveyRecordSchema.parse({
      measuredAt: "2026-07-18T06:00:00.000Z",
      registeredAt: "2026-07-18T06:05:00.000Z",
      orchard: "徳田",
      variety: "早生(宮川・興津など)",
      diametersMm: [39.6, 40.5, 42.7],
      brix: 8.4,
      acidity: 3.8,
      notes: "",
      source: "text",
      confidence: 0.95,
      warnings: [],
    });

    expect(result.diametersMm).toHaveLength(3);
  });

  it("rejects an empty orchard name", () => {
    const result = surveyRecordSchema.safeParse({
      measuredAt: "2026-07-18T06:00:00.000Z",
      registeredAt: "2026-07-18T06:05:00.000Z",
      orchard: "",
      variety: "早生",
      diametersMm: [],
      brix: null,
      acidity: null,
      source: "voice",
      confidence: null,
    });

    expect(result.success).toBe(false);
  });
});
