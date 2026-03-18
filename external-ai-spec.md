# External AI Specification: design-to-html-autoloop-poc

## Goal
Generate and iteratively refine a single static web section from `input/design.png`.

## Input
- `input/design.png` (single section screenshot, PNG only)

## Output
- `output/index.html`
- `output/styles.css`
- `renders/iteration-XX.png`, `renders/final.png`
- `diff/iteration-XX-diff.png`, `diff/final-diff.png`
- `logs/latest-status.json`, `logs/run-summary.json`, `logs/iterations/*`

## Pipeline
1. Validate input
2. Generate initial section HTML/CSS
3. Render
4. Compare source vs render (center-aligned on comparison canvas)
5. Analyze diff
6. Revise code
7. Repeat until stop conditions
8. Finalize artifacts

## Stop Conditions
- max iterations reached
- `diffRatio <= targetDiffRatio`
- improvement stagnates
- fatal error

## AI Adapter
- Modes: `mock`, `prompt-export`, `gemini-cli`
- Default: `gemini-cli` via `gemini -m flash -p`
- All AI outputs must be strict JSON

## Required JSON Formats
### Initial/Revision
```json
{ "html": "<full html>", "css": "<full css>" }
```

### Diff Analysis
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

## Constraints
- Single static web section only
- Local-first execution
- Keep intermediate artifacts and JSON logs
- No fake reproduction using the source image as full-screen background
