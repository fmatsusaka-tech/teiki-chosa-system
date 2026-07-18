import { OcrProviderError } from "./ocr-error";
import { ocrModeSchema, ocrProviderNameSchema, type OcrMode, type OcrProviderName, type OcrRuntimeConfig } from "./ocr-types";

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

type OcrEnvironment = Record<string, string | undefined>;

function readValue(env: OcrEnvironment, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
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

  return {
    mode: modeResult.data,
    provider: providerResult.data,
    fallbackProviders: fallbackProvidersByMode[modeResult.data],
  };
}
