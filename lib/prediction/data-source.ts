import { readSpreadsheetValues } from "../google/google-sheets-reader";
import { parseLegacyPredictionModelTable } from "./model-table";
import { mapSurveyValues } from "./survey-row";
import type { PredictionMetric, PredictionModelCurve, SurveyRecord } from "./types";

export const DEFAULT_SURVEY_SPREADSHEET_ID = "1Ix7qFigeUvmxkEl3C51rmzuBzYDq7OR_ZGHq6GUKa0g";
export const DEFAULT_PREDICTION_SPREADSHEET_ID = "1HntOF58ADSN_mjx3JIBxnoi3JgjoLA9zB55qRpOurKU";
export const SURVEY_DATA_RANGE = "'調査データ'!A:W";
export const LEGACY_MODEL_RANGE = "AG15:AX200";

const MODEL_SHEETS: ReadonlyArray<{ metric: PredictionMetric; sheetName: string }> = [
  { metric: "diameter", sheetName: "横径予測" },
  { metric: "brix", sheetName: "糖度予測" },
  { metric: "acid", sheetName: "酸度予測" },
];

function resolveSpreadsheetId(envKey: string, fallback: string, env: NodeJS.ProcessEnv): string {
  return env[envKey]?.trim() || fallback;
}

export async function loadSurveyRecords(params?: {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
}): Promise<SurveyRecord[]> {
  const env = params?.env ?? process.env;
  const values = await readSpreadsheetValues({
    spreadsheetId: resolveSpreadsheetId("SURVEY_DATA_SPREADSHEET_ID", DEFAULT_SURVEY_SPREADSHEET_ID, env),
    range: SURVEY_DATA_RANGE,
    env,
    fetch: params?.fetch,
  });
  return mapSurveyValues(values);
}

export async function loadPredictionCurves(params?: {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
  version?: string;
}): Promise<PredictionModelCurve[]> {
  const env = params?.env ?? process.env;
  const spreadsheetId = resolveSpreadsheetId(
    "PREDICTION_MODEL_SPREADSHEET_ID",
    DEFAULT_PREDICTION_SPREADSHEET_ID,
    env,
  );
  const version = params?.version ?? `sheet:${spreadsheetId}`;
  const curveGroups = await Promise.all(MODEL_SHEETS.map(async ({ metric, sheetName }) => {
    const values = await readSpreadsheetValues({
      spreadsheetId,
      range: `'${sheetName}'!${LEGACY_MODEL_RANGE}`,
      env,
      fetch: params?.fetch,
    });
    return parseLegacyPredictionModelTable({ metric, values, version });
  }));
  return curveGroups.flat();
}
