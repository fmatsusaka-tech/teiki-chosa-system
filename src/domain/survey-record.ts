import { z } from "zod";

export const surveyRecordSchema = z.object({
  id: z.string().uuid().optional(),
  measuredAt: z.string().datetime(),
  registeredAt: z.string().datetime(),
  orchard: z.string().trim().min(1),
  variety: z.string().trim().min(1),
  treatment: z.string().trim().min(1).nullable().optional(),
  diametersMm: z.array(z.number().positive()).max(10).default([]),
  brix: z.number().nonnegative().nullable(),
  acidity: z.number().nonnegative().nullable(),
  notes: z.string().default(""),
  source: z.enum(["text", "voice", "screenshot", "photo", "pdf"]),
  confidence: z.number().min(0).max(1).nullable(),
  warnings: z.array(z.string()).default([]),
});

export type SurveyRecord = z.infer<typeof surveyRecordSchema>;

export const parsedSurveyBatchSchema = z.object({
  records: z.array(surveyRecordSchema),
  sourceText: z.string().optional(),
  batchWarnings: z.array(z.string()).default([]),
});

export type ParsedSurveyBatch = z.infer<typeof parsedSurveyBatchSchema>;
