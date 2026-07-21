import { describe, expect, it } from "vitest";
import { clearReviewImagePreview, fitPreviewDimensions, REVIEW_IMAGE_NAME_KEY, REVIEW_IMAGE_PREVIEW_KEY } from "./review-image-preview";

describe("review image preview", () => {
  it("長辺を上限内へ縮小し、縦横比を保つ", () => {
    expect(fitPreviewDimensions(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("小さい画像は拡大しない", () => {
    expect(fitPreviewDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("保存成功時にプレビュー用の一時キーだけを削除する", () => {
    const values = new Map([[REVIEW_IMAGE_PREVIEW_KEY, "data:image/jpeg;base64,a"], [REVIEW_IMAGE_NAME_KEY, "memo.jpg"], ["other", "keep"]]);
    const storage = { removeItem: (key: string) => values.delete(key) } as Pick<Storage, "removeItem"> as Storage;
    clearReviewImagePreview(storage);
    expect([...values.entries()]).toEqual([["other", "keep"]]);
  });
});
