import { NextResponse } from "next/server";
import { createOcrProvider, normalizeOcrError, validateOcrImage } from "../../../services/ocr";
import { SurveyMemoOcrParser } from "../../../services/ocr-parser";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "読み取る画像を1枚選択してください。" }, { status: 400 });
    }
    const validation = validateOcrImage(image);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }
    const provider = createOcrProvider();
    const ocrResult = await provider.recognize({
      image: await image.arrayBuffer(), mimeType: image.type, fileName: image.name,
      sourceKind: form.get("sourceKind") === "photo" ? "photo" : "screenshot",
    });
    const parsed = await new SurveyMemoOcrParser().parse({ ocrResult });
    return NextResponse.json(parsed);
  } catch (error) {
    const normalized = normalizeOcrError(error);
    return NextResponse.json({ error: `OCRに失敗しました。${normalized.message}` }, { status: normalized.code === "INVALID_INPUT" ? 400 : 503 });
  }
}
