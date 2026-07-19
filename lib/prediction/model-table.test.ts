import { describe, expect, it } from "vitest";
import { parseLegacyPredictionModelTable } from "./model-table";

function row(date: string, multiplier: number): unknown[] {
  const values = new Array(18).fill(null);
  for (let start = 0; start < 18; start += 3) {
    values[start] = date;
    values[start + 1] = multiplier;
    values[start + 2] = multiplier === 0 ? null : 1 / multiplier;
  }
  return values;
}

describe("legacy prediction model table", () => {
  it("uses the 倍数 column and ignores the derived 逆算 column", () => {
    const values = [
      row("7/15", 1),
      row("10/15", 1.8),
      row("11/15", 2),
      row("12/1", 2.2),
      row("12/15", 2.4),
    ];
    const curves = parseLegacyPredictionModelTable({ metric: "diameter", values, version: "sheet-v1" });

    expect(curves).toHaveLength(6);
    expect(curves.find((curve) => curve.modelName === "ゆら早生")).toMatchObject({
      targetMonthDay: "10-15",
      targetStandardValue: 1.8,
      version: "sheet-v1",
    });
    expect(curves.find((curve) => curve.modelName === "興津早生")?.targetStandardValue).toBe(2);
    expect(curves.find((curve) => curve.modelName === "向山温州")?.targetStandardValue).toBe(2.2);
  });

  it("omits a model when its target date is absent", () => {
    const curves = parseLegacyPredictionModelTable({
      metric: "brix",
      values: [row("7/15", 1)],
      version: "sheet-v1",
    });
    expect(curves).toEqual([]);
  });
});
