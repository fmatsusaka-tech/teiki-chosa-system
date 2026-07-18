import { SurveyInputWorkspace } from "./survey-input-workspace";

const phases = ["自由入力", "解析", "確認・修正", "一括登録"];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Matsusaka Farm</p>
        <h1>定期調査・入力支援</h1>
        <p className="lead">
          文章、音声、写真から複数園地の調査データを読み取り、本体の閲覧システムへ渡すための入力モジュールです。
        </p>
      </section>

      <SurveyInputWorkspace />

      <section className="flow" aria-label="登録の流れ">
        {phases.map((phase, index) => (
          <div className="flow-item" key={phase}>
            <span>{index + 1}</span>
            <p>{phase}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
