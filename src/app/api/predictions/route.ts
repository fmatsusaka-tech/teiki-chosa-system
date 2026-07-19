import { NextRequest, NextResponse } from "next/server";
import { loadPredictionCurves, loadSurveyRecords } from "../../../../lib/prediction/data-source";
import { predictSurveyRecords } from "../../../../lib/prediction/predict-survey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalized(value: string | null): string | null {
  const result = value?.trim();
  return result ? result : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const variety = normalized(request.nextUrl.searchParams.get("variety"));
    const orchard = normalized(request.nextUrl.searchParams.get("orchard"));
    const registrationId = normalized(request.nextUrl.searchParams.get("registrationId"));
    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 200);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 1000) : 200;

    const [surveys, curves] = await Promise.all([
      loadSurveyRecords(),
      loadPredictionCurves(),
    ]);
    const filtered = surveys.filter((survey) => {
      if (registrationId && survey.registrationId !== registrationId) return false;
      if (variety && survey.variety !== variety) return false;
      if (orchard && survey.orchardName !== orchard) return false;
      return true;
    }).slice(-limit);

    return NextResponse.json({
      source: "調査データ",
      count: filtered.length,
      predictions: predictSurveyRecords(filtered, curves),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "予測データの読み込みに失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
