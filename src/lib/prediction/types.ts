export type PredictionMetric = "diameter" | "brix" | "acid";

export type PredictionModelName =
  | "ゆら早生"
  | "興津早生"
  | "田口早生"
  | "向山温州"
  | "林温州"
  | "丹生温州";

export type PredictionStatus =
  | "predicted"
  | "not-target"
  | "not-measured"
  | "out-of-range"
  | "invalid-model";

export interface StandardCurvePoint {
  /** Month and day in MM-DD form. The model is intentionally year-independent. */
  monthDay: string;
  standardValue: number;
}

export interface PredictionModelCurve {
  metric: PredictionMetric;
  modelName: PredictionModelName;
  targetMonthDay: string;
  targetStandardValue: number;
  points: StandardCurvePoint[];
  version: string;
}

export interface PredictionRequest {
  metric: PredictionMetric;
  modelName: PredictionModelName | null;
  measuredAt: Date;
  measuredValue: number | null;
}

export interface PredictionResult {
  metric: PredictionMetric;
  modelName: PredictionModelName | null;
  status: PredictionStatus;
  predictedValue: number | null;
  measuredValue: number | null;
  measuredMonthDay: string;
  targetMonthDay: string | null;
  standardAtMeasurement: number | null;
  targetStandardValue: number | null;
  correctionRatio: number | null;
  modelVersion: string | null;
}

export interface SurveyRecord {
  registrationId: string;
  measuredAt: Date;
  orchardName: string;
  variety: string;
  treatment: string;
  note: string;
  averageDiameter: number | null;
  brix: number | null;
  acid: number | null;
  dataStatus: string;
}
