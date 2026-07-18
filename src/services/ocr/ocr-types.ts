import { z } from "zod";

export const ocrProviderNameSchema = z.enum(["paddle", "openai", "local"]);
export type OcrProviderName = z.infer<typeof ocrProviderNameSchema>;

export const ocrModeSchema = z.enum(["economy", "standard", "local"]);
export type OcrMode = z.infer<typeof ocrModeSchema>;

export const ocrErrorCodeSchema = z.enum([
  "UNKNOWN_PROVIDER",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_UNIMPLEMENTED",
  "INVALID_INPUT",
  "PROVIDER_ERROR",
]);
export type OcrErrorCode = z.infer<typeof ocrErrorCodeSchema>;

export const ocrBoundingBoxSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  page: z.number().int().nonnegative().nullable().optional(),
});
export type OcrBoundingBox = z.infer<typeof ocrBoundingBoxSchema>;

export const ocrTextBlockSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
  boundingBox: ocrBoundingBoxSchema.nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type OcrTextBlock = z.infer<typeof ocrTextBlockSchema>;

export const ocrMetadataSchema = z.object({
  model: z.string().nullable().optional(),
  mode: ocrModeSchema,
  processedAt: z.string().datetime(),
  elapsedMs: z.number().nonnegative().nullable().optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  rawProvider: z.string().nullable().optional(),
}).catchall(z.unknown());
export type OcrMetadata = z.infer<typeof ocrMetadataSchema>;

export const ocrResultSchema = z.object({
  provider: ocrProviderNameSchema,
  rawText: z.string(),
  blocks: z.array(ocrTextBlockSchema).default([]),
  lines: z.array(ocrTextBlockSchema).default([]),
  confidence: z.number().min(0).max(1).nullable(),
  warnings: z.array(z.string()).default([]),
  metadata: ocrMetadataSchema,
});
export type OcrResult = z.infer<typeof ocrResultSchema>;

export type OcrInput = {
  image: ArrayBuffer | Uint8Array;
  mimeType: string;
  fileName?: string;
  sourceKind?: "screenshot" | "photo" | "pdf" | "unknown";
};

export type OcrAvailability =
  | { available: true }
  | { available: false; reason: string; code: OcrErrorCode };

export type OcrRuntimeConfig = {
  mode: OcrMode;
  provider: OcrProviderName;
  fallbackProviders: OcrProviderName[];
};
