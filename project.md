
# プロジェクト仕様書

## Project Specification for Codex Implementation

### Project Name

**design-to-html-autoloop-poc**

---

## 1. 目的 / Objective

本プロジェクトの目的は、**所定フォルダに配置されたWebデザイン画像を入力として、VSCode上の実行イベントを起点に、HTML/CSSを自動生成し、レンダリング結果と元画像との差分をもとに複数回の自動修正を行うPoCツールを構築すること**である。

This project must implement a PoC tool that:

* reads a design image from a predefined input folder,
* starts execution from a VSCode-triggered command/task,
* generates HTML/CSS for a single static web section,
* renders the result in a browser,
* compares the rendered output against the source design image,
* iteratively revises the generated HTML/CSS multiple times.

---

## 2. スコープ / Scope

### 2.1 対象範囲 / In Scope

* 静的Webセクション1つのみ
* 入力画像は1ファイル
* 出力は `index.html` と `styles.css`
* 実行トリガーは VSCode Task
* 自動修正ループを含む
* ローカル環境で完結する
* Node.js ベースで実装する
* Playwright で描画する
* 画像差分を算出する
* AI呼び出しは差し替え可能な抽象化層を持つ

### 2.2 対象外 / Out of Scope

* 本番運用
* 複数ページサイト
* JSインタラクション再現
* CMS連携
* Figma API連携
* デザインデータの構造解析
* 高度なアクセシビリティ最適化
* SEO最適化
* 画像アセット自動切り出し
* 動的コンポーネント生成

---

## 3. ユーザー体験 / Expected User Experience

### 3.1 利用者操作

1. ユーザーはデザイン画像を `input/design.png` に配置する
2. ユーザーは VSCode 上で `Generate from Design` Task を実行する
3. システムは HTML/CSS を生成する
4. システムはレンダリング画像を生成する
5. システムは元画像との差分を評価する
6. システムは必要に応じて複数回の自動修正を行う
7. 最終成果物を `output/` に保存する
8. ログと差分画像を `logs/` `diff/` `renders/` に保存する

### 3.2 完了時の期待状態

* `output/index.html`
* `output/styles.css`
* `renders/final.png`
* `diff/final-diff.png`
* `logs/run-summary.json`
* `logs/iterations/` 以下に各反復ログ

---

## 4. 技術方針 / Technical Direction

### 4.1 必須技術 / Required Stack

* Runtime: Node.js
* Language: TypeScript preferred, JavaScript acceptable
* Browser rendering: Playwright
* Image diff: pixelmatch
* Image processing: pngjs or equivalent
* Execution entry: VSCode Tasks
* AI provider access: pluggable adapter design

### 4.2 実装原則 / Implementation Principles

* All execution must be local-first
* All AI calls must be isolated behind an adapter interface
* Each step must have a single responsibility
* All intermediate artifacts must be persisted to disk
* Failures must be recoverable and observable
* Iteration count must be configurable
* HTML/CSS revision must prefer minimal change over full regeneration after initial generation

---

## 5. ディレクトリ構成 / Directory Structure

```text
project-root/
├─ .vscode/
│  └─ tasks.json
├─ input/
│  └─ design.png
├─ output/
│  ├─ index.html
│  └─ styles.css
├─ renders/
│  ├─ iteration-01.png
│  ├─ iteration-02.png
│  └─ final.png
├─ diff/
│  ├─ iteration-01-diff.png
│  ├─ iteration-02-diff.png
│  └─ final-diff.png
├─ logs/
│  ├─ run-summary.json
│  ├─ latest-status.json
│  └─ iterations/
│     ├─ iteration-01.json
│     ├─ iteration-02.json
│     └─ ...
├─ prompts/
│  ├─ initial-generation.md
│  ├─ diff-analysis.md
│  └─ revise-code.md
├─ scripts/
│  ├─ run-loop.ts
│  ├─ prepare-input.ts
│  ├─ generate-initial.ts
│  ├─ render-page.ts
│  ├─ compare-images.ts
│  ├─ analyze-diff.ts
│  ├─ revise-code.ts
│  ├─ finalize.ts
│  └─ shared/
│     ├─ config.ts
│     ├─ file-utils.ts
│     ├─ logger.ts
│     ├─ types.ts
│     └─ ai-adapter.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## 6. 入力仕様 / Input Specification

### 6.1 必須入力 / Required Input

* `input/design.png`

### 6.2 入力条件 / Input Constraints

* File must exist before execution
* Supported format for PoC: PNG only
* Only one design image is processed per run
* Input file name is fixed as `design.png`

### 6.3 入力エラー / Input Errors

以下の場合は即時停止すること。

* file does not exist
* file is not PNG
* file size is zero
* file cannot be decoded

---

## 7. 出力仕様 / Output Specification

### 7.1 必須出力

* `output/index.html`
* `output/styles.css`

### 7.2 中間出力

* 各反復のレンダリング画像
* 各反復の差分画像
* 各反復の診断情報
* 各反復のAI入出力ログ要約

### 7.3 出力制約

* HTML must be standalone and load `styles.css`
* CSS must be stored in a separate file
* No inline base64 image embedding for layout recreation
* No remote asset dependency unless explicitly configured
* Output must remain a static page

---

## 8. 実行フロー / Execution Flow

### 8.1 全体フロー

```text
[VSCode Task Trigger]
        ↓
[Validate Input]
        ↓
[Generate Initial HTML/CSS]
        ↓
[Render HTML]
        ↓
[Compare Design vs Render]
        ↓
[Analyze Diff]
        ↓
[Revise HTML/CSS]
        ↓
[Repeat Until Stop Condition]
        ↓
[Finalize Outputs and Logs]
```

### 8.2 詳細ステップ

#### Step 1. Validate Input

* confirm `input/design.png` exists
* confirm PNG format
* create missing working directories if needed

#### Step 2. Initial Generation

* send the design image and generation prompt to AI adapter
* receive HTML and CSS
* write to `output/index.html` and `output/styles.css`

#### Step 3. Render

* open local HTML via Playwright
* capture full-page screenshot
* save as `renders/iteration-XX.png`

#### Step 4. Compare

* compare `input/design.png` and current render
* align both images centered on the comparison canvas
* generate visual diff image
* calculate diff metrics

#### Step 5. Analyze

* produce structured diagnosis from comparison result
* diagnosis must include:

  * missing elements
  * spacing mismatch
  * text size mismatch
  * alignment mismatch
  * color mismatch
  * layout proportion issues

#### Step 6. Revise

* send current HTML/CSS and diagnosis to AI adapter
* revise existing code
* write updated files

#### Step 7. Stop Decision

* stop when max iteration reached
* or stop when diff threshold achieved
* or stop when improvement stagnates

#### Step 8. Finalize

* copy latest render as `renders/final.png`
* copy latest diff as `diff/final-diff.png`
* write summary log

---

## 9. 停止条件 / Stop Conditions

以下のいずれかで停止すること。

* `maxIterations` に達した
* `diffRatio` が `targetDiffRatio` 以下になった
* 連続2回以上で改善率が `minimumImprovement` 未満
* 致命的エラーが発生した

### Default values

```text
maxIterations = 5
targetDiffRatio = 0.08
minimumImprovement = 0.01
```

These values must be configurable.

---

## 10. モジュール仕様 / Module Specifications

### 10.1 prepare-input.ts

責務:

* validate input file
* ensure required directories exist
* initialize run metadata

### 10.2 generate-initial.ts

責務:

* call AI adapter with initial generation prompt
* extract HTML/CSS from response
* persist generated files

### 10.3 render-page.ts

責務:

* render `output/index.html` in Playwright
* capture full-page screenshot
* save current render image

### 10.4 compare-images.ts

責務:

* load source image and rendered image
* normalize dimensions if required by chosen policy
* run pixel diff
* generate diff image and metrics

### 10.5 analyze-diff.ts

責務:

* turn raw diff result into structured revision instructions
* produce machine-readable and human-readable summaries

### 10.6 revise-code.ts

責務:

* call AI adapter with current code + diagnosis
* update HTML/CSS with minimal necessary revisions

### 10.7 finalize.ts

責務:

* generate final result summary
* persist final artifact references
* mark run status as success or failure

### 10.8 ai-adapter.ts

責務:

* abstract all AI provider calls
* expose consistent interface

Example interface:

```ts
export interface AiAdapter {
  generateInitial(input: {
    imagePath: string;
    promptPath: string;
  }): Promise<{ html: string; css: string }>;

  analyzeDiff(input: {
    imagePath: string;
    renderPath: string;
    diffPath: string;
    metrics: DiffMetrics;
    promptPath: string;
  }): Promise<DiffAnalysis>;

  reviseCode(input: {
    html: string;
    css: string;
    analysis: DiffAnalysis;
    promptPath: string;
  }): Promise<{ html: string; css: string }>;
}
```

---

## 11. データ構造 / Data Structures

### 11.1 DiffMetrics

```ts
type DiffMetrics = {
  totalPixels: number;
  differentPixels: number;
  diffRatio: number;
  width: number;
  height: number;
};
```

### 11.2 DiffAnalysis

```ts
type DiffAnalysis = {
  summary: string;
  issues: Array<{
    category:
      | "missing-element"
      | "spacing"
      | "font-size"
      | "alignment"
      | "color"
      | "layout-proportion"
      | "unknown";
    severity: "low" | "medium" | "high";
    description: string;
    suggestedAction: string;
  }>;
};
```

### 11.3 IterationLog

```ts
type IterationLog = {
  iteration: number;
  renderPath: string;
  diffPath: string;
  diffRatio: number;
  improvementFromPrevious: number | null;
  analysisSummary: string;
  status: "success" | "failed";
  timestamp: string;
};
```

---

## 12. プロンプト方針 / Prompt Policy

### 12.1 initial-generation.md

目的:

* 画像から静的WebセクションのHTML/CSSを初回生成する

Required instruction in English:

```text
Generate a single static web section using only HTML and CSS.
Do not use canvas for the entire layout.
Do not embed the source design image as the final page.
Create semantic HTML where possible.
Output HTML and CSS separately.
Assume a desktop-first single web section screenshot reconstruction.
```

### 12.2 diff-analysis.md

目的:

* 元画像と現在レンダリングとの差分を構造化して診断する

Required instruction in English:

```text
Analyze the visual differences between the source design and the current rendered result.
Focus on layout, spacing, alignment, typography scale, colors, missing sections, and proportion mismatch.
Return a structured diagnosis only.
```

### 12.3 revise-code.md

目的:

* 診断に基づき既存HTML/CSSを修正する

Required instruction in English:

```text
Revise the existing HTML and CSS based on the diagnosis.
Prefer minimal necessary changes.
Do not rewrite the whole structure unless required.
Preserve valid HTML/CSS.
Output the full updated HTML and full updated CSS.
```

---

## 13. ログ仕様 / Logging Specification

### 必須ログ

* run start time
* run end time
* current iteration
* diff ratio per iteration
* improvement ratio
* error messages
* final status

### 出力先

* `logs/latest-status.json`
* `logs/run-summary.json`
* `logs/iterations/iteration-XX.json`

### ログ要件

* Logs must be JSON
* Logs must be append-safe
* Latest status file must always represent current progress

---

## 14. エラー処理 / Error Handling

### 14.1 致命的エラー / Fatal Errors

* missing input file
* Playwright launch failure
* invalid AI response format
* unable to write output files
* image comparison failure

Fatal errors must:

* stop execution immediately
* write failure status to logs
* preserve partial artifacts when possible

### 14.2 非致命的エラー / Non-Fatal Errors

* one iteration revision fails but previous valid code exists
* diff analysis returns incomplete issue list

Non-fatal errors may:

* retry once
* continue with last valid HTML/CSS if safe

---

## 15. 禁止事項 / Prohibitions

Codex must not implement the following unless explicitly instructed later:

* multi-page support
* JavaScript-heavy interactive behavior
* remote API lock-in without adapter abstraction
* direct overwrite of source design image
* silent failure without logs
* storing only final output without intermediate artifacts
* using the design image itself as a full-page background to fake reproduction
* embedding all styling inline by default
* replacing the HTML/CSS output with a rasterized image

---

## 16. 設定値 / Configuration

A configuration module must exist.

Example config:

```ts
export const config = {
  inputImagePath: "input/design.png",
  outputHtmlPath: "output/index.html",
  outputCssPath: "output/styles.css",
  maxIterations: 5,
  targetDiffRatio: 0.08,
  minimumImprovement: 0.01,
  viewport: {
    width: 1440,
    height: 4000
  }
};
```

All config values must be centralized and editable.

---

## 17. VSCode連携仕様 / VSCode Integration Specification

`.vscode/tasks.json` must define a task named:

```text
Generate from Design
```

The task must execute the main pipeline script.

Example requirement:

```text
Task label: Generate from Design
Command: node or tsx
Entry: scripts/run-loop.ts
Working directory: workspace root
```

The user must be able to run the full pipeline from VSCode without manually invoking multiple commands.

---

## 18. 受け入れ条件 / Acceptance Criteria

以下を満たした場合、PoCは受け入れ可能とする。

1. `input/design.png` を配置して VSCode Task を実行すると処理が開始される
2. `output/index.html` と `output/styles.css` が生成される
3. 少なくとも1回以上レンダリング画像が保存される
4. 少なくとも1回以上差分評価が実行される
5. 自動修正ループが複数回実行可能である
6. 各反復ログが保存される
7. エラー時に JSON ログへ失敗内容が記録される
8. 実装が AI provider 固定になっていない
9. デザイン画像の貼り付けだけで見た目を再現する実装になっていない
10. 実行後に最終成果物の場所が明確である

---

## 19. 拡張余地 / Future Extension Points

本仕様では必須ではないが、将来拡張可能な構造を残すこと。

* responsive mode
* multi-breakpoint rendering
* section-based generation
* multiple AI adapters
* watch mode
* CLI arguments
* retry policies
* human-in-the-loop approval mode

---

## 20. Codex実装指示 / Codex Execution Instruction

```text
Implement the project exactly according to this specification.

Priority order:
1. Working end-to-end pipeline
2. Clear module separation
3. Persistent intermediate artifacts
4. Config-driven iteration control
5. AI adapter abstraction

Do not add extra product features.
Do not expand scope beyond a single static web section PoC.
Prefer simple and maintainable code over premature extensibility.
Every module must be independently understandable.
All file paths must be workspace-relative.
Write clean, deterministic, debuggable code.
```

---

## 21. 実装優先順位 / Build Order

Codex should implement in this order:

```text
1. Project scaffolding
2. Config and shared types
3. Input validation
4. Playwright rendering
5. Image comparison
6. Logging
7. AI adapter interface
8. Initial generation flow
9. Revision flow
10. Full run-loop orchestration
11. VSCode task integration
12. README
```

---

## 22. README最低要件 / Minimum README Requirements

README must include:

* project purpose
* setup steps
* how to place input image
* how to run VSCode task
* output locations
* configuration points
* known limitations

---
