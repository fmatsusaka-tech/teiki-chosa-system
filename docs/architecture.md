# 初期アーキテクチャ方針

## 目的

外部サービスやAIモデルを後から交換でき、スマートフォン入力と将来の分析機能を段階的に追加できる構成とする。

## 推奨構成

初期候補として、次の構成を推奨する。

- Webアプリ：Next.js + TypeScript
- UI：スマートフォン優先のレスポンシブ設計
- 入力検証：Zod等のスキーマ検証
- テスト：VitestまたはJest、必要に応じてPlaywright
- AI解析：サーバー側の解析アダプター経由
- Google Sheets：Google Sheets APIをサーバー側から利用
- ホスティング：Vercel等を候補とする

これは確定ではなく、実装開始時に利用料金、運用難度、Google連携方法を確認して決定する。

## 論理構成

```text
スマートフォン／PC
        ↓
Web UI
        ↓
入力解析API
  ├─ 前処理
  ├─ AI解析アダプター
  ├─ 正規化
  └─ バリデーション
        ↓
確認・修正UI
        ↓
登録API
  ├─ 重複確認
  ├─ 内部保存（採用する場合）
  └─ Google Sheets出力
```

## レイヤー

### UI層

- 入力画面
- 確認・修正画面
- 登録結果
- 将来の一覧・グラフ

UIはAIモデルやGoogle APIを直接呼ばない。

### アプリケーション層

- 文章を解析するユースケース
- レコードを検証するユースケース
- レコードを登録するユースケース
- 一覧・分析を取得するユースケース

### ドメイン層

- SurveyRecord
- Orchard master
- Variety master
- Warning
- Measurement field definition

### インフラ層

- AI provider
- OCR provider
- Google Sheets
- Database
- AMeDAS data source

## AI解析の境界

```ts
interface SurveyParser {
  parse(input: ParseInput): Promise<ParseResult>;
}
```

AIサービス固有のSDKやレスポンス形式は、アダプター内部へ閉じ込める。

## 保存方式

候補は2つある。

### A. Google Sheetsのみ

利点：

- 初期実装が簡単
- 既存運用との互換性が高い

課題：

- 重複管理、履歴、分析速度、柔軟な項目追加が難しい

### B. 内部データベース＋Google Sheets出力

利点：

- 可変長データ、履歴、分析、再出力に強い
- 将来機能を追加しやすい

課題：

- 初期設定と運用が増える

長期的にはBが適する可能性が高いが、初期リリースでどこまで必要かを技術選定時に判断する。

## 認証

初期利用者は少人数を想定するが、公開URLだけで登録できる状態にはしない。

候補：

- Googleアカウント認証
- 許可メールアドレス方式
- 簡易ログイン＋アクセス制限

Google Sheetsへの権限と、アプリ利用者の権限は分離して考える。

## オフライン・通信不良

完全なオフライン対応は後続でもよいが、少なくとも次を行う。

- 入力中テキストをブラウザ内へ一時保存
- API失敗時に入力と修正内容を保持
- 再試行可能な設計

## ディレクトリ構成案

```text
src/
  app/
  components/
  features/
    survey-input/
    survey-review/
    survey-registration/
    analysis/
  domain/
  services/
    ai/
    sheets/
    weather/
  config/
  tests/
```

実際のフレームワーク決定後に調整する。

## セキュリティ

- AIとGoogle APIはサーバー側から呼ぶ
- 秘密情報をクライアントへ渡さない
- 入力サイズとファイル形式を制限する
- 登録APIは認証必須とする
- 操作ログには秘密情報を含めない
