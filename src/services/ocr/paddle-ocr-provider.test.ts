import { describe, expect, it, vi } from "vitest";
import { PaddleOcrProvider } from "./paddle-ocr-provider";

describe("PaddleOcrProvider", () => {
  it("maps sidecar lines to the common OCR result", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
      lines: [
        { text: "ゆら早生", confidence: 0.9, boundingBox: { x: 1, y: 2, width: 30, height: 10 } },
        { text: "糖度 7.3", confidence: null },
      ],
      elapsedMs: 25,
      model: "PP-OCRv4",
    }), { status: 200 }));
    const provider = new PaddleOcrProvider({
      endpoint: "http://localhost:8765/",
      timeoutMs: 1000,
      mode: "economy",
      fetch,
    });

    const result = await provider.recognize({
      image: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      fileName: "survey.png",
      sourceKind: "handwritten",
    });

    expect(result.rawText).toBe("ゆら早生\n糖度 7.3");
    expect(result.confidence).toBe(0.9);
    expect(result.lines[0]?.boundingBox).toEqual({ x: 1, y: 2, width: 30, height: 10 });
    expect(fetch).toHaveBeenCalledWith("http://localhost:8765/ocr", expect.objectContaining({
      method: "POST",
    }));
    const request = fetch.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({ sourceKind: "handwritten" });
    expect(result.metadata.sourceKind).toBe("handwritten");
  });

  it("reports an unavailable sidecar without throwing", async () => {
    const provider = new PaddleOcrProvider({
      endpoint: "http://localhost:8765",
      timeoutMs: 1000,
      mode: "economy",
      fetch: vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("connection refused")),
    });

    await expect(provider.checkAvailability()).resolves.toEqual({
      available: false,
      code: "PROVIDER_UNAVAILABLE",
      reason: "connection refused",
    });
  });

  it("normalizes malformed sidecar output as a provider error", async () => {
    const provider = new PaddleOcrProvider({
      endpoint: "http://localhost:8765",
      timeoutMs: 1000,
      mode: "economy",
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(JSON.stringify({ lines: [{ text: "invalid", confidence: 2 }] })),
      ),
    });

    await expect(provider.recognize({
      image: new Uint8Array([1]),
      mimeType: "image/jpeg",
    })).rejects.toMatchObject({ code: "PROVIDER_ERROR", provider: "paddle" });
  });

  it("rejects non-image input and unknown timeout settings", async () => {
    const provider = new PaddleOcrProvider({
      endpoint: "http://localhost:8765",
      timeoutMs: 1000,
      mode: "economy",
    });
    await expect(provider.recognize({
      image: new Uint8Array(),
      mimeType: "application/pdf",
    })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(() => PaddleOcrProvider.fromEnvironment("economy", {
      PADDLE_OCR_TIMEOUT_MS: "unknown",
    })).toThrow(/positive integer/);
  });
});
