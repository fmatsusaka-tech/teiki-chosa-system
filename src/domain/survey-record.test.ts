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

  it("横径は最大10個まで受け付ける", () => {
    const base = {
      measuredAt: "2026-07-21T00:00:00.000Z",
      registeredAt: "2026-07-21T01:00:00.000Z",
      orchard: "徳田",
      variety: "早生",
      brix: 10.5,
      acidity: null,
      notes: "",
      source: "text" as const,
      confidence: 1,
      warnings: [],
    };

    expect(surveyRecordSchema.safeParse({ ...base, diametersMm: Array(10).fill(40) }).success).toBe(true);
    expect(surveyRecordSchema.safeParse({ ...base, diametersMm: Array(11).fill(40) }).success).toBe(false);
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

  it("accepts handwritten as an image input source", () => {
    const result = surveyRecordSchema.safeParse({
      measuredAt: "2026-07-21T00:00:00.000Z",
      registeredAt: "2026-07-21T01:00:00.000Z",
      orchard: "徳田",
      variety: "早生",
      diametersMm: [40.1],
      brix: 10.5,
      acidity: null,
      notes: "手書きから補正",
      source: "handwritten",
      confidence: 0.7,
      warnings: [],
    });

    expect(result.success).toBe(true);
  });
});
