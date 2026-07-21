import { parseSurveyMemo } from "../../domain/parse-survey-memo";
import { orchardMasters, varietyMasters } from "../../domain/survey-masters";
import {
  ocrParseResultSchema,
  type OcrParseInput,
  type OcrParseResult,
  type OcrParser,
  type ParserWarning,
} from "./parser-types";
import { RuleBasedOcrParser } from "./rule-based-ocr-parser";

function warning(message: string): ParserWarning {
  return { code: "UNPARSED_TEXT", message };
}

const orchardNames = new Set(
  orchardMasters.flatMap((item) => [item.canonicalName, ...item.aliases]).map((name) => name.normalize("NFKC")),
);
const varietyNames = new Set(
  varietyMasters.flatMap((item) => [item.canonicalName, ...item.aliases]).map((name) => name.normalize("NFKC")),
);

function normalizeDateLine(line: string): string | null {
  const normalized = line.normalize("NFKC").trim();
  const standard = normalized.match(/^(\d{1,2})[/.\-](\d{1,2})$/);
  if (standard) return `${Number(standard[1])}/${Number(standard[2])}`;

  // OCR can drop the slash in M/DD and recognize it as the digit 1 (e.g. 7/21 -> 7121).
  const slashAsOne = normalized.match(/^([1-9]|1[0-2])1([0-3]\d)$/);
  return slashAsOne ? `${Number(slashAsOne[1])}/${Number(slashAsOne[2])}` : null;
}

function surveySection(rawText: string, referenceDate: Date): string {
  const lines = rawText.split(/\r?\n/).map((line) => line.normalize("NFKC").trim()).filter(Boolean);
  const orchardIndex = lines.findIndex((line) => orchardNames.has(line));

  // Unknown/new orchards are intentionally left to the existing parser and user correction flow.
  if (orchardIndex < 0) return rawText;

  const date = lines.slice(0, orchardIndex).reverse().map(normalizeDateLine).find(Boolean);
  const surveyLines = lines.slice(orchardIndex).filter((line) => !/^[\-–—]+$/.test(line));
  if (surveyLines[1] && varietyNames.has(surveyLines[1])) surveyLines.splice(1, 1);
  const datedLine = date ? `${referenceDate.getUTCFullYear()}/${date}` : null;
  return [...(datedLine ? [datedLine] : []), ...surveyLines].join("\n");
}

export class SurveyMemoOcrParser implements OcrParser {
  constructor(private readonly fallback: OcrParser = new RuleBasedOcrParser()) {}

  async parse(input: OcrParseInput): Promise<OcrParseResult> {
    const sourceText = input.ocrResult.rawText.trim();
    if (!sourceText) return this.fallback.parse(input);

    const referenceDate = input.referenceDate ?? new Date();
    const batch = parseSurveyMemo(surveySection(sourceText, referenceDate), referenceDate.toISOString());
    if (batch.records.length === 0) return this.fallback.parse(input);

    const confidenceWarning = input.ocrResult.confidence !== null && input.ocrResult.confidence < 0.7
      ? [{ code: "LOW_CONFIDENCE" as const, message: "OCRの認識信頼度が低いため、内容を確認してください。" }]
      : [];
    const providerWarnings = input.ocrResult.warnings.map(warning);
    const handwrittenWarning = input.ocrResult.metadata.sourceKind === "handwritten"
      ? [{ code: "LOW_CONFIDENCE" as const, message: "手書きメモの認識結果です。数字と園地名を原画像と照合してください。" }]
      : [];

    return ocrParseResultSchema.parse({
      candidates: batch.records.map((record) => ({
        measuredDate: record.measuredAt ? record.measuredAt.slice(0, 10) : null,
        orchard: record.orchard || null,
        variety: record.variety === "未設定" ? null : record.variety,
        treatment: record.treatment ?? null,
        diametersMm: record.diametersMm.length > 0 ? record.diametersMm.slice(0, 10) : null,
        brix: record.brix,
        acidity: record.acidity,
        notes: record.notes || null,
        confidence: input.ocrResult.confidence,
        sourceText,
        unparsedText: batch.batchWarnings,
        warnings: [...record.warnings.map(warning), ...confidenceWarning, ...handwrittenWarning],
      })),
      warnings: providerWarnings,
    });
  }
}
