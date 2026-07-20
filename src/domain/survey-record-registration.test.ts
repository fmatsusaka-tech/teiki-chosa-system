import { describe, expect, it } from "vitest";
import type { SurveyRecord } from "./survey-record";
import {
  applyRegistrationDate,
  hasRequiredSurveyFields,
} from "./survey-record-registration";

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
    ["園地", { orchard: "" }],
    ["品種", { variety: "" }],
    ["未確定品種", { variety: "未設定" }],
    ["横径", { diametersMm: [] }],
    ["糖度", { brix: null }],
  ])("%sがない場合は登録できない", (_label, overrides) => {
    expect(hasRequiredSurveyFields({ ...completeRecord, ...overrides })).toBe(false);
  });

  it("調査日が空欄でも登録前の必須判定を通過する", () => {
    expect(hasRequiredSurveyFields({ ...completeRecord, measuredAt: "" })).toBe(true);
  });

  it("横径が1個あれば登録できる", () => {
    expect(hasRequiredSurveyFields({ ...completeRecord, diametersMm: [39.8] })).toBe(true);
  });
});

describe("applyRegistrationDate", () => {
  it("空欄の調査日へ登録操作日を設定する", () => {
    const result = applyRegistrationDate(
      { ...completeRecord, measuredAt: "" },
      new Date(2026, 6, 21, 15, 30),
    );

    expect(result.measuredAt).toBe("2026-07-21T00:00:00.000Z");
  });

  it("入力済みの調査日は変更しない", () => {
    const result = applyRegistrationDate(completeRecord, new Date(2027, 0, 1));

    expect(result).toBe(completeRecord);
    expect(result.measuredAt).toBe("2026-07-21T00:00:00.000Z");
  });
});
