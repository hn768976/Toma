# AI Ops Motion — autonomous AI motion graphics (Remotion)

Two dark-mode motion graphics built with [Remotion](https://remotion.dev), each
authored once and published at both 4K and 1080p.

| Film | Composition IDs | Length | Layout |
| --- | --- | --- | --- |
| **Operations Matrix** | `OperationsMatrix4K`, `OperationsMatrix1080` | 20.0 s (600 frames) | Eight-panel command-centre dashboard: live execution graph, telemetry, event stream |
| **Processing Pipeline** | `ProcessingPipeline4K`, `ProcessingPipeline1080` | 15.0 s (450 frames) | Single horizontal seven-stage pipeline with an approve / escalate fork |

All four compositions run at **30 fps, 16:9**. Renders come out as **H.264 MP4,
yuv420p, bt709, no audio track**.

## Rendering

```bash
npm install

npm run render:matrix:1080     # out/operations-matrix-1080p.mp4
npm run render:pipeline:1080   # out/processing-pipeline-1080p.mp4
npm run render:matrix:4k       # out/operations-matrix-4k.mp4      (3840x2160)
npm run render:pipeline:4k     # out/processing-pipeline-4k.mp4    (3840x2160)

npm run build:1080             # both 1080p files
npm run build:4k               # both 4K files
```

Or drive the CLI directly:

```bash
npx remotion render OperationsMatrix4K out/operations-matrix-4k.mp4
```

`npm run dev` opens Remotion Studio to scrub the compositions interactively.

## How the two resolutions stay identical

Every element is authored against a fixed **1920x1080 design space** (see
`src/shared/theme.ts`). `src/shared/Scaled.tsx` wraps each film in that space and
applies a CSS transform to the composition's real size, so the 4K output is
re-rasterised by the browser at full resolution — text, hairlines and SVG are
genuinely sharp, not an upscale. Adding another size means adding a
`<Composition>` in `src/Root.tsx`; no layout code changes.

## Determinism

Nothing uses `Math.random()` or `Date.now()`. Wiggling numbers, sparklines,
scrolling waves, load-map cells and packet timing all come from the seeded
hash-noise helpers in `src/shared/rand.ts`, so any frame is reproducible on its
own and distributed renders cannot disagree with each other.

## Layout

```
src/
  Root.tsx              four <Composition> registrations
  styles.css            @font-face for the two bundled fonts
  fonts/                Space Grotesk + JetBrains Mono (latin subsets)
  shared/               design space, scaler, seeded noise, path maths, UI primitives
  matrix/               Operations Matrix film — one file per panel
  pipeline/             Processing Pipeline film — title, throughput, stages, timeline
```

Copy lives in `src/matrix/data.ts` and `src/pipeline/data.ts`: panel headings,
node names, stage names, log lines and the colour assignments are all data, so
retitling either film is a single-file edit.

## Render settings

`remotion.config.ts` pins the delivery format: H.264, yuv420p, CRF 17, bt709
colour space, and no silent audio track. It also reuses a Playwright Chromium if
one is present on the machine, which matters only in sandboxes that block
Remotion's own browser download — elsewhere the check is a no-op.
