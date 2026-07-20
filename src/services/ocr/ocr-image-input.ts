export const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_OCR_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type OcrImageValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export function validateOcrImage(input: { type: string; size: number }): OcrImageValidationResult {
  if (!SUPPORTED_OCR_IMAGE_TYPES.includes(input.type as (typeof SUPPORTED_OCR_IMAGE_TYPES)[number])) {
    return { valid: false, message: "PNG、JPEG、WebPの画像を選択してください。" };
  }
  if (input.size <= 0) return { valid: false, message: "画像ファイルが空です。" };
  if (input.size > MAX_OCR_IMAGE_BYTES) {
    return { valid: false, message: "画像サイズは10MB以下にしてください。" };
  }
  return { valid: true };
}
