import type { SurveyParseCandidate } from "../../services/ocr-parser";

export type ReviewFieldErrors = Partial<Record<"measuredDate" | "orchard" | "variety", string>>;

export function validateReviewCandidate(candidate: SurveyParseCandidate): ReviewFieldErrors {
  return {
    ...(candidate.measuredDate ? {} : { measuredDate: "調査日を入力してください" }),
    ...(candidate.orchard?.trim() ? {} : { orchard: "園地を選択してください" }),
    ...(candidate.variety?.trim() ? {} : { variety: "品種を選択してください" }),
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
