import {
  ocrParseResultSchema,
  type OcrParseInput,
  type OcrParseResult,
  type OcrParser,
  type ParserWarning,
} from "./parser-types";

const FIELD_LABELS = /^(調査日|園地|品種|処理区|横径|糖度|糖|酸度|酸|備考)\s*[:：]?\s*/;

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\t　]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function valueAfterLabel(line: string): string | null {
  const value = line.replace(FIELD_LABELS, "").trim();
  return value || null;
}

function parseNumber(value: string | null): number | null {
  if (value === null) return null;
  const matched = value.match(/\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : null;
}

function parseDate(value: string | null, referenceDate: Date): string | null {
  if (value === null) return null;
  const match = value.match(/(?:(\d{4})[\/-])?(\d{1,2})[\/-月](\d{1,2})(?:日)?/);
  if (!match) return null;
  const year = Number(match[1] ?? referenceDate.getUTCFullYear());
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function missingRequiredWarnings(values: {
  measuredDate: string | null;
  orchard: string | null;
  variety: string | null;
}): ParserWarning[] {
  return (Object.entries(values) as [keyof typeof values, string | null][])
    .filter(([, value]) => value === null)
    .map(([field]) => ({
      code: "MISSING_REQUIRED_FIELD" as const,
      field,
      message: `${field} could not be parsed from the OCR result.`,
    }));
}

/**
 * Provider-independent baseline parser for simple, labelled survey text.
 * Layout-specific parsing can implement OcrParser without changing callers.
 */
export class RuleBasedOcrParser implements OcrParser {
  async parse(input: OcrParseInput): Promise<OcrParseResult> {
    const lines = (input.ocrResult.lines.length > 0
      ? input.ocrResult.lines.map((line) => line.text)
      : input.ocrResult.rawText.split(/\r?\n/))
      .map(normalizeText)
      .filter(Boolean);
    const labelled = new Map<string, string>();
    const unparsedText: string[] = [];

    for (const line of lines) {
      const label = line.match(FIELD_LABELS)?.[1];
      if (label) labelled.set(label, line);
      else unparsedText.push(line);
    }

    const get = (...labels: string[]) => {
      const line = labels.map((label) => labelled.get(label)).find(Boolean);
      return line ? valueAfterLabel(line) : null;
    };
    const measuredDate = parseDate(get("調査日"), input.referenceDate ?? new Date());
    const orchard = get("園地");
    const variety = get("品種");
    const warnings = missingRequiredWarnings({ measuredDate, orchard, variety });
    if (input.ocrResult.confidence !== null && input.ocrResult.confidence < 0.7) {
      warnings.push({ code: "LOW_CONFIDENCE", message: "OCR confidence is below 0.7." });
    }
    if (unparsedText.length > 0) {
      warnings.push({ code: "UNPARSED_TEXT", message: "Some OCR text was not classified." });
    }
    const diameterText = get("横径");
    const diametersMm = diameterText
      ? Array.from(diameterText.matchAll(/\d+(?:\.\d+)?/g), (match) => Number(match[0]))
      : null;

    return ocrParseResultSchema.parse({
      candidates: [{
        measuredDate,
        orchard,
        variety,
        treatment: get("処理区"),
        diametersMm: diametersMm?.length ? diametersMm.slice(0, 10) : null,
        brix: parseNumber(get("糖度", "糖")),
        acidity: parseNumber(get("酸度", "酸")),
        notes: get("備考"),
        confidence: input.ocrResult.confidence,
        sourceText: input.ocrResult.rawText,
        unparsedText,
        warnings,
      }],
      warnings: input.ocrResult.warnings.map((message) => ({ code: "UNPARSED_TEXT", message })),
    });
  }
}
