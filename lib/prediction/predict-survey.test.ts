import { describe, expect, it } from "vitest";
import { predictSurveyRecord } from "./predict-survey";
import type { PredictionModelCurve, SurveyRecord } from "./types";

const survey: SurveyRecord = {
  registrationId: "reg-1",
  measuredAt: new Date("2026-07-17T00:00:00+09:00"),
  orchardName: "徳田",
  variety: "早生",
  treatment: "",
  note: "",
  averageDiameter: 40,
  brix: 8,
  acid: null,
  dataStatus: "酸度なし",
};

function curve(metric: "diameter" | "brix" | "acid"): PredictionModelCurve {
  return {
    metric,
    modelName: "興津早生",
    targetMonthDay: "11-15",
    targetStandardValue: 2,
    points: [
      { monthDay: "07-17", standardValue: 1 },
      { monthDay: "11-15", standardValue: 2 },
    ],
    version: "test-v1",
  };
}

describe("survey prediction", () => {
  it("predicts available metrics without failing on a missing metric", () => {
    const result = predictSurveyRecord(survey, [curve("diameter"), curve("brix"), curve("acid")]);
    expect(result.predictionModel).toBe("興津早生");
    expect(result.diameter.predictedValue).toBe(80);
    expect(result.brix.predictedValue).toBe(16);
    expect(result.acid.status).toBe("not-measured");
  });
});
