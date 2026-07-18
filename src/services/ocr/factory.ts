import { createOcrRuntimeConfig } from "./config";
import { createDefaultOcrProviderRegistry, type OcrProviderRegistry } from "./provider-registry";
import type { OcrProvider } from "./ocr-provider";
import type { OcrRuntimeConfig } from "./ocr-types";

export type OcrProviderSelection = {
  config: OcrRuntimeConfig;
  provider: OcrProvider;
  fallbackProviders: OcrProvider[];
};

export function createOcrProviderSelection(params?: {
  env?: Record<string, string | undefined>;
  registry?: OcrProviderRegistry;
}): OcrProviderSelection {
  const config = createOcrRuntimeConfig(params?.env);
  const registry = params?.registry ?? createDefaultOcrProviderRegistry();
  return {
    config,
    provider: registry.resolve(config.provider, config.mode),
    fallbackProviders: config.fallbackProviders.map((name) => registry.resolve(name, config.mode)),
  };
}

export function createOcrProvider(params?: {
  env?: Record<string, string | undefined>;
  registry?: OcrProviderRegistry;
}): OcrProvider {
  return createOcrProviderSelection(params).provider;
}
