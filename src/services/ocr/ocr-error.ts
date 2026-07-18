import type { OcrErrorCode, OcrProviderName } from "./ocr-types";

export class OcrProviderError extends Error {
  readonly code: OcrErrorCode;
  readonly provider?: OcrProviderName;
  readonly cause?: unknown;

  constructor(params: {
    code: OcrErrorCode;
    message: string;
    provider?: OcrProviderName;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "OcrProviderError";
    this.code = params.code;
    this.provider = params.provider;
    this.cause = params.cause;
  }
}

export function normalizeOcrError(
  error: unknown,
  provider?: OcrProviderName,
): OcrProviderError {
  if (error instanceof OcrProviderError) return error;
  if (error instanceof Error) {
    return new OcrProviderError({
      code: "PROVIDER_ERROR",
      provider,
      message: error.message,
      cause: error,
    });
  }
  return new OcrProviderError({
    code: "PROVIDER_ERROR",
    provider,
    message: "OCR provider failed with an unknown error.",
    cause: error,
  });
}
