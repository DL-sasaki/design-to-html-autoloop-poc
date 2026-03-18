# design-to-html-autoloop-poc

## Purpose

A local PoC pipeline that takes `input/design.png`, generates static `HTML/CSS`, renders it, computes image diff, and iteratively revises output.

## Setup

1. Install dependencies:

```bash
npm install
npx playwright install chromium
```

2. Place your source image at:

```text
input/design.png
```

PNG only.

## Run from VSCode Task

Run the task labeled:

```text
Generate from Design
```

It executes `npm run generate` from workspace root.

## Outputs

- `output/index.html`
- `output/styles.css`
- `renders/iteration-XX.png`
- `renders/final.png`
- `diff/iteration-XX-diff.png`
- `diff/final-diff.png`
- `logs/latest-status.json`
- `logs/run-summary.json`
- `logs/iterations/iteration-XX.json`

## Configuration

Edit centralized values in `scripts/shared/config.ts`:

- input/output paths
- `maxIterations`
- `targetDiffRatio`
- `minimumImprovement`
- viewport size

## Known Limitations

- Uses a mock AI adapter by default (`scripts/shared/ai-adapter.ts`).
- Single page and single input image only.
- Desktop-first static output.
