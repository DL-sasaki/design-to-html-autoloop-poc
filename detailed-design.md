# 詳細設計書: design-to-html-autoloop-poc

## 1. 目的
本システムは、`input/design.png` を入力として、HTML/CSSを生成し、レンダリング結果との差分を評価しながら反復的に修正するローカル実行型PoCである。

## 2. スコープ
- 対象: 静的LP1ページ
- 入力: PNG1枚（`input/design.png`）
- 出力: `output/index.html`, `output/styles.css`
- 実行起点: VSCode Task (`Generate from Design`)
- 差分評価: 画像比較（pixelmatch）
- 反復改修: AI Adapter経由

## 3. 全体アーキテクチャ
### 3.1 層構成
1. 実行制御層
- `scripts/run-loop.ts`
- パイプライン進行、停止条件判定、進捗表示、最終化

2. 処理モジュール層
- `prepare-input.ts`: 入力検証・作業ディレクトリ準備
- `generate-initial.ts`: 初回HTML/CSS生成
- `render-page.ts`: Playwrightレンダリング
- `compare-images.ts`: 差分画像とdiffRatio算出
- `analyze-diff.ts`: 差分診断
- `revise-code.ts`: 改修反映
- `finalize.ts`: 最終成果物とサマリーログ

3. 共通基盤層
- `shared/config.ts`: 設定一元化
- `shared/types.ts`: 型定義
- `shared/file-utils.ts`: ファイルI/O
- `shared/logger.ts`: JSONログ保存
- `shared/ai-adapter.ts`: AI抽象化実装

## 4. 主要ディレクトリ
- `input/`: 入力画像
- `output/`: HTML/CSS成果物
- `renders/`: 反復ごとのレンダリング画像
- `diff/`: 反復ごとの差分画像
- `logs/`: 実行状態・反復ログ・サマリー
- `logs/ai/`: AI要求/応答ログ
- `prompts/`: AI向け指示テンプレート
- `scripts/`: パイプライン本体

## 5. 実行フロー
1. `prepare-input`
- `input/design.png` の存在確認
- PNG形式・サイズ・デコード可否確認
- 出力先ディレクトリを作成

2. `generate-initial`
- AI Adapterで初回HTML/CSSを生成
- `output/index.html`, `output/styles.css` に保存

3. 反復ループ（1..maxIterations）
- `render-page`: スクリーンショット保存
- `compare-images`: diff画像とmetrics生成
- `analyze-diff`: 構造化診断作成
- `revise-code`: 既存コード最小改修

4. 停止条件判定
- `diffRatio <= targetDiffRatio`
- 改善停滞（連続）
- `maxIterations` 到達
- 致命的エラー

5. `finalize`
- `renders/final.png`, `diff/final-diff.png` を確定
- `logs/run-summary.json` へ最終結果出力

## 6. 設定仕様
`shared/config.ts` に設定を集約。

### 6.1 主要設定
- `inputImagePath`: `input/design.png`
- `outputHtmlPath`: `output/index.html`
- `outputCssPath`: `output/styles.css`
- `maxIterations`: 反復上限
- `targetDiffRatio`: 目標差分率
- `minimumImprovement`: 最低改善率
- `viewport.width/height`: レンダリングサイズ

### 6.2 AI設定
- `ai.mode`: `mock | prompt-export | gemini-cli`
- `ai.gemini.command`: `gemini`
- `ai.gemini.args`: `-m flash -p`
- `ai.gemini.timeoutMs`: タイムアウト
- `ai.gemini.retryCount`: 再試行回数

## 7. AI Adapter詳細
### 7.1 インターフェース
- `generateInitial({ imagePath, promptPath })`
- `analyzeDiff({ imagePath, renderPath, diffPath, metrics, promptPath })`
- `reviseCode({ iteration, html, css, analysis, promptPath })`

### 7.2 モード別挙動
1. `mock`
- 固定ロジックで疑似生成・疑似分析・疑似改修

2. `prompt-export`
- 改修要求を `prompts/generated/` に出力
- 応答JSON（`html`,`css`）を外部で生成して再実行

3. `gemini-cli`
- `gemini -m flash -p` でCLI呼び出し
- JSON強制プロンプトで生成/分析/改修
- 失敗時は厳格JSON指示で再試行
- AI要求・応答を `logs/ai/` に保存

## 8. JSONパース/修復設計
### 8.1 基本方針
- まず通常JSONとして解析
- 失敗時は抽出・正規化を実施
- それでも失敗時は修復用再プロンプトを実行

### 8.2 修復処理
- コードフェンス除去
- 末尾の余分な引用符除去
- `{...}` 範囲抽出
- `html/css` 文字列のサルベージ

### 8.3 失敗時挙動
- `revise` 失敗時は前回有効HTML/CSSを維持して継続
- 警告ログをターミナルとJSONへ記録

## 9. ログ仕様
### 9.1 最新状態
- `logs/latest-status.json`
- フィールド: `status`, `phase`, `iteration`, `diffRatio`, `message`, `timestamp`

### 9.2 反復ログ
- `logs/iterations/iteration-XX.json`
- フィールド: `diffRatio`, `improvementFromPrevious`, `analysisSummary`, `status`

### 9.3 実行サマリー
- `logs/run-summary.json`
- 開始/終了時刻、最終差分、停止理由、成果物パス、エラー内容

### 9.4 AIログ
- `logs/ai/*-request.txt`
- `logs/ai/*-response.txt`
- 再試行時はattempt番号付き

## 10. ターミナル進捗表示仕様
- `[RUNNING] iter=... phase=... diff=... msg="..."`
- `[METRIC] iter=... diff=... improvement=...`
- `[WARN] ... fallback=keep-previous-code ...`
- `[FAILED] ...`

## 11. エラー処理設計
### 11.1 致命的エラー
- 入力画像欠落
- Playwright起動失敗
- 画像比較失敗
- ファイル書き込み不可
- AI応答修復不能（最終失敗）

### 11.2 非致命対応
- `revise`の単発失敗: 前回有効コード維持で継続
- AI応答形式崩れ: 修復処理 + 再プロンプト

## 12. データ構造
### 12.1 DiffMetrics
- `totalPixels`
- `differentPixels`
- `diffRatio`
- `width`
- `height`

### 12.2 DiffAnalysis
- `summary`
- `issues[]`
  - `category`
  - `severity`
  - `description`
  - `suggestedAction`

### 12.3 IterationLog
- `iteration`
- `renderPath`
- `diffPath`
- `diffRatio`
- `improvementFromPrevious`
- `analysisSummary`
- `status`
- `timestamp`

## 13. 運用手順
1. 依存インストール
- `npm install`
- `npx playwright install chromium`

2. 入力配置
- `input/design.png` を配置

3. 実行
- VSCode Task `Generate from Design`
  または
- `npm run generate`

4. 結果確認
- `output/`, `renders/`, `diff/`, `logs/` を確認

## 14. Gemini CLI実行例（単体）
```bash
gemini -m flash -p "Return ONLY valid JSON: {\"html\":\"...\",\"css\":\"...\"}"
```

## 15. 受け入れ基準
- タスク実行で処理開始できる
- HTML/CSSが生成される
- 1回以上のrenderとdiffが保存される
- 反復ログが保存される
- 失敗時にJSONログへ理由が残る
- AI依存がAdapterで抽象化されている

## 16. 既知の制約
- 単一ページのみ
- 単一PNG入力のみ
- 高精度再現はプロンプト品質とモデル応答品質に依存
- Gemini CLIの出力揺れに対しては修復処理で吸収するが、完全保証ではない
