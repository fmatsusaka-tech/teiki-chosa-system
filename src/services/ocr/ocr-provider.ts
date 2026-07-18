import type { OcrAvailability, OcrInput, OcrProviderName, OcrResult } from "./ocr-types";

export interface OcrProvider {
  readonly name: OcrProviderName;
  checkAvailability(): Promise<OcrAvailability>;
  recognize(input: OcrInput): Promise<OcrResult>;
}
