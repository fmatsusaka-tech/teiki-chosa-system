import type { SurveyParseCandidate } from "../../services/ocr-parser";

export type ReviewFieldErrors = Partial<Record<"orchard" | "variety" | "diametersMm" | "brix", string>>;

export function validateReviewCandidate(candidate: SurveyParseCandidate): ReviewFieldErrors {
  return {
    ...(candidate.orchard?.trim() ? {} : { orchard: "園地を選択してください" }),
    ...(candidate.variety?.trim() ? {} : { variety: "品種を選択してください" }),
    ...(candidate.diametersMm && candidate.diametersMm.length >= 1 ? {} : { diametersMm: "横径を1個以上入力してください" }),
    ...(candidate.brix !== null ? {} : { brix: "糖度を入力してください" }),
  };
}

export function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseOptionalDiameters(values: readonly string[]): number[] | null {
  const parsed = values
    .filter((value) => value.trim() !== "")
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  return parsed.length > 0 ? parsed : null;
}
