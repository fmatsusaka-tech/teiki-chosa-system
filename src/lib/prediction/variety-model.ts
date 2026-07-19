import type { PredictionModelName } from "./types";

const VARIETY_MODEL_MAP: Readonly<Record<string, PredictionModelName>> = Object.freeze({
  ゆら早生: "ゆら早生",
  早生: "興津早生",
  田口: "田口早生",
  中生: "向山温州",
  晩生: "林温州",
  丹生系: "丹生温州",
});

export const PREDICTION_TARGET_MONTH_DAY: Readonly<Record<PredictionModelName, string>> = Object.freeze({
  ゆら早生: "10-15",
  興津早生: "11-15",
  田口早生: "11-15",
  向山温州: "12-01",
  林温州: "12-15",
  丹生温州: "12-15",
});

export function resolvePredictionModel(variety: string): PredictionModelName | null {
  return VARIETY_MODEL_MAP[variety.trim()] ?? null;
}

export function isPredictionTargetVariety(variety: string): boolean {
  return resolvePredictionModel(variety) !== null;
}
