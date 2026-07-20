import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSurveyRecordFromOcr } from "../../../domain/build-survey-record-from-ocr";
import {
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
    const persistence = new GoogleSheetsSurveyRecordPersistence(GoogleSheetsRestClient.fromEnvironment(), {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      sheetName: "調査原票",
      origin: "OCR確認画面",
      sourceText,
    });
    return NextResponse.json(await saveSurveyRecords(persistence, records));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "保存前の確認内容が不正です。" }, { status: 400 });
    const message = error instanceof SurveyRecordPersistenceError ? error.message : "調査データの保存に失敗しました。";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
