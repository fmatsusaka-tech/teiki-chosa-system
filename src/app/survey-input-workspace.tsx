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
  return value === null ? "—" : value.toFixed(digits);
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
    () => records.filter((record) => record.warnings.length > 0).length,
    [records],
  );

  const analyzeText = () => {
    const parsed = parseSurveyMemo(sourceText);
    setRecords(parsed.records);
    setSelectedRows(new Set(parsed.records.map((_, index) => index)));
    setExpandedRows(new Set());
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

          <div className="record-list" role="list">
            {records.map((record, index) => {
              const isExpanded = expandedRows.has(index);
              const isSelected = selectedRows.has(index);
              const mean = average(record.diametersMm);

              return (
                <article
                  className={`record-row ${record.warnings.length > 0 ? "has-warning" : ""}`}
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
                      <span className="metric"><small>糖</small>{formatNumber(record.brix)}</span>
                      <span className="metric"><small>酸</small>{formatNumber(record.acidity)}</span>
                      <span className="expand-mark" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="record-detail">
                      <div className="diameter-grid">
                        {record.diametersMm.map((diameter, diameterIndex) => (
                          <label key={diameterIndex}>
                            <span>玉{diameterIndex + 1}</span>
                            <input value={diameter} readOnly aria-label={`玉${diameterIndex + 1}の横径`} />
                          </label>
                        ))}
                      </div>
                      {record.warnings.length > 0 && (
                        <ul className="warning-list">
                          {record.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="sticky-register-bar">
            <span>選択中 <strong>{selectedRows.size}件</strong></span>
            <button type="button" disabled={selectedRows.size === 0}>
              {selectedRows.size}件をまとめて登録
            </button>
          </div>
        </section>
      )}
    </>
  );
}
