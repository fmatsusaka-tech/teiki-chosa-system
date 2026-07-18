import type { SurveyRecord } from "./survey-record";

export const MAX_DIAMETER_COUNT = 20;

export type RegistrationPayload = {
  measuredAt: string;
  registeredAt: string;
  orchard: string;
  variety: string;
  notes: string;
  diametersMm: Array<number | null>;
  diameterAverageMm: number | null;
  brix: number | null;
  acidity: number | null;
  source: SurveyRecord["source"];
  warnings: string[];
};

export function buildRegistrationPayload(record: SurveyRecord): RegistrationPayload {
  const normalizedDiameters = Array.from({ length: MAX_DIAMETER_COUNT }, (_, index) =>
    record.diametersMm[index] ?? null,
  );
  const diameterAverageMm = record.diametersMm.length === 0
    ? null
    : record.diametersMm.reduce((sum, value) => sum + value, 0) / record.diametersMm.length;

  return {
    measuredAt: record.measuredAt,
    registeredAt: record.registeredAt,
    orchard: record.orchard,
    variety: record.variety,
    notes: record.notes,
    diametersMm: normalizedDiameters,
    diameterAverageMm,
    brix: record.brix,
    acidity: record.acidity,
    source: record.source,
    warnings: [...record.warnings],
  };
}
