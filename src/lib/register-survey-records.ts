import type { SurveyRecord } from "../domain/survey-record";

export type RegistrationResult = {
  ok: boolean;
  registeredCount?: number;
  skippedCount?: number;
  registrationIds?: string[];
  skippedIds?: string[];
  error?: string;
};

const endpoint = process.env.NEXT_PUBLIC_GAS_WEB_APP_URL;
const token = process.env.NEXT_PUBLIC_GAS_API_TOKEN;

export function isRegistrationConfigured(): boolean {
  return Boolean(endpoint && token);
}

export async function registerSurveyRecords(
  records: SurveyRecord[],
  sourceText: string,
  operator = "",
): Promise<RegistrationResult> {
  if (!endpoint || !token) {
    throw new Error("登録先が未設定です。GASのWebアプリURLとAPIトークンを設定してください。");
  }

  const payload = {
    token,
    client: "定期調査入力アプリ",
    operator,
    sourceText,
    records: records.map((record) => ({
      registrationId: record.id ?? crypto.randomUUID(),
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
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`登録通信に失敗しました（${response.status}）。`);
  }

  const result = (await response.json()) as RegistrationResult;
  if (!result.ok) throw new Error(result.error || "登録に失敗しました。");
  return result;
}
