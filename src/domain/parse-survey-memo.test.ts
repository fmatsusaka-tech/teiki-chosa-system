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

describe("parseSurveyMemo", () => {
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
});
