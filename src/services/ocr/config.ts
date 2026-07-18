import { OcrProviderError } from "./ocr-error";
import {
  ocrModeSchema,
  ocrProviderNameSchema,
  type OcrMode,
  type OcrProviderName,
  type OcrRuntimeConfig,
} from "./ocr-types";

const defaultProviderByMode: Record<OcrMode, OcrProviderName> = {
  economy: "paddle",
  standard: "paddle",
  local: "local",
};

const fallbackProvidersByMode: Record<OcrMode, OcrProviderName[]> = {
  economy: [],
  standard: ["openai"],
  local: [],
};

const DEFAULT_PADDLE_OCR_SERVICE_URL = "http://127.0.0.1:8868";
const DEFAULT_OCR_TIMEOUT_MS = 30_000;

type OcrEnvironment = Record<string, string | undefined>;

function readValue(env: OcrEnvironment, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function readTimeoutMs(env: OcrEnvironment): number {
  const rawValue = readValue(env, "OCR_TIMEOUT_MS");
  if (!rawValue) return DEFAULT_OCR_TIMEOUT_MS;

  const timeoutMs = Number(rawValue);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new OcrProviderError({
      code: "INVALID_INPUT",
      message: `OCR_TIMEOUT_MS must be a positive integer: ${rawValue}`,
    });
  }
  return timeoutMs;
}

export function createOcrRuntimeConfig(
  env: OcrEnvironment = process.env,
): OcrRuntimeConfig {
  const modeValue = readValue(env, "OCR_MODE") ?? "economy";
  const modeResult = ocrModeSchema.safeParse(modeValue);
  if (!modeResult.success) {
    throw new OcrProviderError({
      code: "INVALID_INPUT",
      message: `Unsupported OCR mode: ${modeValue}`,
    });
  }

  const providerValue = readValue(env, "OCR_PROVIDER") ?? defaultProviderByMode[modeResult.data];
  const providerResult = ocrProviderNameSchema.safeParse(providerValue);
  if (!providerResult.success) {
    throw new OcrProviderError({
      code: "UNKNOWN_PROVIDER",
      message: `Unsupported OCR provider: ${providerValue}`,
    });
  }

  const paddleOcrServiceUrl =
    readValue(env, "PADDLE_OCR_SERVICE_URL") ??
    readValue(env, "OCR_SERVICE_URL") ??
    DEFAULT_PADDLE_OCR_SERVICE_URL;

  return {
    mode: modeResult.data,
    provider: providerResult.data,
    fallbackProviders: fallbackProvidersByMode[modeResult.data],
    timeoutMs: readTimeoutMs(env),
    paddleOcr: {
      serviceUrl: paddleOcrServiceUrl.replace(/\/+$/, ""),
    },
  };
}
