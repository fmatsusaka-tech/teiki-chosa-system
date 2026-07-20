import type { SurveyParseCandidate } from "../services/ocr-parser";
import { surveyRecordSchema, type SurveyRecord } from "./survey-record";

export function buildSurveyRecordFromOcr(
  candidate: SurveyParseCandidate,
  options: { registeredAt: string; source: "photo" | "screenshot" },
): SurveyRecord {
  return surveyRecordSchema.parse({
    measuredAt: candidate.measuredDate ? new Date(`${candidate.measuredDate}T00:00:00.000Z`).toISOString() : "",
    registeredAt: options.registeredAt,
    orchard: candidate.orchard ?? "",
    variety: candidate.variety ?? "",
    treatment: candidate.treatment,
    diametersMm: candidate.diametersMm?.slice(0, 10) ?? [],
    brix: candidate.brix,
    acidity: candidate.acidity,
    notes: candidate.notes ?? "",
    source: options.source,
    confidence: candidate.confidence,
    warnings: candidate.warnings.map((warning) => warning.message),
  });
}
