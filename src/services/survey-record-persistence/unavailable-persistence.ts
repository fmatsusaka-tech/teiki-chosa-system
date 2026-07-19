import { SurveyRecordPersistenceError } from "./persistence-error";
import type { SaveSurveyRecordsResult, SurveyRecordPersistence } from "./persistence-types";

/** Safe placeholder until a persistence provider is configured. */
export class UnavailableSurveyRecordPersistence implements SurveyRecordPersistence {
  async save(): Promise<SaveSurveyRecordsResult> {
    throw new SurveyRecordPersistenceError(
      "PROVIDER_UNAVAILABLE",
      "調査データの保存先が設定されていません。",
    );
  }
}
