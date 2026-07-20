import { describe, expect, it } from "vitest";
import { MAX_OCR_IMAGE_BYTES, validateOcrImage } from "./ocr-image-input";

describe("validateOcrImage", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])("accepts %s", (type) => {
    expect(validateOcrImage({ type, size: 1024 })).toEqual({ valid: true });
  });

  it("rejects unsupported image formats", () => {
    expect(validateOcrImage({ type: "image/heic", size: 1024 })).toMatchObject({ valid: false });
  });

  it("rejects empty and oversized images", () => {
    expect(validateOcrImage({ type: "image/png", size: 0 })).toMatchObject({ valid: false });
    expect(validateOcrImage({ type: "image/png", size: MAX_OCR_IMAGE_BYTES + 1 })).toMatchObject({ valid: false });
  });
});
