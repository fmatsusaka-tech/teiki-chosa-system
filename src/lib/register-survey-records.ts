import type { SurveyRecord } from "../domain/survey-record";
import { buildCorrectionEvents, correctionSnapshotFromRecord } from "../domain/correction-history";

export type RegistrationResult = {
  ok: boolean;
  registeredCount?: number;
  skippedCount?: number;
  skippedIds?: string[];
  message?: string;
  error?: string;
};

const DEFAULT_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxPLpa_VKfPueCEjTMEM4-QbotW6nbGnbyk4KqBWJSMn4aRqFLx-9kheb4jxCeAWPk/exec";

const endpoint = process.env.NEXT_PUBLIC_GAS_WEB_APP_URL || DEFAULT_ENDPOINT;

export async function registerSurveyRecords(
  records: SurveyRecord[],
  sourceText: string,
  operator = "",
  originalRecords: readonly (SurveyRecord | null)[] = [],
  correctedRecords: readonly SurveyRecord[] = records,
): Promise<RegistrationResult> {
  const corrections = buildCorrectionEvents({
    before: originalRecords.map((record) => record ? correctionSnapshotFromRecord(record) : null),
    after: correctedRecords.map(correctionSnapshotFromRecord),
    sourceKind: "text",
    recordedAt: new Date().toISOString(),
  });
  const payload = {
    records: records.map((record) => ({
      id: record.id,
      measuredAt: record.measuredAt,
      orchard: record.orchard,
      variety: record.variety,
      treatment: "",
      notes: record.notes,
      diametersMm: record.diametersMm,
      brix: record.brix,
      acidity: record.acidity,
      source: record.source,
    })),
    operator,
    origin: window.location.href,
    sourceText,
    corrections,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`登録通信に失敗しました（${response.status}）。`);
  }

  const result = (await response.json()) as RegistrationResult;
  if (!result.ok) throw new Error(result.message || result.error || "登録に失敗しました。");
  return result;
}
