const phases = [
  "自由入力",
  "AI解析",
  "確認・修正",
  "一括登録",
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Matsusaka Farm</p>
        <h1>AI定期調査システム</h1>
        <p className="lead">
          音声、文章、スクリーンショットから、柑橘の調査データをまとめて登録します。
        </p>
      </section>

      <section className="panel" aria-labelledby="input-title">
        <div className="section-heading">
          <div>
            <p className="step">STEP 1</p>
            <h2 id="input-title">調査内容を入力</h2>
          </div>
          <span className="status">準備中</span>
        </div>

        <textarea
          aria-label="調査内容"
          placeholder="例：徳田、早生、39.6-40.5-42.7-40.0-32.9、糖度8.4、酸度3.8"
          rows={8}
          disabled
        />

        <button type="button" disabled>
          AIで解析する
        </button>
      </section>

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
