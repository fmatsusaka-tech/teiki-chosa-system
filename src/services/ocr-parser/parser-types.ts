import { z } from "zod";
import type { OcrResult } from "../ocr";

export const parserWarningSchema = z.object({
  code: z.enum(["MISSING_REQUIRED_FIELD", "LOW_CONFIDENCE", "UNPARSED_TEXT"]),
  message: z.string().min(1),
  field: z.enum(["measuredDate", "orchard", "variety"]).nullable().optional(),
});
export type ParserWarning = z.infer<typeof parserWarningSchema>;

/** A review candidate, deliberately separate from the persisted SurveyRecord. */
export const surveyParseCandidateSchema = z.object({
  measuredDate: z.string().date().nullable(),
  orchard: z.string().min(1).nullable(),
  variety: z.string().min(1).nullable(),
  treatment: z.string().min(1).nullable(),
  diametersMm: z.array(z.number().positive()).nullable(),
  brix: z.number().nonnegative().nullable(),
  acidity: z.number().nonnegative().nullable(),
  notes: z.string().min(1).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  sourceText: z.string(),
  unparsedText: z.array(z.string()).default([]),
  warnings: z.array(parserWarningSchema).default([]),
});
export type SurveyParseCandidate = z.infer<typeof surveyParseCandidateSchema>;

export const ocrParseResultSchema = z.object({
  candidates: z.array(surveyParseCandidateSchema),
  warnings: z.array(parserWarningSchema).default([]),
});
export type OcrParseResult = z.infer<typeof ocrParseResultSchema>;

export type OcrParseInput = {
  ocrResult: OcrResult;
  referenceDate?: Date;
};

export interface OcrParser {
  parse(input: OcrParseInput): Promise<OcrParseResult>;
}
