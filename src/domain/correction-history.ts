import type { SurveyRecord } from "./survey-record";
import type { SurveyParseCandidate } from "../services/ocr-parser";

export const CORRECTION_FIELDS = [
  "measuredDate", "orchard", "variety", "treatment", "diametersMm", "brix", "acidity", "notes",
] as const;
export type CorrectionField = typeof CORRECTION_FIELDS[number];

export type CorrectionSnapshot = Record<CorrectionField, string | number | number[] | null>;

export type CorrectionEvent = {
  id: string;
  recordedAt: string;
  sourceKind: "text" | "photo" | "screenshot" | "handwritten";
  candidateIndex: number;
  field: CorrectionField;
  beforeValue: string;
  afterValue: string;
  dictionaryEligible: boolean;
};

const DICTIONARY_FIELDS = new Set<CorrectionField>(["orchard", "variety", "treatment"]);

function dateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

export function correctionSnapshotFromCandidate(candidate: SurveyParseCandidate): CorrectionSnapshot {
  return {
    measuredDate: candidate.measuredDate,
    orchard: candidate.orchard,
    variety: candidate.variety,
    treatment: candidate.treatment,
    diametersMm: candidate.diametersMm,
    brix: candidate.brix,
    acidity: candidate.acidity,
    notes: candidate.notes,
  };
}

export function correctionSnapshotFromRecord(record: SurveyRecord): CorrectionSnapshot {
  return {
    measuredDate: dateOnly(record.measuredAt),
    orchard: record.orchard || null,
    variety: record.variety || null,
    treatment: record.treatment ?? null,
    diametersMm: record.diametersMm,
    brix: record.brix,
    acidity: record.acidity,
    notes: record.notes || null,
  };
}

function serialized(value: CorrectionSnapshot[CorrectionField]): string {
  return value === null ? "" : Array.isArray(value) ? JSON.stringify(value) : String(value);
}

export function buildCorrectionEvents(params: {
  before: readonly (CorrectionSnapshot | null)[];
  after: readonly CorrectionSnapshot[];
  sourceKind: CorrectionEvent["sourceKind"];
  recordedAt: string;
  createId?: () => string;
}): CorrectionEvent[] {
  const createId = params.createId ?? (() => crypto.randomUUID());
  return params.after.flatMap((after, candidateIndex) => {
    const before = params.before[candidateIndex];
    if (!before) return [];
    return CORRECTION_FIELDS.flatMap((field) => {
      const beforeValue = serialized(before[field]);
      const afterValue = serialized(after[field]);
      if (beforeValue === afterValue) return [];
      return [{
        id: createId(), recordedAt: params.recordedAt, sourceKind: params.sourceKind,
        candidateIndex, field, beforeValue, afterValue,
        dictionaryEligible: DICTIONARY_FIELDS.has(field) && beforeValue !== "" && afterValue !== "",
      }];
    });
  });
}
