"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { parseSurveyMemo } from "../domain/parse-survey-memo";
import type { SurveyRecord } from "../domain/survey-record";
import {
  applyRegistrationDate,
  hasRequiredSurveyFields,
} from "../domain/survey-record-registration";
import { registerSurveyRecords } from "../lib/register-survey-records";
import { validateOcrImage } from "../services/ocr/ocr-image-input";

function average(values: number[]): number | null {
  const measuredValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (measuredValues.length === 0) return null;
  return measuredValues.reduce((sum, value) => sum + value, 0) / measuredValues.length;
}

function formatNumber(value: number | null, digits = 1) {
  return value === null ? "未入力" : value.toFixed(digits);
}

function visibleWarnings(record: SurveyRecord): string[] {
  return record.warnings.filter((warning) => {
    if (warning === "糖度が未入力です" && record.brix !== null) return false;
    if (warning === "酸度が未入力です" && record.acidity !== null) return false;
    if (warning === "横径が未入力です" && record.diametersMm.length >= 1) return false;
    if (warning === "品種を特定できませんでした" && record.variety !== "未設定") return false;
    if (warning === "調査日が未入力のため、登録日を使用します" && record.measuredAt) return false;
    return true;
  });
}

type RegistrationStatus =
  | { kind: "idle"; message: "" }
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function SurveyInputWorkspace() {
  const [sourceText, setSourceText] = useState("");
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [batchWarnings, setBatchWarnings] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [ocrStatus, setOcrStatus] = useState<RegistrationStatus>({ kind: "idle", message: "" });
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>({
    kind: "idle",
    message: "",
  });
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const handwrittenInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const hasAnalyzedRef = useRef(false);

  const warningCount = useMemo(
    () => records.filter((record) => visibleWarnings(record).length > 0).length,
    [records],
  );

  const missingBrixCount = useMemo(
    () => records.filter((record) => record.brix === null).length,
    [records],
  );

  const missingAcidityCount = useMemo(
    () => records.filter((record) => record.acidity === null).length,
    [records],
  );

  const missingDiameterCount = useMemo(
    () => records.filter((record) => record.diametersMm.length === 0).length,
    [records],
  );

  const incompleteSelectedCount = useMemo(
    () =>
      records.filter(
        (record, index) =>
          selectedRows.has(index) && !hasRequiredSurveyFields(record),
      ).length,
    [records, selectedRows],
  );

  const analyzeText = (text = sourceText) => {
    setRegistrationStatus({ kind: "idle", message: "" });
    if (!text.trim()) {
      setRecords([]);
      setBatchWarnings([]);
      setSelectedRows(new Set());
      setExpandedRows(new Set());
      hasAnalyzedRef.current = false;
      return;
    }

    const parsed = parseSurveyMemo(text);
    setRecords(parsed.records);
    setBatchWarnings(parsed.batchWarnings);
    setSelectedRows(new Set(parsed.records.map((_, index) => index)));
    setExpandedRows(
      new Set(
        parsed.records
          .map((record, index) =>
            record.brix === null ||
            record.acidity === null ||
            record.variety === "未設定"
              ? index
              : -1,
          )
          .filter((index) => index >= 0),
      ),
    );

    if (!hasAnalyzedRef.current && parsed.records.length > 0) {
      hasAnalyzedRef.current = true;
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  useEffect(() => {
    if (!sourceText.trim()) return;
    const timer = window.setTimeout(() => analyzeText(sourceText), 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceText]);

  const toggleExpanded = (index: number) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelected = (index: number) => {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const addBlankRecord = () => {
    const now = new Date().toISOString();
    const index = records.length;
    const record: SurveyRecord = {
      measuredAt: records[0]?.measuredAt ?? "",
      registeredAt: now,
      orchard: "",
      variety: "",
      treatment: null,
      diametersMm: [],
      brix: null,
      acidity: null,
      notes: "",
      source: "text",
      confidence: null,
      warnings: ["手動で追加した候補です。必須項目を確認してください"],
    };

    setRecords((current) => [...current, record]);
    setSelectedRows((current) => new Set([...current, index]));
    setExpandedRows((current) => new Set([...current, index]));
    setRegistrationStatus({ kind: "idle", message: "" });
  };

  const removeRecord = (index: number) => {
    const withoutIndex = (values: Set<number>) =>
      new Set(
        [...values]
          .filter((value) => value !== index)
          .map((value) => (value > index ? value - 1 : value)),
      );

    setRecords((current) => current.filter((_, recordIndex) => recordIndex !== index));
    setSelectedRows((current) => withoutIndex(current));
    setExpandedRows((current) => withoutIndex(current));
    setRegistrationStatus({ kind: "idle", message: "" });
  };

  const updateRecord = <K extends keyof SurveyRecord>(
    index: number,
    field: K,
    value: SurveyRecord[K],
  ) => {
    setRegistrationStatus({ kind: "idle", message: "" });
    setRecords((current) =>
      current.map((record, recordIndex) =>
        recordIndex === index ? { ...record, [field]: value } : record,
      ),
    );
  };

  const updateMeasurement = (
    index: number,
    field: "brix" | "acidity",
    rawValue: string,
  ) => {
    const value = rawValue === "" ? null : Number(rawValue);
    updateRecord(index, field, Number.isFinite(value) ? value : null);
  };

  const updateMeasuredDate = (index: number, rawValue: string) => {
    updateRecord(index, "measuredAt", rawValue ? `${rawValue}T00:00:00.000Z` : "");
  };

  const updateDiameter = (recordIndex: number, diameterIndex: number, rawValue: string) => {
    const value = rawValue === "" ? 0 : Number(rawValue);
    if (!Number.isFinite(value)) return;
    setRegistrationStatus({ kind: "idle", message: "" });
    setRecords((current) =>
      current.map((record, index) => {
        if (index !== recordIndex) return record;
        const diametersMm = [...record.diametersMm];
        diametersMm[diameterIndex] = value;
        return { ...record, diametersMm };
      }),
    );
  };

  const addDiameter = (recordIndex: number) => {
    setRegistrationStatus({ kind: "idle", message: "" });
    setRecords((current) =>
      current.map((record, index) =>
        index === recordIndex && record.diametersMm.length < 10
          ? { ...record, diametersMm: [...record.diametersMm, 0] }
          : record,
      ),
    );
  };

  const removeDiameter = (recordIndex: number, diameterIndex: number) => {
    setRegistrationStatus({ kind: "idle", message: "" });
    setRecords((current) =>
      current.map((record, index) =>
        index === recordIndex
          ? {
              ...record,
              diametersMm: record.diametersMm.filter((_, indexToKeep) => indexToKeep !== diameterIndex),
            }
          : record,
      ),
    );
  };

  const focusNextField = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const fields = Array.from(
      document.querySelectorAll<HTMLInputElement>("[data-entry-field='true']"),
    ).filter((field) => !field.disabled);
    const currentIndex = fields.indexOf(event.currentTarget);
    fields[currentIndex + 1]?.focus();
    fields[currentIndex + 1]?.select();
  };

  const clearInput = () => {
    setSourceText("");
    setRecords([]);
    setBatchWarnings([]);
    setSelectedRows(new Set());
    setExpandedRows(new Set());
    setPhotoNames([]);
    setRegistrationStatus({ kind: "idle", message: "" });
    hasAnalyzedRef.current = false;
  };

  const handlePhotos = async (
    event: ChangeEvent<HTMLInputElement>,
    sourceKind: "photo" | "screenshot" | "handwritten",
  ) => {
    const files = Array.from(event.target.files ?? []);
    setPhotoNames(files.map((file) => file.name));
    event.target.value = "";
    const image = files[0];
    if (!image || ocrStatus.kind === "loading") return;
    const validation = validateOcrImage(image);
    if (!validation.valid) {
      setOcrStatus({ kind: "error", message: validation.message });
      return;
    }
    setOcrStatus({ kind: "loading", message: "OCRで画像を読み取っています…" });
    try {
      const form = new FormData();
      form.append("image", image);
      form.append("sourceKind", sourceKind);
      const response = await fetch("/api/ocr", { method: "POST", body: form });
      const payload = await response.json() as { candidates?: unknown[]; error?: string };
      if (!response.ok || !payload.candidates) throw new Error(payload.error || "OCRに失敗しました。");
      sessionStorage.setItem("ocr-review-candidates", JSON.stringify(payload.candidates));
      sessionStorage.setItem("ocr-review-source-kind", form.get("sourceKind") as string);
      window.location.assign("/ocr-review/");
    } catch (error) {
      setOcrStatus({ kind: "error", message: error instanceof Error ? error.message : "OCRに失敗しました。" });
    }
  };

  const handleRegister = async () => {
    if (registrationStatus.kind === "loading") return;
    const selected = records
      .map((record, index) => ({ record, index }))
      .filter(({ index }) => selectedRows.has(index));

    if (selected.length === 0 || incompleteSelectedCount > 0) return;

    const registrationDate = new Date();
    const recordsWithIds = selected.map(({ record }) => ({
      ...applyRegistrationDate(record, registrationDate),
      id: record.id ?? crypto.randomUUID(),
    }));

    setRecords((current) =>
      current.map((record, index) => {
        const selectedIndex = selected.findIndex((item) => item.index === index);
        return selectedIndex >= 0 ? recordsWithIds[selectedIndex] : record;
      }),
    );

    setRegistrationStatus({ kind: "loading", message: "スプレッドシートへ登録中です…" });

    try {
      const result = await registerSurveyRecords(recordsWithIds, sourceText);
      const registeredCount = result.registeredCount ?? recordsWithIds.length;
      const skippedCount = result.skippedCount ?? 0;
      setRegistrationStatus({
        kind: "success",
        message: `${registeredCount}件を登録しました。${
          skippedCount > 0 ? `重複していた${skippedCount}件は登録していません。` : ""
        }`,
      });
      setSourceText("");
      setRecords([]);
      setBatchWarnings([]);
      setSelectedRows(new Set());
      setExpandedRows(new Set());
      setPhotoNames([]);
      hasAnalyzedRef.current = false;
    } catch (error) {
      setRegistrationStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "登録に失敗しました。",
      });
    }
  };

  const isRegistering = registrationStatus.kind === "loading";

  return (
    <>
      <section className="panel" aria-labelledby="input-title">
        <div className="section-heading">
          <div>
            <p className="step">STEP 1</p>
            <h2 id="input-title">調査内容を入力</h2>
          </div>
          <span className="status">自動解析</span>
        </div>

        <textarea
          aria-label="調査内容"
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder="複数園地のメモを、そのまま貼り付けてください。入力後、自動で解析します。"
          rows={10}
        />

        <div className="input-actions">
          <button type="button" onClick={() => cameraInputRef.current?.click()}>
            その場で撮影
          </button>
          <button type="button" onClick={() => libraryInputRef.current?.click()}>
            スクリーンショットを選択
          </button>
          <button type="button" onClick={() => handwrittenInputRef.current?.click()}>
            手書きメモを選択
          </button>
          <button type="button" disabled={!sourceText} onClick={clearInput}>
            入力を消す
          </button>
        </div>

        <input
          ref={cameraInputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          capture="environment"
          onChange={(event) => void handlePhotos(event, "photo")}
        />
        <input
          ref={libraryInputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => void handlePhotos(event, "screenshot")}
        />
        <input
          ref={handwrittenInputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => void handlePhotos(event, "handwritten")}
        />

        {photoNames.length > 0 && (
          <div className="temporary-photo-note" role="status">
            <strong>{photoNames[0]}</strong>
            <span>{ocrStatus.message || "画像を確認画面へ渡します。"}</span>
          </div>
        )}

        {ocrStatus.kind === "error" && (
          <div className="issue-summary" role="alert"><span>{ocrStatus.message}画像を選び直して再試行できます。</span></div>
        )}

        {registrationStatus.kind === "success" && (
          <div className="temporary-photo-note" role="status">
            <strong>登録完了</strong>
            <span>{registrationStatus.message}</span>
          </div>
        )}
      </section>

      {(records.length > 0 || batchWarnings.length > 0) && (
        <section
          ref={resultsRef}
          className="panel results-panel"
          aria-labelledby="results-title"
        >
          <div className="section-heading results-heading">
            <div>
              <p className="step">STEP 2</p>
              <h2 id="results-title">解析結果を確認・修正</h2>
            </div>
            <div className="summary-badges">
              <span className="status">全{records.length}件</span>
              {warningCount > 0 && <span className="warning-badge">要確認 {warningCount}件</span>}
              <button type="button" onClick={addBlankRecord}>空の候補を追加</button>
            </div>
          </div>

          {(missingBrixCount > 0 || missingAcidityCount > 0 || missingDiameterCount > 0) && (
            <div className="issue-summary" role="alert">
              {missingBrixCount > 0 && <span>糖度未入力：{missingBrixCount}件</span>}
              {missingAcidityCount > 0 && <span>酸度未入力：{missingAcidityCount}件</span>}
              {missingDiameterCount > 0 && <span>横径未入力：{missingDiameterCount}件</span>}
            </div>
          )}

          {batchWarnings.length > 0 && (
            <div className="issue-summary" role="alert">
              <strong>解析できなかった入力があります</strong>
              <ul>
                {batchWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {registrationStatus.kind === "error" && (
            <div className="issue-summary" role="alert">
              <span>登録エラー：{registrationStatus.message}</span>
            </div>
          )}

          <div className="record-list" role="list">
            {records.map((record, index) => {
              const isExpanded = expandedRows.has(index);
              const isSelected = selectedRows.has(index);
              const mean = average(record.diametersMm);
              const warnings = visibleWarnings(record);

              return (
                <article
                  className={`record-row ${warnings.length > 0 ? "has-warning" : ""}`}
                  key={`${record.orchard}-${record.notes}-${index}`}
                  role="listitem"
                >
                  <div className="record-summary">
                    <label className="record-check" aria-label={`${record.orchard}を登録対象にする`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isRegistering}
                        onChange={() => toggleSelected(index)}
                      />
                    </label>
                    <button
                      className="record-expand"
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(index)}
                    >
                      <span className="orchard-name">{record.orchard || "園地未入力"}</span>
                      <span className="record-meta">
                        {record.variety}
                        {record.treatment ? `・${record.treatment}` : ""}
                        {record.notes ? `・${record.notes}` : ""}
                      </span>
                      <span className="metric"><small>平均</small>{formatNumber(mean)}</span>
                      <span className={`metric ${record.brix === null ? "missing-metric" : ""}`}><small>糖</small>{formatNumber(record.brix)}</span>
                      <span className={`metric ${record.acidity === null ? "missing-metric" : ""}`}><small>酸</small>{formatNumber(record.acidity)}</span>
                      <span className="expand-mark" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="record-detail">
                      <div className="record-fields">
                        <label>
                          <span>調査日（未入力時は登録日）</span>
                          <input data-entry-field="true" type="date" value={record.measuredAt.slice(0, 10)} onKeyDown={focusNextField} onChange={(event) => updateMeasuredDate(index, event.target.value)} />
                        </label>
                        <label>
                          <span>園地</span>
                          <input data-entry-field="true" value={record.orchard} onKeyDown={focusNextField} onChange={(event) => updateRecord(index, "orchard", event.target.value)} />
                        </label>
                        <label>
                          <span>品種</span>
                          <input data-entry-field="true" value={record.variety} onKeyDown={focusNextField} onChange={(event) => updateRecord(index, "variety", event.target.value)} />
                        </label>
                        <label>
                          <span>処理区</span>
                          <input data-entry-field="true" value={record.treatment ?? ""} onKeyDown={focusNextField} onChange={(event) => updateRecord(index, "treatment", event.target.value || null)} />
                        </label>
                        <label>
                          <span>備考</span>
                          <input data-entry-field="true" value={record.notes} onKeyDown={focusNextField} onChange={(event) => updateRecord(index, "notes", event.target.value)} />
                        </label>
                        <label className={record.brix === null ? "required-field" : ""}>
                          <span>糖度{record.brix === null ? "（必須）" : ""}</span>
                          <input data-entry-field="true" type="number" inputMode="decimal" min="0" step="0.1" value={record.brix ?? ""} placeholder="例：12.5" onKeyDown={focusNextField} onChange={(event) => updateMeasurement(index, "brix", event.target.value)} />
                        </label>
                        <label>
                          <span>酸度（任意）</span>
                          <input data-entry-field="true" type="number" inputMode="decimal" min="0" step="0.01" value={record.acidity ?? ""} placeholder="例：0.85" onKeyDown={focusNextField} onChange={(event) => updateMeasurement(index, "acidity", event.target.value)} />
                        </label>
                      </div>

                      <div className="diameter-grid">
                        {record.diametersMm.map((diameter, diameterIndex) => (
                          <div className="diameter-field" key={diameterIndex}>
                            <label>
                              <span>玉{diameterIndex + 1}</span>
                              <input data-entry-field="true" type="number" inputMode="decimal" min="0.1" step="0.1" value={diameter > 0 ? diameter : ""} placeholder="横径" onKeyDown={focusNextField} onChange={(event) => updateDiameter(index, diameterIndex, event.target.value)} aria-label={`玉${diameterIndex + 1}の横径`} />
                            </label>
                            <button type="button" aria-label={`玉${diameterIndex + 1}の横径を削除`} onClick={() => removeDiameter(index, diameterIndex)}>削除</button>
                          </div>
                        ))}
                      </div>

                      <div className="diameter-actions">
                        <button type="button" disabled={record.diametersMm.length >= 10} onClick={() => addDiameter(index)}>
                          {record.diametersMm.length >= 10 ? "横径は最大10個です" : "横径欄を追加"}
                        </button>
                        <span>{record.diametersMm.filter((value) => value > 0).length}/10個入力</span>
                      </div>

                      {warnings.length > 0 && (
                        <ul className="warning-list">
                          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                        </ul>
                      )}

                      <div className="record-actions">
                        <button type="button" onClick={() => removeRecord(index)}>
                          この候補を削除
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="sticky-register-bar">
            <span>
              選択中 <strong>{selectedRows.size}件</strong>
              {incompleteSelectedCount > 0 && `・未入力 ${incompleteSelectedCount}件`}
              {registrationStatus.kind === "loading" && "・登録中"}
            </span>
            <button
              type="button"
              onClick={handleRegister}
              disabled={
                selectedRows.size === 0 ||
                incompleteSelectedCount > 0 ||
                isRegistering
              }
            >
              {isRegistering
                ? "登録しています…"
                : incompleteSelectedCount > 0
                  ? "不足項目を入力してください"
                  : `${selectedRows.size}件をまとめて登録`}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
