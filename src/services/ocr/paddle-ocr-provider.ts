import { z } from "zod";
import { normalizeOcrError, OcrProviderError } from "./ocr-error";
import type { OcrProvider } from "./ocr-provider";
import {
  ocrBoundingBoxSchema,
  ocrResultSchema,
  type OcrAvailability,
  type OcrInput,
  type OcrMode,
  type OcrResult,
  type OcrTextBlock,
} from "./ocr-types";

type FetchLike = typeof fetch;

type PaddleOcrProviderParams = {
  mode: OcrMode;
  serviceUrl: string;
  timeoutMs: number;
  fetchFn?: FetchLike;
};

const paddleTextBlockResponseSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  boundingBox: ocrBoundingBoxSchema.nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

const paddleOcrResponseSchema = z.object({
  rawText: z.string().optional(),
  lines: z.array(paddleTextBlockResponseSchema).default([]),
  blocks: z.array(paddleTextBlockResponseSchema).default([]),
  warnings: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

type PaddleTextBlockResponse = z.infer<typeof paddleTextBlockResponseSchema>;
type PaddleOcrResponse = z.infer<typeof paddleOcrResponseSchema>;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function createTimeoutController(timeoutMs: number): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

function toBlobPart(image: OcrInput["image"]): BlobPart {
  if (image instanceof ArrayBuffer) return image;
  return image.slice().buffer;
}

function toOcrTextBlock(block: PaddleTextBlockResponse): OcrTextBlock {
  return {
    text: block.text,
    confidence: block.confidence ?? null,
    boundingBox: block.boundingBox,
    metadata: block.metadata,
  };
}

function averageConfidence(blocks: OcrTextBlock[]): number | null {
  const values = blocks
    .map((block) => block.confidence)
    .filter((confidence): confidence is number => confidence !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createRawText(response: PaddleOcrResponse, lines: OcrTextBlock[]): string {
  if (response.rawText !== undefined) return response.rawText;
  return lines.map((line) => line.text).join("\n");
}

export class PaddleOcrProvider implements OcrProvider {
  readonly name = "paddle" as const;
  private readonly mode: OcrMode;
  private readonly serviceUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchLike;

  constructor(params: PaddleOcrProviderParams) {
    this.mode = params.mode;
    this.serviceUrl = params.serviceUrl.replace(/\/+$/, "");
    this.timeoutMs = params.timeoutMs;
    this.fetchFn = params.fetchFn ?? fetch;
  }

  async checkAvailability(): Promise<OcrAvailability> {
    const timeout = createTimeoutController(this.timeoutMs);
    try {
      const response = await this.fetchFn(`${this.serviceUrl}/health`, {
        method: "GET",
        signal: timeout.signal,
      });
      if (!response.ok) {
        return {
          available: false,
          code: "PROVIDER_UNAVAILABLE",
          reason: `PaddleOCR service health check failed with status ${response.status}.`,
        };
      }
      return { available: true };
    } catch (error) {
      return {
        available: false,
        code: isAbortError(error) ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
        reason: isAbortError(error)
          ? `PaddleOCR service health check timed out after ${this.timeoutMs}ms.`
          : "PaddleOCR service is unavailable.",
      };
    } finally {
      timeout.cancel();
    }
  }

  async recognize(input: OcrInput): Promise<OcrResult> {
    const timeout = createTimeoutController(this.timeoutMs);
    try {
      const form = new FormData();
      form.append("image", new Blob([toBlobPart(input.image)], { type: input.mimeType }), input.fileName ?? "image");
      if (input.sourceKind) form.append("sourceKind", input.sourceKind);

      const response = await this.fetchFn(`${this.serviceUrl}/ocr`, {
        method: "POST",
        body: form,
        signal: timeout.signal,
      });

      if (!response.ok) {
        throw new OcrProviderError({
          code: "PROVIDER_ERROR",
          provider: this.name,
          message: `PaddleOCR service failed with status ${response.status}.`,
        });
      }

      const rawResponse: unknown = await response.json();
      const parsed = paddleOcrResponseSchema.safeParse(rawResponse);
      if (!parsed.success) {
        throw new OcrProviderError({
          code: "INVALID_RESPONSE",
          provider: this.name,
          message: "PaddleOCR service returned an invalid response.",
          cause: parsed.error,
        });
      }

      const lines = parsed.data.lines.map(toOcrTextBlock);
      const blocks = parsed.data.blocks.length > 0 ? parsed.data.blocks.map(toOcrTextBlock) : lines;
      const rawText = createRawText(parsed.data, lines);
      const confidence = averageConfidence(lines.length > 0 ? lines : blocks);

      return ocrResultSchema.parse({
        provider: this.name,
        rawText,
        lines,
        blocks,
        confidence,
        warnings: parsed.data.warnings,
        metadata: {
          ...parsed.data.metadata,
          mode: this.mode,
          processedAt: new Date().toISOString(),
          rawProvider: "paddleocr-http-sidecar",
          serviceUrl: this.serviceUrl,
        },
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new OcrProviderError({
          code: "PROVIDER_TIMEOUT",
          provider: this.name,
          message: `PaddleOCR service timed out after ${this.timeoutMs}ms.`,
          cause: error,
        });
      }
      throw normalizeOcrError(error, this.name);
    } finally {
      timeout.cancel();
    }
  }
}
