import { describe, expect, it } from "vitest";
import { buildRegistrationPayload, MAX_DIAMETER_COUNT } from "./build-registration-payload";
import type { SurveyRecord } from "./survey-record";

const record: SurveyRecord = {
  measuredAt: "2025-11-16T00:00:00.000Z",
  registeredAt: "2026-07-18T00:00:00.000Z",
  orchard: "有中",
  variety: "ゆら早生",
  diametersMm: [50.6, 50.4, 56.1, 57, 51.3, 57.2],
  brix: 16.1,
  acidity: 1,
  notes: "無処理区",
  source: "text",
  confidence: 1,
  warnings: [],
};

describe("buildRegistrationPayload", () => {
  it("横径を玉1から順番通り保持し、20玉分の空欄を補う", () => {
    const payload = buildRegistrationPayload(record);

    expect(payload.diametersMm).toHaveLength(MAX_DIAMETER_COUNT);
    expect(payload.diametersMm.slice(0, 6)).toEqual([50.6, 50.4, 56.1, 57, 51.3, 57.2]);
    expect(payload.diametersMm[6]).toBeNull();
  });

  it("表示・検索用の平均値を別項目として計算する", () => {
    const payload = buildRegistrationPayload(record);
    expect(payload.diameterAverageMm).toBeCloseTo(53.7666, 3);
  });
});
