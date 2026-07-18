"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { parseSurveyMemo } from "../domain/parse-survey-memo";
import type { SurveyRecord } from "../domain/survey-record";

const sampleMemo = `2025/11/16
有中
無処理区
506
504
561
570
513
572
16.1
1.0
吉川
528
548
552
545
542
14.5
0.7`;

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
    return true;
  });
}

export function SurveyInputWorkspace() {
  const [sourceText, setSourceText] = useState(sampleMemo);
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const warningCount = useMemo(
    () => records.filter((record) => visibleWarnings(record).length > 0).length,
    [records],
  );

  const incompleteSelectedCount = useMemo(
    () =>
      records.filter(
        (record, index) =>
          selectedRows.has(index) && (record.brix === null || record.acidity === null),
      ).length,
    [records, selectedRows],
  );

  const analyzeText = () => {
    const parsed = parseSurveyMemo(sourceText);
    setRecords(parsed.records);
    setSelectedRows(new Set(parsed.records.map((_, index) => index)));
    setExpandedRows(
      new Set(
        parsed.records
          .map((record, index) =>
            record.brix === null || record.acidity === null ? index : -1,
          )
          .filter((index) => index >= 0),
      ),
    );
  };

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

  const updateMeasurement = (
    index: number,
    field: "brix" | "acidity",
    rawValue: string,
  ) => {
    const value = rawValue === "" ? null : Number(rawValue);
    setRecords((current) =>
      current.map((record, recordIndex) =>
        recordIndex === index
          ? { ...record, [field]: Number.isFinite(value) ? value : null }
          : record,
      ),
    );
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
          <span className="status">入力支援モジュール</span>
        </div>

        <textarea
          aria-label="調査内容"
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder="複数園地のメモを、そのまま貼り付けてください"
          rows={10}
        />

        <div className="input-actions">
          <button className="primary-button" type="button" onClick={analyzeText}>
            テキストを解析する
          </button>
          <button type="button" onClick={() => cameraInputRef.current?.click()}>
            その場で撮影
          </button>
          <button type="button" onClick={() => libraryInputRef.current?.click()}>
            写真を選択
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
            <span>画像は登録後に保存せず破棄します。画像解析処理は次工程で接続します。</span>
          </div>
        )}
      </section>

      {records.length > 0 && (
        <section className="panel results-panel" aria-labelledby="results-title">
          <div className="section-heading results-heading">
            <div>
              <p className="step">STEP 2</p>
              <h2 id="results-title">解析結果を確認</h2>
            </div>
            <div className="summary-badges">
              <span className="status">全{records.length}件</span>
              {warningCount > 0 && <span className="warning-badge">要確認 {warningCount}件</span>}
            </div>
          </div>

          {incompleteSelectedCount > 0 && (
            <div className="required-input-notice" role="alert">
              <strong>糖度・酸度が不足しています</strong>
              <span>黄色の欄へ値を追加してください。未入力のレコードは登録できません。</span>
            </div>
          )}

          <div className="record-list" role="list">
            {records.map((record, index) => {
              const isExpanded = expandedRows.has(index);
              const isSelected = selectedRows.has(index);
              const mean = average(record.diametersMm);
              const warnings = visibleWarnings(record);
              const isIncomplete = record.brix === null || record.acidity === null;

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
                      <span className="orchard-name">{record.orchard}</span>
                      <span className="record-meta">{record.variety}{record.notes ? `・${record.notes}` : ""}</span>
                      <span className="metric"><small>平均</small>{formatNumber(mean)}</span>
                      <span className={`metric ${record.brix === null ? "missing-metric" : ""}`}><small>糖</small>{formatNumber(record.brix)}</span>
                      <span className={`metric ${record.acidity === null ? "missing-metric" : ""}`}><small>酸</small>{formatNumber(record.acidity)}</span>
                      <span className="expand-mark" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="record-detail">
                      {isIncomplete && (
                        <div className="required-fields">
                          <label>
                            <span>糖度（必須）</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.1"
                              value={record.brix ?? ""}
                              placeholder="例：12.5"
                              onChange={(event) => updateMeasurement(index, "brix", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>酸度（必須）</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={record.acidity ?? ""}
                              placeholder="例：0.85"
                              onChange={(event) => updateMeasurement(index, "acidity", event.target.value)}
                            />
                          </label>
                        </div>
                      )}

                      <div className="diameter-grid">
                        {record.diametersMm.map((diameter, diameterIndex) => (
                          <label key={diameterIndex}>
                            <span>玉{diameterIndex + 1}</span>
                            <input value={diameter} readOnly aria-label={`玉${diameterIndex + 1}の横径`} />
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
