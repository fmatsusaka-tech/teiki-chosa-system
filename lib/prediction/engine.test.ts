import { describe, expect, it } from "vitest";
import { predictWithCurve, standardValueAt } from "./engine";
import type { PredictionModelCurve } from "./types";

const curve: PredictionModelCurve = {
  metric: "diameter",
  modelName: "ゆら早生",
  targetMonthDay: "10-15",
  targetStandardValue: 60,
  version: "test-v1",
  points: [
    { monthDay: "07-17", standardValue: 34.9529 },
    { monthDay: "07-19", standardValue: 36 },
    { monthDay: "10-15", standardValue: 60 },
  ],
};

describe("prediction engine", () => {
  it("uses the spreadsheet ratio correction formula", () => {
    const result = predictWithCurve({
      metric: "diameter",
      modelName: "ゆら早生",
      measuredAt: new Date("2026-07-17T00:00:00+09:00"),
      measuredValue: 37.3,
    }, curve);

    expect(result.status).toBe("predicted");
    expect(result.standardAtMeasurement).toBeCloseTo(34.9529);
    expect(result.predictedValue).toBeCloseTo(37.3 * 60 / 34.9529, 8);
    expect(result.correctionRatio).toBeCloseTo(60 / 34.9529, 8);
  });

  it("interpolates a missing day between curve points", () => {
    expect(standardValueAt(curve.points, "07-18")).toBeCloseTo((34.9529 + 36) / 2);
  });

  it("keeps a missing metric independent from other metrics", () => {
    const result = predictWithCurve({
      metric: "diameter",
      modelName: "ゆら早生",
      measuredAt: new Date("2026-07-17T00:00:00+09:00"),
      measuredValue: null,
    }, curve);
    expect(result.status).toBe("not-measured");
    expect(result.predictedValue).toBeNull();
  });

  it("marks unsupported varieties as not-target", () => {
    const result = predictWithCurve({
      metric: "diameter",
      modelName: null,
      measuredAt: new Date("2026-07-17T00:00:00+09:00"),
      measuredValue: 40,
    }, null);
    expect(result.status).toBe("not-target");
  });

  it("marks dates outside the model curve as out-of-range", () => {
    const result = predictWithCurve({
      metric: "diameter",
      modelName: "ゆら早生",
      measuredAt: new Date("2026-06-01T00:00:00+09:00"),
      measuredValue: 30,
    }, curve);
    expect(result.status).toBe("out-of-range");
  });
});
