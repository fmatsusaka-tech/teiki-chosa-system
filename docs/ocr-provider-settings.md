# OCR Provider設定ガイド

## 目的

画像認識機能を特定のOCR/AIサービスに固定しないため、OCR Providerの共通インターフェース、DTO、Provider Registry / Factory、動作モード設定を用意している。

この文書の対象はOCR基盤のみであり、PaddleOCR本体、OpenAI Vision本体、JAスクリーンショット解析、UI連携は後続PRで実装する。

## 環境変数

| 変数 | 値 | 既定値 | 説明 |
|---|---|---|---|
| `OCR_MODE` | `economy`, `standard`, `local` | `economy` | OCRの運用モード。 |
| `OCR_PROVIDER` | `paddle`, `openai`, `local` | モードごとの既定値 | 最初に利用するProvider。 |

## 動作モード

| モード | 既定Provider | フォールバック候補 | 想定用途 |
|---|---|---|---|
| `economy` | `paddle` | なし | PaddleOCRのみで低コストに運用する。 |
| `standard` | `paddle` | `openai` | PaddleOCRを基本とし、将来は低信頼・解析不能時に外部LLMへフォールバックする。 |
| `local` | `local` | なし | ローカルOCRとローカルVLM/LLMで閉じた運用を行う。 |

現時点ではフォールバックの実行処理は実装していない。`createOcrProviderSelection()` は主ProviderとフォールバックProviderの候補を返すだけに留めている。

## 安全な既定値

OCR関連の環境変数が未指定の場合、`economy` モードかつ `paddle` Providerを選択する。ただし、実Providerの本格実装は後続PRのため、現在のProviderは起動時に外部サービスへ接続しない未実装Providerとして振る舞う。

未実装Providerは次のように扱う。

- `checkAvailability()` は `available: false` と `PROVIDER_UNIMPLEMENTED` を返す。
- `recognize()` は `OcrProviderError` を投げる。
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

## 後続PRで実装すること

- PaddleOCRの実処理Provider
- OpenAI Vision Provider
- ローカルVLM/LLM Provider
- OCR結果からJAスクリーンショット用の構造化データへ変換するParser
- 画像アップロードAPIと確認UI
- `SurveyRecord` への保存や画像ファイル永続化
