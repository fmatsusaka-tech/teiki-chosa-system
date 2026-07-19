import { predictWithCurve } from "./engine";
import { findPredictionCurve } from "./model-table";
import { resolvePredictionModel } from "./variety-model";
import type {
  PredictionModelCurve,
  PredictionResult,
  SurveyRecord,
} from "./types";

export interface SurveyPrediction {
  registrationId: string;
  survey: SurveyRecord;
  predictionModel: ReturnType<typeof resolvePredictionModel>;
  diameter: PredictionResult;
  brix: PredictionResult;
  acid: PredictionResult;
}

export function predictSurveyRecord(
  survey: SurveyRecord,
  curves: PredictionModelCurve[],
): SurveyPrediction {
  const predictionModel = resolvePredictionModel(survey.variety);
  const predict = (
    metric: "diameter" | "brix" | "acid",
    measuredValue: number | null,
  ): PredictionResult => predictWithCurve({
    metric,
    modelName: predictionModel,
    measuredAt: survey.measuredAt,
    measuredValue,
  }, predictionModel ? findPredictionCurve(curves, metric, predictionModel) : null);

  return {
    registrationId: survey.registrationId,
    survey,
    predictionModel,
    diameter: predict("diameter", survey.averageDiameter),
    brix: predict("brix", survey.brix),
    acid: predict("acid", survey.acid),
  };
}

export function predictSurveyRecords(
  surveys: SurveyRecord[],
  curves: PredictionModelCurve[],
): SurveyPrediction[] {
  return surveys.map((survey) => predictSurveyRecord(survey, curves));
}
