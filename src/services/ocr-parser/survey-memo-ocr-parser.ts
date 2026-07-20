import { parseSurveyMemo } from "../../domain/parse-survey-memo";
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

export class SurveyMemoOcrParser implements OcrParser {
  constructor(private readonly fallback: OcrParser = new RuleBasedOcrParser()) {}

  async parse(input: OcrParseInput): Promise<OcrParseResult> {
    const sourceText = input.ocrResult.rawText.trim();
    if (!sourceText) return this.fallback.parse(input);

    const referenceDate = input.referenceDate ?? new Date();
    const batch = parseSurveyMemo(sourceText, referenceDate.toISOString());
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
