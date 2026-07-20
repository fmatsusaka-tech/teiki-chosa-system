# OCR Provider設定ガイド

## 目的

画像認識機能を特定のOCR/AIサービスに固定しないため、OCR Providerの共通インターフェース、DTO、Provider Registry / Factory、動作モード設定を用意している。

PaddleOCRはPythonサイドカーとして実行し、TypeScript側のProviderから共通DTOへ変換する。OpenAI VisionとJA固有スクリーンショット解析はこの文書の対象外とする。

## スマホメモのスクリーンショット取込

トップ画面の「スクリーンショットを選択」から、スマホのメモアプリ画像を読み取れる。

- 対応形式：PNG、JPEG、WebP
- 最大サイズ：10MB
- 画像ライブラリからの選択は`screenshot`、カメラ撮影は`photo`として保存する
- OCR文字列は`SurveyMemoOcrParser`から既存の定期調査メモParserへ渡す
- 縦並びメモから複数の調査候補を生成する
- 候補は自動保存せず、OCR確認・編集画面で必ず人が確認する
- 調査日が空欄なら登録日を使用する
- 横径は1〜10個、糖度は必須、酸度は任意とする

処理の流れ：

```text
スクリーンショット選択
  → 画像形式・サイズ検証
  → OCR Provider
  → 共通OCR結果
  → 定期調査メモParser
  → OCR確認・編集
  → 保存
```

PaddleOCRサイドカーが停止している場合は日本語のエラーを表示し、選択した画像を変えて再試行できる。アプリ本体と文章入力は引き続き利用できる。

## 環境変数

| 変数 | 値 | 既定値 | 説明 |
|---|---|---|---|
| `OCR_MODE` | `economy`, `standard`, `local` | `economy` | OCRの運用モード。 |
| `OCR_PROVIDER` | `paddle`, `openai`, `local` | モードごとの既定値 | 最初に利用するProvider。 |
| `PADDLE_OCR_ENDPOINT` | URL | `http://127.0.0.1:8765` | PaddleOCRサイドカーの接続先。 |
| `PADDLE_OCR_TIMEOUT_MS` | 正の整数 | `30000` | ヘルスチェック・認識要求のタイムアウト（ミリ秒）。 |
| `PADDLE_OCR_LANG` | PaddleOCR言語名 | `japan` | Pythonサイドカーが読み込む言語モデル。 |

## 動作モード

| モード | 既定Provider | フォールバック候補 | 想定用途 |
|---|---|---|---|
| `economy` | `paddle` | なし | PaddleOCRのみで低コストに運用する。 |
| `standard` | `paddle` | `openai` | PaddleOCRを基本とし、将来は低信頼・解析不能時に外部LLMへフォールバックする。 |
| `local` | `local` | なし | ローカルOCRとローカルVLM/LLMで閉じた運用を行う。 |

現時点ではフォールバックの実行処理は実装していない。`createOcrProviderSelection()` は主ProviderとフォールバックProviderの候補を返すだけに留めている。

## 安全な既定値

OCR関連の環境変数が未指定の場合、`economy` モードかつ `paddle` Providerを選択する。Providerの生成時にはサイドカーへ接続しないため、サイドカー停止中でもアプリ自体は起動できる。

PaddleOCRサイドカーが利用不能な場合は次のように扱う。

- `checkAvailability()` は `available: false` と `PROVIDER_UNAVAILABLE` を返す。
- `recognize()` はProvider固有例外を共通の`OcrProviderError`へ変換する。
- Providerの生成だけではアプリ全体を起動不能にしない。

## 開発者向け利用例

```ts
import { createOcrProviderSelection } from "../services/ocr";

const selection = createOcrProviderSelection();
const availability = await selection.provider.checkAvailability();

if (!availability.available) {
  // UIやAPI routeでは、利用者が次に何をすべきか分かる日本語メッセージへ変換する。
}
```

## Windowsでのサイドカー起動

PowerShellでPython 3.11または3.12の仮想環境を作成し、次の順に実行する。初回起動時にはPaddleOCRの日本語モデルがダウンロードされるため、ネットワーク接続が必要になる。

```powershell
py -3.12 -m venv .venv-paddleocr
.\.venv-paddleocr\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r sidecars/paddleocr/requirements.txt
python -m uvicorn app:app --app-dir sidecars/paddleocr --host 127.0.0.1 --port 8765
```

別のPowerShellで疎通を確認する。

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

## 手書きメモ

トップ画面の「手書きメモを選択」からPNG、JPEG、WebP画像を選択する。手書きモードではPythonサイドカーが画像をグレースケール化し、局所コントラストを補正してからOCRへ渡す。元画像は保存せず、処理後に一時ファイルを削除する。

手書き文字の認識結果は自動確定しない。確認画面には原画像との照合を促す警告を常に表示し、園地名、品種、数値を利用者が補正してから登録する。

CPU版を標準とし、GPU版PaddlePaddleへの置換は利用環境に合わせてPaddlePaddle公式手順を確認する。サイドカーは画像から文字・信頼度・座標を返すだけで、JA固有解析や調査データ保存は行わない。

## 後続PRで実装すること

- OpenAI Vision Provider
- ローカルVLM/LLM Provider
- OCR結果からJAスクリーンショット用の構造化データへ変換するParser
- 画像ファイル本体の永続化
