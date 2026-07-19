import type { SurveyRecord } from "./types";

export const REQUIRED_SURVEY_HEADERS = [
  "登録ID",
  "計測日",
  "園地名",
  "品種",
  "処理区",
  "備考",
  "横径平均",
  "糖度",
  "酸度",
  "データ状態",
] as const;

export class SurveySheetFormatError extends Error {
  constructor(public readonly missingHeaders: string[]) {
    super(`調査データの必須見出しが不足しています: ${missingHeaders.join(", ")}`);
    this.name = "SurveySheetFormatError";
  }
}

function valueAt(row: unknown[], index: number): unknown {
  return index >= 0 && index < row.length ? row[index] : null;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    // Google Sheets serial date (1899-12-30 base).
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = asText(value);
  if (!text) return null;
  const normalized = text.replace(/年|月/g, "-").replace(/日/g, "").replace(/\//g, "-");
  const date = new Date(`${normalized}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createSurveyHeaderIndex(headers: unknown[]): Map<string, number> {
  const index = new Map<string, number>();
  headers.forEach((header, column) => {
    const name = asText(header);
    if (name && !index.has(name)) index.set(name, column);
  });
  const missing = REQUIRED_SURVEY_HEADERS.filter((header) => !index.has(header));
  if (missing.length > 0) throw new SurveySheetFormatError([...missing]);
  return index;
}

export function mapSurveyRow(row: unknown[], headerIndex: Map<string, number>): SurveyRecord | null {
  const get = (header: (typeof REQUIRED_SURVEY_HEADERS)[number]) => valueAt(row, headerIndex.get(header) ?? -1);
  const registrationId = asText(get("登録ID"));
  if (!registrationId) return null;
  const measuredAt = asDate(get("計測日"));
  if (!measuredAt) return null;

  return {
    registrationId,
    measuredAt,
    orchardName: asText(get("園地名")),
    variety: asText(get("品種")),
    treatment: asText(get("処理区")),
    note: asText(get("備考")),
    averageDiameter: asNullableNumber(get("横径平均")),
    brix: asNullableNumber(get("糖度")),
    acid: asNullableNumber(get("酸度")),
    dataStatus: asText(get("データ状態")),
  };
}

export function mapSurveyValues(values: unknown[][]): SurveyRecord[] {
  if (values.length === 0) return [];
  const headerIndex = createSurveyHeaderIndex(values[0]);
  return values.slice(1).map((row) => mapSurveyRow(row, headerIndex)).filter((row): row is SurveyRecord => row !== null);
}
