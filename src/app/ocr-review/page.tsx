import { getActiveMasterNames, orchardMasters, varietyMasters } from "../../domain/survey-masters";
import type { SurveyParseCandidate } from "../../services/ocr-parser";
import { OcrReviewForm } from "./ocr-review-form";

const reviewCandidate: SurveyParseCandidate = {
  measuredDate: null, orchard: null, variety: null, treatment: null, diametersMm: null,
  brix: null, acidity: null, notes: null, confidence: null, sourceText: "", unparsedText: [],
  warnings: [{ code: "MISSING_REQUIRED_FIELD", field: "measuredDate", message: "調査日を認識できませんでした。" }],
};

export default function OcrReviewPage() {
  return (
    <main className="page-shell review-page">
      <header className="hero"><p className="eyebrow">OCR REVIEW</p><h1>OCR確認・編集</h1><p className="lead">読み取った定期調査データを、登録前に確認・修正します。</p></header>
      <OcrReviewForm initialCandidates={[reviewCandidate]} orchardNames={getActiveMasterNames(orchardMasters)} varietyNames={getActiveMasterNames(varietyMasters)} />
    </main>
  );
}
