import type { ParsedSurveyBatch, SurveyRecord } from "./survey-record";

const orchardVarieties: Record<string, string> = {
  有中: "ゆら早生",
  吉川: "ゆら早生",
  なる1: "ゆら早生",
  なる１: "ゆら早生",
  なる2: "早生",
  なる２: "早生",
  上中島: "早生",
  下町: "早生",
  徳田: "早生",
};

const treatmentNames = new Set(["無処理区", "スキー", "ミヨビ"]);
const datePattern = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/;
const numberPattern = /^-?\d+(?:\.\d+)?$/;

function normalizeDate(value: string): string {
  const [year, month, day] = value.split(/[/-]/).map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function normalizeOrchard(value: string): string {
  return value.replace(/[１-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

function parseDiameter(raw: string): { value: number; warning?: string } {
  const numeric = Number(raw);

  if (raw.startsWith("-") && Math.abs(numeric) >= 100) {
    return {
      value: Math.abs(numeric) / 10,
      warning: `${raw} は負の横径として不自然なため ${Math.abs(numeric) / 10}mm と推定しました`,
    };
  }

  if (Number.isInteger(numeric) && Math.abs(numeric) >= 100) {
    return { value: numeric / 10 };
  }

  return { value: numeric };
}

export function parseSurveyMemo(
  sourceText: string,
  registeredAt = new Date().toISOString(),
): ParsedSurveyBatch {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let measuredAt = registeredAt;
  let currentOrchard = "";
  let currentTreatment = "";
  let numericLines: string[] = [];
  const records: SurveyRecord[] = [];
  const batchWarnings: string[] = [];

  const flush = () => {
    if (!currentOrchard || numericLines.length === 0) return;

    const warnings: string[] = [];
    const values = numericLines.map(Number);

    if (values.length < 3) {
      batchWarnings.push(`${currentOrchard} は数値が不足しているため解析できませんでした`);
      numericLines = [];
      return;
    }

    const brix = values.at(-2) ?? null;
    const acidity = values.at(-1) ?? null;
    const diameterTokens = numericLines.slice(0, -2);
    const diametersMm = diameterTokens.map((token) => {
      const parsed = parseDiameter(token);
      if (parsed.warning) warnings.push(parsed.warning);
      return parsed.value;
    });

    const variety = orchardVarieties[currentOrchard] ?? "未設定";
    if (variety === "未設定") warnings.push("品種を特定できませんでした");
    if (diametersMm.length < 5) warnings.push(`横径が${diametersMm.length}個です`);

    records.push({
      measuredAt,
      registeredAt,
      orchard: currentOrchard,
      variety,
      diametersMm,
      brix,
      acidity,
      notes: currentTreatment,
      source: "text",
      confidence: warnings.length === 0 ? 1 : 0.8,
      warnings,
    });

    numericLines = [];
  };

  for (const line of lines) {
    if (datePattern.test(line)) {
      measuredAt = normalizeDate(line);
      continue;
    }

    if (treatmentNames.has(line)) {
      currentTreatment = line;
      continue;
    }

    if (numberPattern.test(line)) {
      numericLines.push(line);
      continue;
    }

    flush();
    currentOrchard = normalizeOrchard(line);
    currentTreatment = "";
  }

  flush();

  return { records, sourceText, batchWarnings };
}
