import { z } from "zod";
import { surveyParseCandidateSchema } from "../../../services/ocr-parser";

export const surveyRecordsRequestSchema = z.object({
  candidates: z.array(surveyParseCandidateSchema).min(1),
  originalCandidates: z.array(surveyParseCandidateSchema).default([]),
  warningsConfirmed: z.literal(true),
  sourceKind: z.enum(["photo", "screenshot", "handwritten"]).default("photo"),
});
