import { describe, expect, it, vi } from "vitest";
import type { SurveyRecord } from "../../domain/survey-record";
import { SurveyRecordPersistenceError } from "./persistence-error";
import type { SurveyRecordPersistence } from "./persistence-types";
import { saveSurveyRecords } from "./save-survey-records";
import { UnavailableSurveyRecordPersistence } from "./unavailable-persistence";

const record: SurveyRecord = {
  id: "2bd1ae56-2c98-4b0a-a946-d34786bc37dc",
  measuredAt: "2026-07-19T00:00:00.000Z",
  registeredAt: "2026-07-19T01:00:00.000Z",
  orchard: "徳田",
  variety: "早生",
  diametersMm: [],
  brix: null,
  acidity: null,
  notes: "",
  source: "screenshot",
  confidence: null,
  warnings: [],
};

describe("saveSurveyRecords", () => {
  it("validates and delegates confirmed records to the persistence provider", async () => {
    const save = vi.fn().mockResolvedValue({ savedCount: 1, recordIds: [record.id] });
    const persistence: SurveyRecordPersistence = { save };

    await expect(saveSurveyRecords(persistence, [record])).resolves.toEqual({
      savedCount: 1,
      recordIds: [record.id],
    });
    expect(save).toHaveBeenCalledWith([record]);
  });

  it("preserves missing optional measurements as null or an empty array", async () => {
    const save = vi.fn().mockResolvedValue({ savedCount: 1, recordIds: [] });

    await saveSurveyRecords({ save }, [record]);

    expect(save.mock.calls[0][0][0]).toMatchObject({
      diametersMm: [],
      brix: null,
      acidity: null,
    });
  });

  it("rejects an empty batch before calling the provider", async () => {
    const save = vi.fn();

    await expect(saveSurveyRecords({ save }, [])).rejects.toMatchObject({ code: "INVALID_RECORDS" });
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects records with missing required fields before calling the provider", async () => {
    const save = vi.fn();
    const invalidRecord = { ...record, orchard: "" };

    await expect(saveSurveyRecords({ save }, [invalidRecord])).rejects.toMatchObject({
      code: "INVALID_RECORDS",
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("reports an unavailable provider with the common persistence error", async () => {
    await expect(saveSurveyRecords(new UnavailableSurveyRecordPersistence(), [record])).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("normalizes provider-specific errors without exposing their message", async () => {
    const providerError = new Error("Google Sheets specific failure");
    const promise = saveSurveyRecords({ save: vi.fn().mockRejectedValue(providerError) }, [record]);

    await expect(promise).rejects.toMatchObject({
      name: "SurveyRecordPersistenceError",
      code: "PROVIDER_ERROR",
      message: "調査データの保存に失敗しました。",
      cause: providerError,
    } satisfies Partial<SurveyRecordPersistenceError>);
  });
});
