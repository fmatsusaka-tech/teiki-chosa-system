import type { SurveyRecord } from "./survey-record";

export function hasRequiredSurveyFields(record: SurveyRecord): boolean {
  return (
    record.orchard.trim() !== "" &&
    record.variety.trim() !== "" &&
    record.variety !== "未設定" &&
    record.diametersMm.length >= 1 &&
    record.brix !== null
  );
}

export function applyRegistrationDate(
  record: SurveyRecord,
  registeredAt = new Date(),
): SurveyRecord {
  if (record.measuredAt.trim() !== "") return record;

  const year = registeredAt.getFullYear();
  const month = String(registeredAt.getMonth() + 1).padStart(2, "0");
  const day = String(registeredAt.getDate()).padStart(2, "0");

  return {
    ...record,
    measuredAt: `${year}-${month}-${day}T00:00:00.000Z`,
  };
}
