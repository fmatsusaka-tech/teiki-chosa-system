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

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value: number | null, digits = 1) {
  return value === null ? "未入力" : value.toFixed(digits);
}

function visibleWarnings(record: SurveyRecord): string[] {
  return record.warnings.filter((warning) => {
    if (warning === "糖度が未入力です" && record.brix !== null) return false;
    if (warning === "酸度が未入力です" && record.acidity !== null) return false;
    if (warning.startsWith("横径が") && record.diametersMm.length >= 5) return false;
    if (warning === "品種を特定できませんでした" && record.variety !== "未設定") return false;
    return true;
  });
}

export function SurveyInputWorkspace() {
  const [sourceText, setSourceText] = useState("");
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
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

  const shortDiameterCount = useMemo(
    () => records.filter((record) => record.diametersMm.length < 5).length,
    [records],
  );

  const incompleteSelectedCount = useMemo(
    () =>
      records.filter(
        (record, index) =>
          selectedRows.has(index) &&
          (record.brix === null ||
            record.acidity === null ||
            record.orchard.trim() === "" ||
            record.variety.trim() === "" ||
            record.variety === "未設定"),
      ).length,
    [records, selectedRows],
  );

  const analyzeText = (text = sourceText) => {
    if (!text.trim()) {
      setRecords([]);
      setSelectedRows(new Set());
      setExpandedRows(new Set());
      hasAnalyzedRef.current = false;
      return;
    }

    const parsed = parseSurveyMemo(text);
    setRecords(parsed.records);
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
    // sourceTextが変わったときだけ再解析する
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

  const updateRecord = <K extends keyof SurveyRecord>(
    index: number,
    field: K,
    value: SurveyRecord[K],
  ) => {
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

  const updateDiameter = (recordIndex: number, diameterIndex: number, rawValue: string) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;

    setRecords((current) =>
      current.map((record, index) => {
        if (index !== recordIndex) return record;
        const diametersMm = [...record.diametersMm];
        diametersMm[diameterIndex] = value;
        return { ...record, diametersMm };
      }),
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
    setSelectedRows(new Set());
    setExpandedRows(new Set());
    hasAnalyzedRef.current = false;
  };

  const handlePhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setPhotoNames(files.map((file) => file.name));
    event.target.value = "";
  };

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
            写真を選択
          </button>
          <button type="button" disabled={!sourceText} onClick={clearInput}>
            入力を消す
          </button>
        </div>

        <input
          ref={cameraInputRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotos}
        />
        <input
          ref={libraryInputRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotos}
        />

        {photoNames.length > 0 && (
          <div className="temporary-photo-note" role="status">
            <strong>{photoNames.length}枚を一時選択中</strong>
            <span>写真の読み取り機能は次の開発工程で接続します。</span>
          </div>
        )}
      </section>

      {records.length > 0 && (
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
            </div>
          </div>

          {(missingBrixCount > 0 || missingAcidityCount > 0 || shortDiameterCount > 0) && (
            <div className="issue-summary" role="alert">
              {missingBrixCount > 0 && <span>糖度未入力：{missingBrixCount}件</span>}
              {missingAcidityCount > 0 && <span>酸度未入力：{missingAcidityCount}件</span>}
              {shortDiameterCount > 0 && <span>横径不足：{shortDiameterCount}件</span>}
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
                      <span className="record-meta">{record.variety}{record.notes ? `・${record.notes}` : ""}</span>
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
                          <span>園地</span>
                          <input
                            data-entry-field="true"
                            value={record.orchard}
                            onKeyDown={focusNextField}
                            onChange={(event) => updateRecord(index, "orchard", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>品種</span>
                          <input
                            data-entry-field="true"
                            value={record.variety}
                            onKeyDown={focusNextField}
                            onChange={(event) => updateRecord(index, "variety", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>処理区・備考</span>
                          <input
                            data-entry-field="true"
                            value={record.notes}
                            onKeyDown={focusNextField}
                            onChange={(event) => updateRecord(index, "notes", event.target.value)}
                          />
                        </label>
                        <label className={record.brix === null ? "required-field" : ""}>
                          <span>糖度{record.brix === null ? "（必須）" : ""}</span>
                          <input
                            data-entry-field="true"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={record.brix ?? ""}
                            placeholder="例：12.5"
                            onKeyDown={focusNextField}
                            onChange={(event) => updateMeasurement(index, "brix", event.target.value)}
                          />
                        </label>
                        <label className={record.acidity === null ? "required-field" : ""}>
                          <span>酸度{record.acidity === null ? "（必須）" : ""}</span>
                          <input
                            data-entry-field="true"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={record.acidity ?? ""}
                            placeholder="例：0.85"
                            onKeyDown={focusNextField}
                            onChange={(event) => updateMeasurement(index, "acidity", event.target.value)}
                          />
                        </label>
                      </div>

                      <div className="diameter-grid">
                        {record.diametersMm.map((diameter, diameterIndex) => (
                          <label key={diameterIndex}>
                            <span>玉{diameterIndex + 1}</span>
                            <input
                              data-entry-field="true"
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              value={diameter}
                              onKeyDown={focusNextField}
                              onChange={(event) =>
                                updateDiameter(index, diameterIndex, event.target.value)
                              }
                              aria-label={`玉${diameterIndex + 1}の横径`}
                            />
                          </label>
                        ))}
                      </div>

                      {warnings.length > 0 && (
                        <ul className="warning-list">
                          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                        </ul>
                      )}
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
            </span>
            <button
              type="button"
              disabled={selectedRows.size === 0 || incompleteSelectedCount > 0}
            >
              {incompleteSelectedCount > 0
                ? "不足項目を入力してください"
                : `${selectedRows.size}件をまとめて登録`}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
