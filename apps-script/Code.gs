const SPREADSHEET_ID = "1Ix7qFigeUvmxkEl3C51rmzuBzYDq7OR_ZGHq6GUKa0g";
const RAW_SHEET_NAME = "調査原票";
const API_TOKEN_PROPERTY = "API_TOKEN";
const MAX_DIAMETERS = 10;

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

    const existingIds = getExistingIds_(sheet);
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

      rows.push([
        registrationId,
        now,
        new Date(record.measuredAt),
        cleanText_(record.orchard),
        cleanText_(record.variety),
        cleanText_(record.treatment || ""),
        cleanText_(record.notes || ""),
        ...diameters,
        Number(record.brix),
        Number(record.acidity),
        cleanText_(record.source || "text"),
        cleanText_(payload.operator || record.operator || ""),
        cleanText_(payload.client || "定期調査入力アプリ"),
        cleanText_(payload.sourceText || ""),
      ]);
      acceptedIds.push(registrationId);
      existingIds.add(registrationId);
    });

    if (rows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
      sheet.getRange(startRow, 2, rows.length, 2).setNumberFormat("yyyy/mm/dd hh:mm:ss");
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

function getExistingIds_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  return new Set(
    sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat().filter(String),
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
