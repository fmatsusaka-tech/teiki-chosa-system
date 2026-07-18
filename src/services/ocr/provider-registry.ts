import { OcrProviderError } from "./ocr-error";
import type { OcrProvider } from "./ocr-provider";
import { PaddleOcrProvider } from "./paddle-ocr-provider";
import type { OcrProviderName, OcrRuntimeConfig } from "./ocr-types";
import { UnimplementedOcrProvider } from "./unimplemented-provider";

export type OcrProviderFactory = (params: { config: OcrRuntimeConfig }) => OcrProvider;

export class OcrProviderRegistry {
  private readonly factories = new Map<OcrProviderName, OcrProviderFactory>();

  register(name: OcrProviderName, factory: OcrProviderFactory): void {
    this.factories.set(name, factory);
  }

  resolve(name: OcrProviderName, config: OcrRuntimeConfig): OcrProvider {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new OcrProviderError({
        code: "UNKNOWN_PROVIDER",
        provider: name,
        message: `OCR provider is not registered: ${name}`,
      });
    }
    return factory({ config });
  }

  listProviderNames(): OcrProviderName[] {
    return Array.from(this.factories.keys());
  }
}

export function createDefaultOcrProviderRegistry(): OcrProviderRegistry {
  const registry = new OcrProviderRegistry();
  registry.register(
    "paddle",
    ({ config }) =>
      new PaddleOcrProvider({
        mode: config.mode,
        serviceUrl: config.paddleOcr.serviceUrl,
        timeoutMs: config.timeoutMs,
      }),
  );
  registry.register("openai", ({ config }) => new UnimplementedOcrProvider("openai", config.mode));
  registry.register("local", ({ config }) => new UnimplementedOcrProvider("local", config.mode));
  return registry;
}
