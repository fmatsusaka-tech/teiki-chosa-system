import { OcrProviderError } from "./ocr-error";
import type { OcrProvider } from "./ocr-provider";
import type { OcrMode, OcrProviderName } from "./ocr-types";
import { PaddleOcrProvider } from "./paddle-ocr-provider";
import { UnimplementedOcrProvider } from "./unimplemented-provider";

export type OcrProviderFactory = (params: { mode: OcrMode }) => OcrProvider;

export class OcrProviderRegistry {
  private readonly factories = new Map<OcrProviderName, OcrProviderFactory>();

  register(name: OcrProviderName, factory: OcrProviderFactory): void {
    this.factories.set(name, factory);
  }

  resolve(name: OcrProviderName, mode: OcrMode): OcrProvider {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new OcrProviderError({
        code: "UNKNOWN_PROVIDER",
        provider: name,
        message: `OCR provider is not registered: ${name}`,
      });
    }
    return factory({ mode });
  }

  listProviderNames(): OcrProviderName[] {
    return Array.from(this.factories.keys());
  }
}

export function createDefaultOcrProviderRegistry(
  env: Record<string, string | undefined> = process.env,
): OcrProviderRegistry {
  const registry = new OcrProviderRegistry();
  registry.register("paddle", ({ mode }) => PaddleOcrProvider.fromEnvironment(mode, env));
  registry.register("openai", ({ mode }) => new UnimplementedOcrProvider("openai", mode));
  registry.register("local", ({ mode }) => new UnimplementedOcrProvider("local", mode));
  return registry;
}
