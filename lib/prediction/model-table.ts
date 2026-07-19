import { PREDICTION_TARGET_MONTH_DAY } from "./variety-model";
import type {
  PredictionMetric,
  PredictionModelCurve,
  PredictionModelName,
  StandardCurvePoint,
} from "./types";

const LEGACY_MODEL_GROUPS: ReadonlyArray<{
  modelName: PredictionModelName;
  startColumn: number;
}> = [
  { modelName: "ゆら早生", startColumn: 0 },
  { modelName: "興津早生", startColumn: 3 },
  { modelName: "田口早生", startColumn: 6 },
  { modelName: "向山温州", startColumn: 9 },
  { modelName: "林温州", startColumn: 12 },
  { modelName: "丹生温州", startColumn: 15 },
];

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMonthDay(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  const match = /^(\d{1,2})[\/-](\d{1,2})$/.exec(text);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(2000, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function pointsForGroup(values: unknown[][], startColumn: number): StandardCurvePoint[] {
  const points: StandardCurvePoint[] = [];
  for (const row of values) {
    const monthDay = normalizeMonthDay(row[startColumn]);
    const multiplier = asNumber(row[startColumn + 1]);
    if (!monthDay || multiplier === null) continue;
    points.push({ monthDay, standardValue: multiplier });
  }
  return points;
}

/**
 * Parses the legacy AG:AX model area. Each variety occupies three columns:
 * date, 倍数, 逆算. The 倍数 series is the source curve; 逆算 is a derived
 * display column and is deliberately ignored.
 */
export function parseLegacyPredictionModelTable(params: {
  metric: PredictionMetric;
  values: unknown[][];
  version: string;
}): PredictionModelCurve[] {
  return LEGACY_MODEL_GROUPS.flatMap(({ modelName, startColumn }) => {
    const points = pointsForGroup(params.values, startColumn);
    const targetMonthDay = PREDICTION_TARGET_MONTH_DAY[modelName];
    const targetPoint = points.find((point) => point.monthDay === targetMonthDay);
    if (points.length === 0 || !targetPoint) return [];
    return [{
      metric: params.metric,
      modelName,
      targetMonthDay,
      targetStandardValue: targetPoint.standardValue,
      points,
      version: params.version,
    }];
  });
}

export function findPredictionCurve(
  curves: PredictionModelCurve[],
  metric: PredictionMetric,
  modelName: PredictionModelName,
): PredictionModelCurve | null {
  return curves.find((curve) => curve.metric === metric && curve.modelName === modelName) ?? null;
}
