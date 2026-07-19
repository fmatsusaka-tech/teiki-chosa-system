import type {
  PredictionModelCurve,
  PredictionRequest,
  PredictionResult,
  StandardCurvePoint,
} from "./types";

const JAPAN_MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
});

function toMonthDay(date: Date): string {
  const parts = JAPAN_MONTH_DAY_FORMATTER.formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!month || !day) throw new Error("計測日を月日に変換できませんでした。");
  return `${month}-${day}`;
}

function monthDayOrdinal(monthDay: string): number | null {
  const match = /^(\d{2})-(\d{2})$/.exec(monthDay);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(2000, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const start = Date.UTC(2000, 0, 1);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

function sortedPoints(points: StandardCurvePoint[]): Array<StandardCurvePoint & { ordinal: number }> {
  return points
    .map((point) => ({ ...point, ordinal: monthDayOrdinal(point.monthDay) }))
    .filter((point): point is StandardCurvePoint & { ordinal: number } => point.ordinal !== null)
    .sort((a, b) => a.ordinal - b.ordinal);
}

/**
 * Returns the standard value for the survey date. Exact daily points are used as-is;
 * missing days are linearly interpolated between the surrounding points.
 */
export function standardValueAt(points: StandardCurvePoint[], monthDay: string): number | null {
  const target = monthDayOrdinal(monthDay);
  if (target === null) return null;
  const ordered = sortedPoints(points);
  if (ordered.length === 0 || target < ordered[0].ordinal || target > ordered[ordered.length - 1].ordinal) {
    return null;
  }
  const exact = ordered.find((point) => point.ordinal === target);
  if (exact) return exact.standardValue;

  const rightIndex = ordered.findIndex((point) => point.ordinal > target);
  if (rightIndex <= 0) return null;
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  const progress = (target - left.ordinal) / (right.ordinal - left.ordinal);
  return left.standardValue + (right.standardValue - left.standardValue) * progress;
}

/**
 * Existing spreadsheet logic:
 * predicted = measured × target standard ÷ standard on measurement date.
 */
export function predictWithCurve(
  request: PredictionRequest,
  curve: PredictionModelCurve | null,
): PredictionResult {
  const measuredMonthDay = toMonthDay(request.measuredAt);
  const base = {
    metric: request.metric,
    modelName: request.modelName,
    measuredValue: request.measuredValue,
    measuredMonthDay,
  } as const;

  if (request.modelName === null) {
    return {
      ...base,
      status: "not-target",
      predictedValue: null,
      targetMonthDay: null,
      standardAtMeasurement: null,
      targetStandardValue: null,
      correctionRatio: null,
      modelVersion: null,
    };
  }
  if (request.measuredValue === null || !Number.isFinite(request.measuredValue)) {
    return {
      ...base,
      status: "not-measured",
      predictedValue: null,
      targetMonthDay: curve?.targetMonthDay ?? null,
      standardAtMeasurement: null,
      targetStandardValue: curve?.targetStandardValue ?? null,
      correctionRatio: null,
      modelVersion: curve?.version ?? null,
    };
  }
  if (!curve || curve.modelName !== request.modelName || curve.metric !== request.metric) {
    return {
      ...base,
      status: "invalid-model",
      predictedValue: null,
      targetMonthDay: curve?.targetMonthDay ?? null,
      standardAtMeasurement: null,
      targetStandardValue: curve?.targetStandardValue ?? null,
      correctionRatio: null,
      modelVersion: curve?.version ?? null,
    };
  }

  const standardAtMeasurement = standardValueAt(curve.points, measuredMonthDay);
  if (standardAtMeasurement === null || standardAtMeasurement === 0) {
    return {
      ...base,
      status: "out-of-range",
      predictedValue: null,
      targetMonthDay: curve.targetMonthDay,
      standardAtMeasurement,
      targetStandardValue: curve.targetStandardValue,
      correctionRatio: null,
      modelVersion: curve.version,
    };
  }

  const correctionRatio = curve.targetStandardValue / standardAtMeasurement;
  return {
    ...base,
    status: "predicted",
    predictedValue: request.measuredValue * correctionRatio,
    targetMonthDay: curve.targetMonthDay,
    standardAtMeasurement,
    targetStandardValue: curve.targetStandardValue,
    correctionRatio,
    modelVersion: curve.version,
  };
}
