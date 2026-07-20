import { describe, expect, it } from "vitest";
import type { SurveyRecord } from "./survey-record";
import { hasRequiredSurveyFields } from "./survey-record-registration";

const completeRecord: SurveyRecord = {
  measuredAt: "2026-07-21T00:00:00.000Z",
  registeredAt: "2026-07-21T01:00:00.000Z",
  orchard: "徳田",
  variety: "早生",
  treatment: null,
  diametersMm: [40.1],
  brix: 10.2,
  acidity: null,
  notes: "",
  source: "text",
  confidence: 1,
  warnings: [],
};

describe("hasRequiredSurveyFields", () => {
  it("酸度が欠測でも登録できる", () => {
    expect(hasRequiredSurveyFields(completeRecord)).toBe(true);
  });

  it.each([
    ["調査日", { measuredAt: "" }],
    ["園地", { orchard: "" }],
    ["品種", { variety: "" }],
    ["未確定品種", { variety: "未設定" }],
    ["横径", { diametersMm: [] }],
    ["糖度", { brix: null }],
  ])("%sがない場合は登録できない", (_label, overrides) => {
    expect(hasRequiredSurveyFields({ ...completeRecord, ...overrides })).toBe(false);
  });
});
