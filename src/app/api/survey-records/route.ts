import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSurveyRecordFromOcr } from "../../../domain/build-survey-record-from-ocr";
import { buildCorrectionEvents, correctionSnapshotFromCandidate } from "../../../domain/correction-history";
import { saveCorrectionEvents } from "../../../services/correction-history-persistence";
import {
  DEFAULT_SURVEY_SPREADSHEET_ID,
  GoogleSheetsRestClient, GoogleSheetsSurveyRecordPersistence, saveSurveyRecords,
  SurveyRecordPersistenceError,
} from "../../../services/survey-record-persistence";
import { surveyRecordsRequestSchema } from "./request-schema";

export async function POST(request: Request) {
  try {
    const body = surveyRecordsRequestSchema.parse(await request.json());
    const now = new Date().toISOString();
    const records = body.candidates.map((candidate) => buildSurveyRecordFromOcr(candidate, {
      registeredAt: now, source: body.sourceKind,
    }));
    const sourceText = body.candidates.map((candidate) => candidate.sourceText).filter(Boolean).join("\n---\n");
    const client = GoogleSheetsRestClient.fromEnvironment();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SURVEY_SPREADSHEET_ID;
    const persistence = new GoogleSheetsSurveyRecordPersistence(client, {
      spreadsheetId,
      sheetName: "調査原票",
      origin: "OCR確認画面",
      sourceText,
    });
    const saved = await saveSurveyRecords(persistence, records);
    const corrections = buildCorrectionEvents({
      before: body.originalCandidates.map(correctionSnapshotFromCandidate),
      after: body.candidates.map(correctionSnapshotFromCandidate),
      sourceKind: body.sourceKind,
      recordedAt: now,
    });
    try {
      await saveCorrectionEvents({ client, spreadsheetId, events: corrections });
    } catch (correctionError) {
      console.error("補正履歴の保存に失敗しました。調査原票は保存済みです。", correctionError);
    }
    return NextResponse.json({ ...saved, correctionCount: corrections.length });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "保存前の確認内容が不正です。" }, { status: 400 });
    const message = error instanceof SurveyRecordPersistenceError ? error.message : "調査データの保存に失敗しました。";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
