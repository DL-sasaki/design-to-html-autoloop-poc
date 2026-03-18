# External AI Specification: design-to-html-autoloop-poc

## 1. Project Goal
Build a local-first PoC that converts a single design image into HTML/CSS, renders the result, compares it with the source image, and iteratively improves output.

## 2. Input/Output
- Input: `input/design.png` (PNG only, required)
- Main outputs:
  - `output/index.html`
  - `output/styles.css`
- Render outputs:
  - `renders/iteration-XX.png`
  - `renders/final.png`
- Diff outputs:
  - `diff/iteration-XX-diff.png`
  - `diff/final-diff.png`
- Logs:
  - `logs/latest-status.json`
  - `logs/run-summary.json`
  - `logs/iterations/iteration-XX.json`
  - `logs/ai/*` (AI request/response logs)

## 3. Runtime/Stack
- Node.js + TypeScript
- Playwright (render)
- pixelmatch + pngjs (image diff)
- VSCode Task integration

## 4. Execution Entry
- VSCode Task label: `Generate from Design`
- Command: `npm run generate`
- Entry script: `scripts/run-loop.ts`

## 5. Pipeline Flow
1. Validate input (`scripts/prepare-input.ts`)
2. Generate initial HTML/CSS (`scripts/generate-initial.ts`)
3. Render page (`scripts/render-page.ts`)
4. Compare images and compute metrics (`scripts/compare-images.ts`)
5. Analyze visual diff (`scripts/analyze-diff.ts`)
6. Revise HTML/CSS (`scripts/revise-code.ts`)
7. Repeat until stop condition
8. Finalize outputs/logs (`scripts/finalize.ts`)

## 6. Stop Conditions
Stop when any is true:
- max iterations reached
- `diffRatio <= targetDiffRatio`
- improvement stagnates for 2 consecutive iterations
- fatal error occurs

Default config (`scripts/shared/config.ts`):
- `maxIterations = 5`
- `targetDiffRatio = 0.08`
- `minimumImprovement = 0.01`

## 7. Progress Output (Terminal)
During run, status is printed as:
- `[RUNNING] iter=... phase=... diff=... msg="..."`
- `[METRIC] iter=... diff=... improvement=...`
- `[FAILED] ...` on error

## 8. AI Adapter Design
Adapter interface: `scripts/shared/ai-adapter.ts`

Supported modes (`config.ai.mode`):
- `mock`
- `prompt-export`
- `gemini-cli` (current default)

### 8.1 gemini-cli mode (current)
- Uses `gemini` command via child process
- Calls AI for:
  - initial generation
  - diff analysis
  - code revision
- AI must return JSON only
- Retries with stricter JSON-only prompt when needed
- Request/response artifacts are saved to `logs/ai/`

### 8.2 prompt-export mode
- Exports revision request to `prompts/generated/`
- Expects manual/CLI-filled response JSON

## 9. Required AI Response Formats
### 9.1 Initial / Revision
```json
{
  "html": "<full html>",
  "css": "<full css>"
}
```

### 9.2 Diff Analysis
```json
{
  "summary": "...",
  "issues": [
    {
      "category": "missing-element|spacing|font-size|alignment|color|layout-proportion|unknown",
      "severity": "low|medium|high",
      "description": "...",
      "suggestedAction": "..."
    }
  ]
}
```

## 10. Constraints
- Single static landing page only
- Single input image only
- Local-first execution
- Keep intermediate artifacts and logs
- No fake reproduction by placing the source image as full-page background
- No silent failure

## 11. Configuration Points
`config.ai.gemini`:
- command (`gemini`)
- args (`["-p"]`)
- timeoutMs
- retryCount

Paths, iteration settings, and viewport are centralized in `scripts/shared/config.ts`.

## 12. Acceptance Criteria
- Run starts from VSCode task
- HTML/CSS generated under `output/`
- At least one render + one diff created
- Iterative loop runs
- Per-iteration logs are saved
- Failures are recorded in JSON logs
- AI provider is abstracted behind adapter interface
