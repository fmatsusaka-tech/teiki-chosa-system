# OCR Provider設定ガイド

## 目的

画像認識機能を特定のOCR/AIサービスに固定しないため、OCR Providerの共通インターフェース、DTO、Provider Registry / Factory、動作モード設定を用意している。

PaddleOCRはPython製のOCR実行環境として、Webアプリ本体とは別プロセスのローカルHTTPサイドカーで起動する。TypeScript側はHTTP越しに画像を渡し、返却された文字列・行・信頼度・座標を共通OCR DTOへ変換する。

この文書の対象はOCR ProviderとPaddleOCR接続までであり、OpenAI Vision本体、JAスクリーンショット解析、UI連携、SurveyRecord保存は後続PRで実装する。

## 環境変数

| 変数 | 値 | 既定値 | 説明 |
|---|---|---|---|
| `OCR_MODE` | `economy`, `standard`, `local` | `economy` | OCRの運用モード。 |
| `OCR_PROVIDER` | `paddle`, `openai`, `local` | モードごとの既定値 | 最初に利用するProvider。 |
| `OCR_SERVICE_URL` | URL | `http://127.0.0.1:8868` | 汎用OCRサービスURL。 |
| `PADDLE_OCR_SERVICE_URL` | URL | `OCR_SERVICE_URL`または既定URL | PaddleOCRサイドカーURL。 |
| `OCR_TIMEOUT_MS` | 正の整数 | `30000` | OCR ProviderのHTTPタイムアウト。 |
| `PADDLE_OCR_ALLOWED_ORIGINS` | カンマ区切りのorigin | `http://localhost:3000,http://127.0.0.1:3000` | サイドカーへのブラウザーアクセスを許可するorigin。`*`は設定しない。 |
| `PADDLE_OCR_MAX_IMAGE_BYTES` | 正の整数 | `20971520` | サイドカーが受理する画像の最大バイト数（既定20 MiB）。 |

## 動作モード

| モード | 既定Provider | フォールバック候補 | 想定用途 |
|---|---|---|---|
| `economy` | `paddle` | なし | PaddleOCRのみで低コストに運用する。 |
| `standard` | `paddle` | `openai` | PaddleOCRを基本とし、将来は低信頼・解析不能時に外部LLMへフォールバックする。 |
| `local` | `local` | なし | ローカルOCRとローカルVLM/LLMで閉じた運用を行う。 |

現時点ではフォールバックの実行処理は実装していない。`createOcrProviderSelection()` は主ProviderとフォールバックProviderの候補を返すだけに留めている。

## PaddleOCR HTTPサイドカー仕様

TypeScript側の `PaddleOcrProvider` は次のHTTPエンドポイントを呼ぶ。

- `GET /health`: 起動確認。HTTP 2xxの場合に利用可能とみなす。
- `POST /ocr`: `multipart/form-data` の `image` フィールドに画像を添付する。

`POST /ocr` のレスポンスは次のJSONを期待する。

```json
{
  "rawText": "ゆら早生\n糖度 7.3",
  "lines": [
    {
      "text": "ゆら早生",
      "confidence": 0.91,
      "boundingBox": { "x": 1, "y": 2, "width": 30, "height": 10 },
      "metadata": {}
    }
  ],
  "blocks": [],
  "warnings": [],
  "metadata": { "model": "paddleocr" }
}
```

`confidence` を取得できない場合は `null` にする。未取得を `0` で代用しない。

## Windows向けローカル実行手順

PowerShellでの例。

### 1. Pythonを確認

Python 3.10〜3.12を推奨する。

```powershell
py --version
```

### 2. 仮想環境を作成して有効化

```powershell
py -3.11 -m venv .venv-paddleocr
.\.venv-paddleocr\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

### 3. PaddleOCRサイドカー依存関係を導入

```powershell
pip install -r tools\paddle-ocr-sidecar\requirements.txt
```

初回実行時はPaddleOCRのモデル取得に時間がかかる場合がある。

### 4. OCRサービスを起動

```powershell
uvicorn app:app --app-dir tools\paddle-ocr-sidecar --host 127.0.0.1 --port 8868
```

### 5. Webアプリ側の環境変数を設定

`.env.local` などに次を設定する。

```dotenv
OCR_MODE=economy
OCR_PROVIDER=paddle
PADDLE_OCR_SERVICE_URL=http://127.0.0.1:8868
OCR_TIMEOUT_MS=30000
```

### 6. 動作確認

別のPowerShellでWebアプリの確認コマンドを実行する。

```powershell
npm run typecheck
npm test
$env:PYTHONPATH = "tools\paddle-ocr-sidecar"
python -m unittest discover -s tools\paddle-ocr-sidecar -p "test_*.py"
```

OCRサイドカー単体の起動確認は次のURLで行う。

```powershell
Invoke-WebRequest http://127.0.0.1:8868/health
```

画像OCRの手動確認例。

```powershell
curl.exe -F "image=@C:\path\to\sample.png" http://127.0.0.1:8868/ocr
```

### 7. 停止方法

`uvicorn` を起動しているPowerShellで `Ctrl+C` を押す。仮想環境は次で終了する。

```powershell
deactivate
```

## 安全な既定値とエラー処理

OCR関連の環境変数が未指定の場合、`economy` モードかつ `paddle` Providerを選択する。PaddleOCRサイドカーが未起動でもProvider生成では失敗しない。

- `checkAvailability()` は `/health` を確認し、未起動・HTTPエラー・タイムアウトを `available: false` と共通エラーコードで返す。
- `recognize()` は接続不能、タイムアウト、不正レスポンス、Provider固有例外を `OcrProviderError` に変換する。
- サイドカーは画像MIMEタイプ、空ファイル、最大サイズを検証し、内部例外の詳細をHTTPレスポンスへ露出しない。
- PaddleOCR 3系の `predict()` 結果を共通レスポンスへ正規化する。旧形式の結果も互換性のため受理する。
- ブラウザーからのローカル接続に必要なCORS originは明示的な許可リストで管理する。
- OpenAI Providerとlocal Providerは、このIssueでは未実装Providerのままにする。

## 後続PRで実装すること

- OpenAI Vision Provider
- ローカルVLM/LLM Provider
- confidenceや解析不能時のフォールバック実行ポリシー
- OCR結果からJAスクリーンショット用の構造化データへ変換するParser
- 画像アップロードAPIと確認UI
- `SurveyRecord` への保存や画像ファイル永続化
