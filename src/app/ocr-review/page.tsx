import { getActiveMasterNames, orchardMasters, varietyMasters } from "../../domain/survey-masters";
import { OcrReviewForm } from "./ocr-review-form";

export default function OcrReviewPage() {
  return (
    <main className="page-shell review-page">
      <header className="hero"><p className="eyebrow">OCR REVIEW</p><h1>OCR確認・編集</h1><p className="lead">読み取った定期調査データを、登録前に確認・修正します。</p></header>
      <OcrReviewForm initialCandidates={[]} orchardNames={getActiveMasterNames(orchardMasters)} varietyNames={getActiveMasterNames(varietyMasters)} />
    </main>
  );
}
