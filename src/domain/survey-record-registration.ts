import type { SurveyRecord } from "./survey-record";

export function hasRequiredSurveyFields(record: SurveyRecord): boolean {
  return (
    record.measuredAt.trim() !== "" &&
    record.orchard.trim() !== "" &&
    record.variety.trim() !== "" &&
    record.variety !== "未設定" &&
    record.diametersMm.length >= 1 &&
    record.brix !== null
  );
}
