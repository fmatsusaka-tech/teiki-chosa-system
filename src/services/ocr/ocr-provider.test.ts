import { describe, expect, it } from "vitest";
import { createOcrRuntimeConfig } from "./config";
import { createOcrProvider, createOcrProviderSelection } from "./factory";
import { normalizeOcrError, OcrProviderError } from "./ocr-error";
import { ocrResultSchema } from "./ocr-types";
import { OcrProviderRegistry } from "./provider-registry";
import { StaticOcrProvider } from "./static-provider";

const sampleImage = new Uint8Array([1, 2, 3]);
const defaultPaddleOcr = { serviceUrl: "http://127.0.0.1:8868" };

describe("OCR runtime config", () => {
  it("uses safe defaults when OCR settings are omitted", () => {
    expect(createOcrRuntimeConfig({})).toEqual({
      mode: "economy",
      provider: "paddle",
      fallbackProviders: [],
      timeoutMs: 30_000,
      paddleOcr: defaultPaddleOcr,
    });
  });

  it("represents standard mode fallback settings", () => {
    expect(createOcrRuntimeConfig({ OCR_MODE: "standard" })).toEqual({
      mode: "standard",
      provider: "paddle",
      fallbackProviders: ["openai"],
      timeoutMs: 30_000,
      paddleOcr: defaultPaddleOcr,
    });
  });

  it("uses local provider by default in local mode", () => {
    expect(createOcrRuntimeConfig({ OCR_MODE: "local" })).toEqual({
      mode: "local",
      provider: "local",
      fallbackProviders: [],
      timeoutMs: 30_000,
      paddleOcr: defaultPaddleOcr,
    });
  });

  it("reads PaddleOCR service settings without committing absolute paths", () => {
    expect(
      createOcrRuntimeConfig({
        PADDLE_OCR_SERVICE_URL: "http://localhost:9000/",
        OCR_TIMEOUT_MS: "1500",
      }),
    ).toMatchObject({
      timeoutMs: 1500,
      paddleOcr: { serviceUrl: "http://localhost:9000" },
    });
  });

  it("rejects unknown provider names", () => {
    expect(() => createOcrRuntimeConfig({ OCR_PROVIDER: "unknown" })).toThrow(
      OcrProviderError,
    );
  });

  it("rejects invalid timeout settings", () => {
    expect(() => createOcrRuntimeConfig({ OCR_TIMEOUT_MS: "0" })).toThrow(OcrProviderError);
  });
});

describe("OCR provider factory", () => {
  it("selects a provider from the registry", () => {
    const registry = new OcrProviderRegistry();
    registry.register("openai", ({ config }) =>
      new StaticOcrProvider({ name: "openai", mode: config.mode, rawText: "品質調査" }),
    );

    const provider = createOcrProvider({
      env: { OCR_MODE: "standard", OCR_PROVIDER: "openai" },
      registry,
    });

    expect(provider.name).toBe("openai");
  });

  it("creates fallback providers without executing fallback logic", () => {
    const registry = new OcrProviderRegistry();
    registry.register("paddle", ({ config }) =>
      new StaticOcrProvider({ name: "paddle", mode: config.mode, rawText: "primary" }),
    );
    registry.register("openai", ({ config }) =>
      new StaticOcrProvider({ name: "openai", mode: config.mode, rawText: "fallback" }),
    );

    const selection = createOcrProviderSelection({ env: { OCR_MODE: "standard" }, registry });

    expect(selection.provider.name).toBe("paddle");
    expect(selection.fallbackProviders.map((provider) => provider.name)).toEqual(["openai"]);
  });
});

describe("OCR DTO and errors", () => {
  it("generates a valid common OCR DTO", async () => {
    const provider = new StaticOcrProvider({
      name: "paddle",
      mode: "economy",
      rawText: "ゆら早生\n糖度 7.3",
    });

    const result = await provider.recognize({
      image: sampleImage,
      mimeType: "image/png",
      sourceKind: "screenshot",
    });

    expect(() => ocrResultSchema.parse(result)).not.toThrow();
    expect(result.provider).toBe("paddle");
    expect(result.rawText).toContain("糖度");
    expect(result.confidence).toBeNull();
    expect(result.blocks[0]?.confidence).toBeNull();
  });

  it("keeps non-Paddle providers as unavailable stubs", async () => {
    const provider = createOcrProvider({ env: { OCR_MODE: "local" } });

    await expect(provider.checkAvailability()).resolves.toEqual({
      available: false,
      code: "PROVIDER_UNIMPLEMENTED",
      reason: "local OCR provider is configured but not implemented yet.",
    });
    await expect(
      provider.recognize({ image: sampleImage, mimeType: "image/png" }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNIMPLEMENTED", provider: "local" });
  });

  it("normalizes provider-specific errors", () => {
    const normalized = normalizeOcrError(new Error("SDK timeout"), "openai");

    expect(normalized).toBeInstanceOf(OcrProviderError);
    expect(normalized).toMatchObject({
      code: "PROVIDER_ERROR",
      provider: "openai",
      message: "SDK timeout",
    });
  });
});
