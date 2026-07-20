import { describe, expect, it } from "vitest";
import { parseSurveyMemo } from "./parse-survey-memo";

const memo = `2025/11/16

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

有中
スキー
602
580
607
541
562
535
14.4
1.1

有中
ミヨビ
501
611
473
574
596
624
13.5
0.7

吉川
461
570
561
571
523
573
14.5
0.7

なる1
546
476
601
597
622
632
14.0
0.8

なる2
742
724
825
715
763
800
10.4
0.7

上中島
720
617
643
683
687
622
10.9
0.7

下町
717
614
754
730
10.0
0.8

徳田
734
-681
642
543
11.2
0.9`;

const incompleteMemo = `11/16

有中
無処理区
506
504
561
570
513
572

スキー
602
580
607
541
562
535

ミヨビ
501
611
473
574
596
624

吉川
461
570
561
571
523
573

なる1
546
476
601
597
622
632

なる2
742
724
825
715
763
800
売り物サイズを検査

上中島
720
617
643
683
687
622

下町
717
614
754
730

徳田
734
-681
642
543`;

describe("parseSurveyMemo", () => {
  it("カンマ区切りの1行メモを解析する", () => {
    const result = parseSurveyMemo(
      "2026/7/20\n徳田、早生、39.6-40.5-42.7-40.0-32.9、糖度8.4、酸度3.8、やや小玉",
      "2026-07-20T01:00:00.000Z",
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      measuredAt: "2026-07-20T00:00:00.000Z",
      orchard: "徳田",
      variety: "早生",
      diametersMm: [39.6, 40.5, 42.7, 40, 32.9],
      brix: 8.4,
      acidity: 3.8,
      notes: "やや小玉",
    });
  });

  it("改行された複数園地の1行メモを解析する", () => {
    const result = parseSurveyMemo([
      "7/20",
      "徳田 早生 39.6 40.5 42.7 糖度8.4 酸2.7",
      "下町 早生 41.2 42.0 40.8 糖度8.9 酸2.7",
    ].join("\n"), "2026-07-20T01:00:00.000Z");

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.orchard)).toEqual(["徳田", "下町"]);
    expect(result.records[0]).toMatchObject({
      diametersMm: [39.6, 40.5, 42.7],
      brix: 8.4,
      acidity: 2.7,
    });
    expect(result.records[0].warnings).toContain("横径が3個です");
  });

  it("未知の園地と品種も補正可能な候補として残す", () => {
    const result = parseSurveyMemo(
      "寺門 極早生 41.2 42.0 40.8 糖度8.9 酸2.7",
      "2026-07-20T01:00:00.000Z",
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      orchard: "寺門",
      variety: "極早生",
      diametersMm: [41.2, 42, 40.8],
      brix: 8.9,
      acidity: 2.7,
    });
    expect(result.records[0].warnings).toEqual(expect.arrayContaining([
      "園地「寺門」はマスターに登録されていません",
      "品種「極早生」はマスターに登録されていません",
    ]));
  });

  it("糖度と酸度がない1行メモも欠測値付きの候補として残す", () => {
    const result = parseSurveyMemo(
      "徳田 早生 41.2 42.0 40.8",
      "2026-07-20T01:00:00.000Z",
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      orchard: "徳田",
      variety: "早生",
      diametersMm: [41.2, 42, 40.8],
      brix: null,
      acidity: null,
    });
    expect(result.records[0].warnings).toEqual(expect.arrayContaining([
      "糖度が未入力です",
      "酸度が未入力です",
    ]));
  });

  it("複数園地と処理区を9レコードに分割する", () => {
    const result = parseSurveyMemo(memo, "2026-07-18T07:00:00.000Z");

    expect(result.records).toHaveLength(9);
    expect(result.records[0]).toMatchObject({
      orchard: "有中",
      variety: "ゆら早生",
      notes: "無処理区",
      diametersMm: [50.6, 50.4, 56.1, 57, 51.3, 57.2],
      brix: 16.1,
      acidity: 1,
      measuredAt: "2025-11-16T00:00:00.000Z",
    });

    expect(result.records[4]).toMatchObject({
      orchard: "なる1",
      variety: "ゆら早生",
    });

    expect(result.records[5]).toMatchObject({
      orchard: "なる2",
      variety: "早生",
      diametersMm: [74.2, 72.4, 82.5, 71.5, 76.3, 80],
    });
  });

  it("横径数の不足と不自然な負数を警告する", () => {
    const result = parseSurveyMemo(memo);
    const shimomachi = result.records.find((record) => record.orchard === "下町");
    const tokuda = result.records.find((record) => record.orchard === "徳田");

    expect(shimomachi?.warnings).toContain("横径が4個です");
    expect(tokuda?.diametersMm).toEqual([73.4, 68.1, 64.2, 54.3]);
    expect(tokuda?.warnings.some((warning) => warning.includes("-681"))).toBe(true);
  });

  it("糖度と酸度が無い入力では横径を削らず未入力警告を付ける", () => {
    const result = parseSurveyMemo(incompleteMemo, "2026-07-18T07:00:00.000Z");

    expect(result.records).toHaveLength(9);
    expect(result.records[0]).toMatchObject({
      orchard: "有中",
      notes: "無処理区",
      diametersMm: [50.6, 50.4, 56.1, 57, 51.3, 57.2],
      brix: null,
      acidity: null,
      measuredAt: "2026-11-16T00:00:00.000Z",
    });
    expect(result.records[0].warnings).toContain("糖度が未入力です");
    expect(result.records[0].warnings).toContain("酸度が未入力です");

    expect(result.records[1]).toMatchObject({
      orchard: "有中",
      notes: "スキー",
      diametersMm: [60.2, 58, 60.7, 54.1, 56.2, 53.5],
    });

    expect(result.records[5]).toMatchObject({
      orchard: "なる2",
      notes: "売り物サイズを検査",
      diametersMm: [74.2, 72.4, 82.5, 71.5, 76.3, 80],
    });
  });
});
