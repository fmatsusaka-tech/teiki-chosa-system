const SPREADSHEET_ID = "1Ix7qFigeUvmxkEl3C51rmzuBzYDq7OR_ZGHq6GUKa0g";
const RAW_SHEET_NAME = "調査原票";
const SURVEY_SHEET_NAME = "調査データ";
const CORRECTION_HISTORY_SHEET_NAME = "補正履歴";
const CORRECTION_HISTORY_HEADERS = [
  "補正ID", "記録日時", "入力方法", "候補番号", "項目", "補正前", "補正後", "辞書候補",
];
const API_TOKEN_PROPERTY = "API_TOKEN";
const MAX_DIAMETERS = 10;
const DIAMETER_OUTPUT_HEADERS = Array.from(
  { length: MAX_DIAMETERS },
  (_, index) => `玉${index + 1}横径`,
);
const DIAMETER_SUMMARY_HEADERS = ["横径個数", "横径平均", "横径最小", "横径最大"];

function doGet() {
  return jsonResponse_({ ok: true, service: "teiki-chosa-registration" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);
    const payload = parsePayload_(e);
    verifyToken_(payload.token);

    if (!Array.isArray(payload.records) || payload.records.length === 0) {
      throw new Error("登録対象のデータがありません。");
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(RAW_SHEET_NAME);
    if (!sheet) throw new Error(`シート「${RAW_SHEET_NAME}」が見つかりません。`);

    const rawHeaders = getHeaders_(sheet);
    const existingIds = getExistingIds_(sheet, rawHeaders);
    const now = new Date();
    const rows = [];
    const acceptedIds = [];
    const skippedIds = [];

    payload.records.forEach((record, index) => {
      validateRecord_(record, index);
      const registrationId = String(record.registrationId || Utilities.getUuid());

      if (existingIds.has(registrationId)) {
        skippedIds.push(registrationId);
        return;
      }

      const diameters = Array.isArray(record.diametersMm)
        ? record.diametersMm.slice(0, MAX_DIAMETERS)
        : [];
      while (diameters.length < MAX_DIAMETERS) diameters.push("");

      const cells = {
        登録ID: registrationId,
        登録日時: now,
        計測日: new Date(record.measuredAt),
        園地名: cleanText_(record.orchard),
        品種: cleanText_(record.variety),
        処理区: cleanText_(record.treatment || ""),
        備考: cleanText_(record.notes || ""),
        糖度: Number(record.brix),
        酸度: Number(record.acidity),
        入力方法: cleanText_(record.source || "text"),
        入力者: cleanText_(payload.operator || record.operator || ""),
        送信元: cleanText_(payload.client || "定期調査入力アプリ"),
        原文メモ: cleanText_(payload.sourceText || ""),
      };
      diameters.forEach((diameter, diameterIndex) => {
        cells[`横径${diameterIndex + 1}`] = diameter;
      });
      rows.push(rowForHeaders_(cells, rawHeaders));
      acceptedIds.push(registrationId);
      existingIds.add(registrationId);
    });

    if (rows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
      ["登録日時", "計測日"].forEach((header) => {
        const columnIndex = rawHeaders.indexOf(header);
        if (columnIndex >= 0) {
          sheet.getRange(startRow, columnIndex + 1, rows.length, 1).setNumberFormat("yyyy/mm/dd hh:mm:ss");
        }
      });
    }

    try {
      appendCorrectionHistory_(payload.corrections || []);
    } catch (correctionError) {
      console.error("補正履歴の保存に失敗しました。調査原票は保存済みです。", correctionError);
    }

    return jsonResponse_({
      ok: true,
      registeredCount: rows.length,
      skippedCount: skippedIds.length,
      registrationIds: acceptedIds,
      skippedIds,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function setupCorrectionLearning() {
  return ensureCorrectionHistorySheet_().getName();
}

function ensureCorrectionHistorySheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CORRECTION_HISTORY_SHEET_NAME)
    || spreadsheet.insertSheet(CORRECTION_HISTORY_SHEET_NAME);
  const headers = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), CORRECTION_HISTORY_HEADERS.length)).getValues()[0]
    : [];
  if (sheet.getLastRow() === 0 || headers.every((value) => value === "")) {
    sheet.getRange(1, 1, 1, CORRECTION_HISTORY_HEADERS.length).setValues([CORRECTION_HISTORY_HEADERS]);
  } else if (headers.slice(0, CORRECTION_HISTORY_HEADERS.length).join("\t") !== CORRECTION_HISTORY_HEADERS.join("\t")) {
    throw new Error(`シート「${CORRECTION_HISTORY_SHEET_NAME}」の見出しが補正履歴仕様と一致しません。`);
  }
  return sheet;
}

function appendCorrectionHistory_(corrections) {
  if (!Array.isArray(corrections) || corrections.length === 0) return 0;
  const sheet = ensureCorrectionHistorySheet_();
  const rows = correctionRows_(corrections);
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, CORRECTION_HISTORY_HEADERS.length).setValues(rows);
  sheet.getRange(startRow, 2, rows.length, 1).setNumberFormat("yyyy/mm/dd hh:mm:ss");
  return rows.length;
}

function correctionRows_(corrections) {
  return corrections.map((event) => [
    cleanText_(event.id || Utilities.getUuid()),
    new Date(event.recordedAt || new Date()),
    cleanText_(event.sourceKind || ""),
    Number(event.candidateIndex) + 1,
    cleanText_(event.field || ""),
    cleanText_(event.beforeValue || ""),
    cleanText_(event.afterValue || ""),
    event.dictionaryEligible ? "対象" : "監査のみ",
  ]);
}

/**
 * 「調査原票」から「調査データ」を全件再生成する。
 * 既存データの再生成時にも、列位置ではなく見出し名だけを使用する。
 */
function regenerateSurveyData() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rawSheet = spreadsheet.getSheetByName(RAW_SHEET_NAME);
  const surveySheet = spreadsheet.getSheetByName(SURVEY_SHEET_NAME);
  if (!rawSheet || !surveySheet) throw new Error("調査原票または調査データが見つかりません。");

  const rawHeaders = getHeaders_(rawSheet);
  const surveyHeaders = ensureDiameterOutputHeaders_(getHeaders_(surveySheet));
  surveySheet.getRange(1, 1, 1, surveyHeaders.length).setValues([surveyHeaders]);

  const rawRows = rawSheet.getLastRow() < 2
    ? []
    : rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, rawHeaders.length).getValues();
  const outputRows = rawRows.map((row) => buildSurveyDataRow_(rawHeaders, row, surveyHeaders));

  const oldDataRows = Math.max(surveySheet.getLastRow() - 1, 0);
  if (oldDataRows > 0) surveySheet.getRange(2, 1, oldDataRows, surveySheet.getLastColumn()).clearContent();
  if (outputRows.length > 0) {
    surveySheet.getRange(2, 1, outputRows.length, surveyHeaders.length).setValues(outputRows);
  }
  return outputRows.length;
}

function ensureDiameterOutputHeaders_(headers) {
  const diameterHeaders = [...DIAMETER_OUTPUT_HEADERS, ...DIAMETER_SUMMARY_HEADERS];
  const retained = headers.filter((header) => !diameterHeaders.includes(header));
  const notesIndex = retained.indexOf("備考");
  const insertionIndex = notesIndex >= 0 ? notesIndex + 1 : retained.length;
  retained.splice(insertionIndex, 0, ...diameterHeaders);
  return retained;
}

function buildSurveyDataRow_(rawHeaders, rawRow, surveyHeaders) {
  const raw = Object.fromEntries(rawHeaders.map((header, index) => [header, rawRow[index]]));
  const diameters = Array.from({ length: MAX_DIAMETERS }, (_, index) => raw[`横径${index + 1}`])
    .filter((value) => value !== "" && value !== null && value !== undefined);
  const numericDiameters = diameters.map(Number).filter(Number.isFinite);
  const cells = { ...raw };
  const measuredAt = raw["調査日"] ?? raw["計測日"] ?? "";
  const dateParts = surveyDateParts_(measuredAt);
  cells["調査日"] = measuredAt;
  cells["園地"] = raw["園地"] ?? raw["園地名"] ?? "";
  cells["年度"] = dateParts ? fiscalYear_(dateParts.year, dateParts.month) : "";
  cells["年"] = dateParts ? dateParts.year : "";
  cells["月"] = dateParts ? dateParts.month : "";
  cells["調査基準月"] = dateParts ? surveyBaseMonth_(dateParts.month, dateParts.day) : "";
  cells["調査区分"] = dateParts ? surveyPeriod_(dateParts.day) : "";
  DIAMETER_OUTPUT_HEADERS.forEach((header, index) => {
    const value = raw[`横径${index + 1}`];
    cells[header] = value === null || value === undefined ? "" : value;
  });
  cells["横径個数"] = numericDiameters.length || "";
  cells["横径平均"] = numericDiameters.length
    ? numericDiameters.reduce((sum, value) => sum + value, 0) / numericDiameters.length
    : "";
  cells["横径最小"] = numericDiameters.length ? Math.min(...numericDiameters) : "";
  cells["横径最大"] = numericDiameters.length ? Math.max(...numericDiameters) : "";
  cells["糖酸比"] = sugarAcidRatio_(raw["糖度"], raw["酸度"]);
  cells["データ状態"] = surveyDataStatus_(measuredAt, cells["園地"], raw["品種"]);
  return rowForHeaders_(cells, surveyHeaders);
}

function surveyDateParts_(value) {
  if (value === "" || value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function fiscalYear_(year, month) {
  return month < 4 ? year - 1 : year;
}

function surveyBaseMonth_(month, day) {
  return day >= 25 ? month % 12 + 1 : month;
}

function surveyPeriod_(day) {
  if (day >= 25 || day <= 10) return "前半";
  if (day <= 20) return "中頃";
  return "";
}

function sugarAcidRatio_(brix, acidity) {
  if (brix === "" || brix === null || brix === undefined
    || acidity === "" || acidity === null || acidity === undefined) return "";
  const numericBrix = Number(brix);
  const numericAcidity = Number(acidity);
  if (!Number.isFinite(numericBrix) || !Number.isFinite(numericAcidity) || numericAcidity === 0) return "";
  return numericBrix / numericAcidity;
}

function surveyDataStatus_(measuredAt, orchard, variety) {
  return surveyDateParts_(measuredAt) && cleanText_(orchard) && cleanText_(variety) ? "有効" : "要確認";
}

function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(cleanText_);
}

function rowForHeaders_(cells, headers) {
  return headers.map((header) => Object.prototype.hasOwnProperty.call(cells, header) ? cells[header] : "");
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("送信データを読み取れませんでした。");
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (_) {
    throw new Error("JSON形式が正しくありません。");
  }
}

function verifyToken_(receivedToken) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty(API_TOKEN_PROPERTY);
  if (!expectedToken) throw new Error("GAS側のAPIトークンが未設定です。");
  if (!receivedToken || receivedToken !== expectedToken) throw new Error("認証に失敗しました。");
}

function validateRecord_(record, index) {
  const label = `${index + 1}件目`;
  if (!record || typeof record !== "object") throw new Error(`${label}の形式が不正です。`);
  if (!record.measuredAt || Number.isNaN(new Date(record.measuredAt).getTime())) {
    throw new Error(`${label}の計測日が不正です。`);
  }
  if (!cleanText_(record.orchard)) throw new Error(`${label}の園地名が未入力です。`);
  if (!cleanText_(record.variety) || record.variety === "未設定") {
    throw new Error(`${label}の品種が未入力です。`);
  }
  if (!Array.isArray(record.diametersMm) || record.diametersMm.length === 0) {
    throw new Error(`${label}の横径が未入力です。`);
  }
  if (record.brix === null || record.brix === "" || !Number.isFinite(Number(record.brix))) {
    throw new Error(`${label}の糖度が未入力です。`);
  }
  if (record.acidity === null || record.acidity === "" || !Number.isFinite(Number(record.acidity))) {
    throw new Error(`${label}の酸度が未入力です。`);
  }
}

function getExistingIds_(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  const idColumnIndex = headers.indexOf("登録ID");
  if (idColumnIndex < 0) throw new Error("調査原票に「登録ID」見出しがありません。");
  return new Set(
    sheet.getRange(2, idColumnIndex + 1, lastRow - 1, 1).getDisplayValues().flat().filter(String),
  );
}

function cleanText_(value) {
  return String(value == null ? "" : value).trim();
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
