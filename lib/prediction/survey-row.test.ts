import { describe, expect, it } from "vitest";
import {
  SurveySheetFormatError,
  createSurveyHeaderIndex,
  mapSurveyValues,
} from "./survey-row";

const headers = [
  "備考",
  "酸度",
  "登録ID",
  "品種",
  "園地名",
  "計測日",
  "処理区",
  "糖度",
  "横径平均",
  "データ状態",
];

describe("survey sheet row mapper", () => {
  it("maps values by header name even when columns are reordered", () => {
    const records = mapSurveyValues([
      headers,
      ["微耕", 1.2, "reg-001", "早生", "徳田", "2026/7/15", "試験区", 8.4, 39.6, "正常"],
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      registrationId: "reg-001",
      orchardName: "徳田",
      variety: "早生",
      treatment: "試験区",
      note: "微耕",
      averageDiameter: 39.6,
      brix: 8.4,
      acid: 1.2,
      dataStatus: "正常",
    });
    expect(records[0]?.measuredAt).toBeInstanceOf(Date);
  });

  it("accepts Google Sheets serial dates", () => {
    const records = mapSurveyValues([
      headers,
      ["", 1.2, "reg-002", "中生", "寺門", 46218, "", 9.1, 45, "正常"],
    ]);
    expect(records[0]?.measuredAt).toBeInstanceOf(Date);
  });

  it("reports all missing required headers", () => {
    expect(() => createSurveyHeaderIndex(["登録ID", "計測日"]))
      .toThrow(SurveySheetFormatError);
    try {
      createSurveyHeaderIndex(["登録ID", "計測日"]);
    } catch (error) {
      expect((error as SurveySheetFormatError).missingHeaders).toContain("園地名");
      expect((error as SurveySheetFormatError).missingHeaders).toContain("横径平均");
    }
  });
});
