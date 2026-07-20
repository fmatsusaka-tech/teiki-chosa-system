import type { ParsedSurveyBatch, SurveyRecord } from "./survey-record";
import {
  orchardMasters,
  orchardVarietyDefaults,
  varietyMasters,
  type SurveyMasterItem,
} from "./survey-masters";

const orchardNames = new Set(orchardMasters.flatMap((item) => [item.canonicalName, ...item.aliases]).map(normalizeOrchard));
const treatmentNames = new Set(["無処理区", "スキー", "ミヨビ"]);
const fullDatePattern = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/;
const shortDatePattern = /^\d{1,2}[/-]\d{1,2}$/;
const numberPattern = /^-?\d+(?:\.\d+)?$/;
const labelledMeasurementPattern = /(?:糖度|糖|酸度|酸)\s*[:：]?\s*-?\d+(?:\.\d+)?/;

function normalizeDate(value: string, registeredAt: string): string {
  const parts = value.split(/[/-]/).map(Number);
  const [year, month, day] =
    parts.length === 3
      ? parts
      : [new Date(registeredAt).getUTCFullYear(), parts[0], parts[1]];
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function normalizeOrchard(value: string): string {
  return value.replace(/[０-９]/g, (char) =>
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

function hasSugarAcidPair(tokens: string[]): boolean {
  if (tokens.length < 3) return false;
  const brixToken = tokens.at(-2) ?? "";
  const acidityToken = tokens.at(-1) ?? "";
  const brix = Number(brixToken);
  const acidity = Number(acidityToken);

  return (
    (brixToken.includes(".") || acidityToken.includes(".")) &&
    brix >= 4 &&
    brix <= 30 &&
    acidity >= 0 &&
    acidity <= 10
  );
}

function findMasterName(line: string, masters: readonly SurveyMasterItem[]): string | null {
  const normalizedFields = line
    .normalize("NFKC")
    .replace(/[、，]/g, ",")
    .split(/[,\s]+/)
    .filter(Boolean);
  const match = masters.find((item) =>
    [item.canonicalName, ...item.aliases].some((name) =>
      normalizedFields.includes(name.normalize("NFKC")),
    ),
  );
  return match?.canonicalName ?? null;
}

function parseLabelledNumber(line: string, labels: readonly string[]): number | null {
  const pattern = new RegExp(`(?:${labels.join("|")})\\s*[:：]?\\s*(-?\\d+(?:\\.\\d+)?)`);
  const match = line.match(pattern);
  return match ? Number(match[1]) : null;
}

function parseInlineSurveyLine(
  rawLine: string,
  measuredAt: string,
  registeredAt: string,
): SurveyRecord | null {
  const line = rawLine.normalize("NFKC").replace(/[、，]/g, ",").trim();
  const knownOrchard = findMasterName(line, orchardMasters);
  const hasMeasurementLabel = /(?:糖度|糖|酸度|酸)/.test(line);
  const textAfterKnownOrchard = knownOrchard ? line.replace(knownOrchard, "") : line;
  if (!hasMeasurementLabel && (!knownOrchard || !/\d/.test(textAfterKnownOrchard))) return null;

  const leadingFields = line.includes(",")
    ? line.split(",").map((part) => part.trim()).filter(Boolean)
    : line.split(/\s+/).filter(Boolean);
  const orchard = knownOrchard ?? leadingFields[0] ?? "";
  if (!orchard || numberPattern.test(orchard) || /^(?:糖度|糖|酸度|酸)/.test(orchard)) return null;

  const knownVariety = findMasterName(line, varietyMasters);
  const secondField = leadingFields[1];
  const possibleVariety = secondField &&
    !secondField.includes(orchard) &&
    !numberPattern.test(secondField) &&
    !/^-?\d/.test(secondField) &&
    !/(?:糖度|糖|酸度|酸)/.test(secondField) &&
    !treatmentNames.has(secondField)
      ? secondField
      : null;
  const variety = knownVariety ?? possibleVariety ?? orchardVarietyDefaults[orchard] ?? "未設定";
  const treatment = [...treatmentNames].find((name) => line.includes(name)) ?? null;
  const firstMeasurementLabel = hasMeasurementLabel ? line.search(/(?:糖度|糖|酸度|酸)/) : -1;
  const diameterSection = firstMeasurementLabel >= 0 ? line.slice(0, firstMeasurementLabel) : line;
  const prefixWithoutNames = [orchard, variety, treatment]
    .filter((value): value is string => Boolean(value))
    .reduce((value, name) => value.replace(name, " "), diameterSection);
  const normalizedDiameterSection = prefixWithoutNames.replace(/(?<=\d)-(?=\d)/g, " ");
  const diameterTokens = Array.from(
    normalizedDiameterSection.matchAll(/-?\d+(?:\.\d+)?/g),
    (match) => match[0],
  );
  const warnings: string[] = [];
  const diametersMm = diameterTokens.map((token) => {
    const parsed = parseDiameter(token);
    if (parsed.warning) warnings.push(parsed.warning);
    return parsed.value;
  });
  const brix = parseLabelledNumber(line, ["糖度", "糖"]);
  const acidity = parseLabelledNumber(line, ["酸度", "酸"]);

  const notes = line
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.includes(orchard))
    .filter((part) => !part.includes(variety))
    .filter((part) => !treatment || !part.includes(treatment))
    .filter((part) => !labelledMeasurementPattern.test(part))
    .filter((part) => !/^-?\d+(?:\.\d+)?(?:\s*[-ー]\s*-?\d+(?:\.\d+)?)*$/.test(part))
    .join("・");

  if (variety === "未設定") warnings.push("品種を特定できませんでした");
  if (!knownOrchard) warnings.push(`園地「${orchard}」はマスターに登録されていません`);
  if (!knownVariety && variety !== "未設定" && orchardVarietyDefaults[orchard] !== variety) {
    warnings.push(`品種「${variety}」はマスターに登録されていません`);
  }
  if (diametersMm.length < 5) warnings.push(`横径が${diametersMm.length}個です`);
  if (brix === null) warnings.push("糖度が未入力です");
  if (acidity === null) warnings.push("酸度が未入力です");

  return {
    measuredAt,
    registeredAt,
    orchard,
    variety,
    treatment,
    diametersMm,
    brix,
    acidity,
    notes,
    source: "text",
    confidence: warnings.length === 0 ? 1 : 0.8,
    warnings,
  };
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
  let currentNotes: string[] = [];
  let numericLines: string[] = [];
  const records: SurveyRecord[] = [];
  const batchWarnings: string[] = [];

  const flush = () => {
    if (!currentOrchard || numericLines.length === 0) return;

    const warnings: string[] = [];
    const sugarAcidPresent = hasSugarAcidPair(numericLines);
    const brix = sugarAcidPresent ? Number(numericLines.at(-2)) : null;
    const acidity = sugarAcidPresent ? Number(numericLines.at(-1)) : null;
    const diameterTokens = sugarAcidPresent ? numericLines.slice(0, -2) : numericLines;
    const diametersMm = diameterTokens.map((token) => {
      const parsed = parseDiameter(token);
      if (parsed.warning) warnings.push(parsed.warning);
      return parsed.value;
    });

    const variety = orchardVarietyDefaults[currentOrchard] ?? "未設定";
    if (variety === "未設定") warnings.push("品種を特定できませんでした");
    if (diametersMm.length < 5) warnings.push(`横径が${diametersMm.length}個です`);
    if (brix === null) warnings.push("糖度が未入力です");
    if (acidity === null) warnings.push("酸度が未入力です");

    const notes = [currentTreatment, ...currentNotes].filter(Boolean).join("・");

    records.push({
      measuredAt,
      registeredAt,
      orchard: currentOrchard,
      variety,
      diametersMm,
      brix,
      acidity,
      notes,
      source: "text",
      confidence: warnings.length === 0 ? 1 : 0.8,
      warnings,
    });

    numericLines = [];
    currentNotes = [];
  };

  for (const line of lines) {
    if (fullDatePattern.test(line) || shortDatePattern.test(line)) {
      measuredAt = normalizeDate(line, registeredAt);
      continue;
    }

    const inlineRecord = parseInlineSurveyLine(line, measuredAt, registeredAt);
    if (inlineRecord) {
      flush();
      records.push(inlineRecord);
      currentOrchard = "";
      currentTreatment = "";
      currentNotes = [];
      numericLines = [];
      continue;
    }

    if (treatmentNames.has(line)) {
      if (numericLines.length > 0) flush();
      currentTreatment = line;
      continue;
    }

    if (numberPattern.test(line)) {
      numericLines.push(line);
      continue;
    }

    const normalized = normalizeOrchard(line);
    if (orchardNames.has(normalized)) {
      flush();
      currentOrchard = normalized;
      currentTreatment = "";
      currentNotes = [];
      continue;
    }

    if (currentOrchard) {
      currentNotes.push(line);
    } else {
      batchWarnings.push(`「${line}」を園地名として認識できませんでした`);
    }
  }

  flush();

  return { records, sourceText, batchWarnings };
}
