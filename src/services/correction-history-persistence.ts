import type { CorrectionEvent } from "../domain/correction-history";
import type { GoogleSheetsClient } from "./survey-record-persistence/google-sheets-client";
import { SurveyRecordPersistenceError } from "./survey-record-persistence/persistence-error";

export const CORRECTION_HISTORY_SHEET_NAME = "補正履歴";
export const CORRECTION_HISTORY_HEADERS = [
  "補正ID", "記録日時", "入力方法", "候補番号", "項目", "補正前", "補正後", "辞書候補",
] as const;

export async function saveCorrectionEvents(params: {
  client: GoogleSheetsClient;
  spreadsheetId: string;
  events: readonly CorrectionEvent[];
  sheetName?: string;
}): Promise<void> {
  if (params.events.length === 0) return;
  const sheetName = params.sheetName ?? CORRECTION_HISTORY_SHEET_NAME;
  const headers = await params.client.getHeaderRow(params.spreadsheetId, sheetName);
  if (headers.join("\t") !== CORRECTION_HISTORY_HEADERS.join("\t")) {
    throw new SurveyRecordPersistenceError("PROVIDER_ERROR", `シート「${sheetName}」の見出しが補正履歴仕様と一致しません。`);
  }
  await params.client.appendRows({
    spreadsheetId: params.spreadsheetId,
    sheetName,
    rows: params.events.map((event) => [
      event.id, event.recordedAt, event.sourceKind, event.candidateIndex + 1, event.field,
      event.beforeValue, event.afterValue, event.dictionaryEligible ? "対象" : "監査のみ",
    ]),
  });
}
