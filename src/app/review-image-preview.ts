export const REVIEW_IMAGE_PREVIEW_KEY = "ocr-review-image-preview";
export const REVIEW_IMAGE_NAME_KEY = "ocr-review-image-name";

const MAX_PREVIEW_EDGE = 1600;
const JPEG_QUALITY = 0.78;

export function fitPreviewDimensions(width: number, height: number, maxEdge = MAX_PREVIEW_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function createReviewImagePreview(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = fitPreviewDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像プレビューを作成できませんでした。");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

export function clearReviewImagePreview(storage: Storage = sessionStorage): void {
  storage.removeItem(REVIEW_IMAGE_PREVIEW_KEY);
  storage.removeItem(REVIEW_IMAGE_NAME_KEY);
}
