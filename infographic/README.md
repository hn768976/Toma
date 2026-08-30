# Infographic Sheet

A 4K infographic-sheet animation in Remotion, in three versions. One tilted
plane, one dataset, one shared timeline: as a year counter climbs, every donut
fills further, every bar grows and every line extends together.

| Composition | Version | Layout | Counter | Tilt |
| --- | --- | --- | --- | --- |
| `InfographicBlue` | v1 "blue" — corporate, light, dense | dense, 21 panels | 1965 → 2028 | -14°, recedes upper-right |
| `InfographicWarm` | v2 "warm" — editorial, sparse | sparse, 9 panels at ~1.7x | 1900 → 2000 | +11°, recedes upper-left |
| `InfographicDark` | v3 "dark" — inverted, cyan on charcoal | dense, 21 panels | 2000 → 2050 | -14°, recedes upper-right |

All three are 3840x2160, 450 frames at 30fps (15.0s), and none of them loop:
frames 0 and 450 differ by design.

## Run

```
npm install
npm run dev
```

## Render

1080p previews:

```
npx remotion render InfographicBlue out/infographic-blue-preview.mp4 --codec=h264 --crf=18 --scale=0.5
npx remotion render InfographicWarm out/infographic-warm-preview.mp4 --codec=h264 --crf=18 --scale=0.5
npx remotion render InfographicDark out/infographic-dark-preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

Full 4K:

```
npx remotion render InfographicBlue out/infographic-blue.mp4 --codec=h264 --crf=14 --concurrency=8
```

Lower `--concurrency` if the machine has fewer cores; Remotion refuses a value
above the core count.

## Standalone projects

```
node scripts/make-zips.mjs
```

Writes `dist-zips/infographic-{blue,warm,dark}.zip`: three self-contained,
independently runnable Remotion projects, each registering only its own
composition with only its own variant data inlined. `node_modules/`, `out/` and
`.git/` are never copied in.

## Layout

- `src/theme.ts` — the single `VARIANTS` object keyed by `blue | warm | dark`:
  palette, layout mode, counter range, chart mix, tilt, depth and finish
  settings. No colour literal lives anywhere else.
- `src/layout.ts` — the panel layout as **data**. Each entry gives a chart type,
  a position and size in sheet coordinates, and a stable seed; the renderer
  walks the array. v2's rearrangement is a different array and no new drawing
  code.
- `src/plane.ts` — the one affine transform for the whole sheet, plus depth
  bucketing.
- `src/components/` — `SheetPlane` and the chart components.
- `src/draw/` — canvas primitives, panel chrome, legends.

## How it works

**The plane.** One `ctx.setTransform()` rotates, shears and compresses the sheet
along its receding axis. Parallel lines stay parallel — this is not perspective.
The sheet runs past the frame on every side, so no page edge is ever visible.

Worth knowing before editing layout coordinates: the frame crops a tilted plane
as a *parallelogram*, not a rectangle. As sheet-x increases, the visible band of
sheet-y slides by the stagger slope of the plane matrix. `dense` answers this by
staggering whole columns down that slope so nearly every panel lands in the
crop; `sparse` instead keeps true sheet rows, which is what lets one line chart
run right across the sheet, and lets its rows crop at the frame edges.

**Depth of field.** The depth proxy is distance from a focal band across the
sheet's middle, perpendicular to the recession axis, so the sharp strip runs
from the near-lower-left to the far-upper-right. It drives blur only; everything
shares one brightness. Panels are bucketed into three offscreen buffers — near,
mid, far — and each buffer is blurred **once** on its way to the main canvas.
Blurring 21 panels individually would be unusably slow at 4K. The drift runs
parallel to the band, so no panel ever changes bucket and no blur pops.

**Coupling.** `timelineAt(frame)` is the only clock. Frames 0-20 sit at zero,
20-420 climb with a slight ease, 420-450 hold. Every chart and the counter are
functions of that one number, which is the whole point of the piece: the sheet
is one dataset progressing through time, not a collection of independent
animations.

**Performance.** Each panel's static content — grids, baselines, headings, whole
text blocks — is rasterised once into an offscreen canvas via `useMemo` and
blitted. Only the arcs, bars, lines and numbers redraw per frame.

**Determinism.** Motion comes from `useCurrentFrame()` with `interpolate()` and
`spring()`; all chart data from Remotion's `random()` with stable string seeds.
No `Date.now()`, no `requestAnimationFrame`, no CSS animation, no state — so
repeated renders are byte-identical.

**Type.** Inter (latin subset) is bundled in `public/fonts/` and loaded behind
`delayRender()`/`continueRender()`, so no frame is captured with a fallback face
and a render never needs the network. Canvas 2D exposes no
`font-feature-settings`, so tabular figures are produced in code: every digit is
laid out on a fixed advance, which is what stops the climbing percentages
jittering.

## Content

All copy is invented filler. No real text, no logos, no watermark, no audio.
