import { describe, expect, it, vi } from "vitest";
import { OcrProviderError } from "./ocr-error";
import { PaddleOcrProvider } from "./paddle-ocr-provider";

const sampleImage = new Uint8Array([1, 2, 3]);

function createProvider(fetchFn: typeof fetch): PaddleOcrProvider {
  return new PaddleOcrProvider({
    mode: "economy",
    serviceUrl: "http://localhost:8868/",
    timeoutMs: 100,
    fetchFn,
  });
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("PaddleOcrProvider", () => {
  it("converts PaddleOCR sidecar response into the common OCR DTO", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        lines: [
          {
            text: "ゆら早生",
            confidence: 0.91,
            boundingBox: { x: 1, y: 2, width: 30, height: 10 },
          },
          { text: "糖度 7.3", confidence: 0.82 },
        ],
        warnings: ["low contrast"],
        metadata: { model: "paddleocr-test" },
      }),
    );
    const provider = createProvider(fetchFn);

    const result = await provider.recognize({
      image: sampleImage,
      mimeType: "image/png",
      fileName: "sample.png",
      sourceKind: "screenshot",
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:8868/ocr",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.provider).toBe("paddle");
    expect(result.rawText).toBe("ゆら早生\n糖度 7.3");
    expect(result.lines.map((line) => line.text)).toEqual(["ゆら早生", "糖度 7.3"]);
    expect(result.lines[0]?.confidence).toBe(0.91);
    expect(result.lines[0]?.boundingBox).toEqual({ x: 1, y: 2, width: 30, height: 10 });
    expect(result.confidence).toBeCloseTo((0.91 + 0.82) / 2);
    expect(result.warnings).toEqual(["low contrast"]);
    expect(result.metadata).toMatchObject({
      mode: "economy",
      rawProvider: "paddleocr-http-sidecar",
      serviceUrl: "http://localhost:8868",
      model: "paddleocr-test",
    });
  });

  it("keeps confidence as null when the sidecar omits confidence", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ lines: [{ text: "横径 38.0" }] }),
    );
    const provider = createProvider(fetchFn);

    const result = await provider.recognize({ image: sampleImage, mimeType: "image/png" });

    expect(result.lines[0]?.confidence).toBeNull();
    expect(result.confidence).toBeNull();
  });

  it("returns an empty DTO for an empty OCR result", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ lines: [] }));
    const provider = createProvider(fetchFn);

    const result = await provider.recognize({ image: sampleImage, mimeType: "image/png" });

    expect(result.rawText).toBe("");
    expect(result.lines).toEqual([]);
    expect(result.blocks).toEqual([]);
    expect(result.confidence).toBeNull();
  });

  it("reports connection failure as a common OCR provider error", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = createProvider(fetchFn);

    await expect(
      provider.recognize({ image: sampleImage, mimeType: "image/png" }),
    ).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      provider: "paddle",
      message: "ECONNREFUSED",
    });
  });

  it("reports timeout as a common OCR timeout error", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    const provider = createProvider(fetchFn);

    await expect(
      provider.recognize({ image: sampleImage, mimeType: "image/png" }),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", provider: "paddle" });
  });

  it("reports invalid sidecar responses as common OCR errors", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ lines: [{ text: 123 }] }));
    const provider = createProvider(fetchFn);

    await expect(
      provider.recognize({ image: sampleImage, mimeType: "image/png" }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE", provider: "paddle" });
  });

  it("checks sidecar availability without throwing", async () => {
    const provider = createProvider(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 })));

    await expect(provider.checkAvailability()).resolves.toEqual({ available: true });
  });

  it("returns unavailable when health check fails", async () => {
    const provider = createProvider(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(provider.checkAvailability()).resolves.toEqual({
      available: false,
      code: "PROVIDER_UNAVAILABLE",
      reason: "PaddleOCR service health check failed with status 503.",
    });
  });

  it("keeps provider-specific errors wrapped", async () => {
    const error = new OcrProviderError({
      code: "PROVIDER_ERROR",
      provider: "paddle",
      message: "custom",
    });
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(error);
    const provider = createProvider(fetchFn);

    await expect(
      provider.recognize({ image: sampleImage, mimeType: "image/png" }),
    ).rejects.toBe(error);
  });
});
