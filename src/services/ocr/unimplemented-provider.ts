import { OcrProviderError } from "./ocr-error";
import type { OcrProvider } from "./ocr-provider";
import type { OcrAvailability, OcrInput, OcrMode, OcrProviderName, OcrResult } from "./ocr-types";

export class UnimplementedOcrProvider implements OcrProvider {
  readonly name: OcrProviderName;
  private readonly mode: OcrMode;

  constructor(name: OcrProviderName, mode: OcrMode) {
    this.name = name;
    this.mode = mode;
  }

  async checkAvailability(): Promise<OcrAvailability> {
    return {
      available: false,
      code: "PROVIDER_UNIMPLEMENTED",
      reason: `${this.name} OCR provider is configured but not implemented yet.`,
    };
  }

  async recognize(input: OcrInput): Promise<OcrResult> {
    void input;
    throw new OcrProviderError({
      code: "PROVIDER_UNIMPLEMENTED",
      provider: this.name,
      message: `${this.name} OCR provider is not implemented yet for ${this.mode} mode.`,
    });
  }
}
