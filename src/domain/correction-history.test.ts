import { describe, expect, it } from "vitest";
import { buildCorrectionEvents, type CorrectionSnapshot } from "./correction-history";

const snapshot: CorrectionSnapshot = {
  measuredDate: "2026-07-21", orchard: "国着", variety: "早生", treatment: null,
  diametersMm: [41.9], brix: 7.6, acidity: null, notes: null,
};

describe("correction history", () => {
  it("変更された項目だけを記録し、名称項目だけを辞書候補にする", () => {
    const events = buildCorrectionEvents({
      before: [snapshot],
      after: [{ ...snapshot, orchard: "国道", diametersMm: [41.9, 39.8] }],
      sourceKind: "screenshot", recordedAt: "2026-07-22T00:00:00.000Z", createId: () => "id",
    });

    expect(events).toEqual([
      expect.objectContaining({ field: "orchard", beforeValue: "国着", afterValue: "国道", dictionaryEligible: true }),
      expect.objectContaining({ field: "diametersMm", dictionaryEligible: false }),
    ]);
  });

  it("未変更候補と手動追加候補は記録しない", () => {
    expect(buildCorrectionEvents({
      before: [snapshot, null], after: [snapshot, { ...snapshot, orchard: "新園地" }],
      sourceKind: "text", recordedAt: "2026-07-22T00:00:00.000Z",
    })).toEqual([]);
  });
});
