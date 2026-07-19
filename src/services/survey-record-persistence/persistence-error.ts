export type SurveyRecordPersistenceErrorCode =
  | "INVALID_RECORDS"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_ERROR";

export class SurveyRecordPersistenceError extends Error {
  constructor(
    public readonly code: SurveyRecordPersistenceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SurveyRecordPersistenceError";
  }
}
