# Data Interface Stills

A Remotion project that generates **still images** of an abstract "data
interface panel" — binary blocks, labelled panels, charts, tables, waveforms
and a node web, all sitting on one tilted plane with a depth-of-field falloff.

There is no animation and no timing. The composition is one frame long and is
rendered with `remotion still`.

- **Composition id:** `DataInterface`
- **Output:** 3840 × 2160 PNG (4K, 16:9), `durationInFrames: 1`, `fps: 30`
- **Drawing:** a single `<canvas>`, drawn once via a ref — no DOM elements, no
  3D, no Three.js

---

## Props

Five props, all of which change the output.

| Prop | Type | Accepted values | Effect |
| --- | --- | --- | --- |
| `seed` | string | any string | Base for every random value in the image. |
| `palette` | string | `blue`, `cyan`, `green`, `amber`, `violet`, `red` | Background, grid, panel border and three content tones. |
| `layout` | string | `leftBinary`, `centreStack`, `scattered`, `grid`, `diagonalFlow`, `dense` | Which arrangement of regions fills the plane. |
| `tilt` | string | `left`, `right` | Which direction the plane recedes — and therefore which edge is blurred. |
| `density` | string | `sparse`, `medium`, `dense` | Panel count, gutters and content scale. Structure is unchanged. |

### Layouts

| Value | Composition |
| --- | --- |
| `leftBinary` | Large binary blocks stacked down the left half, a node web across the centre, smaller labelled panels and charts on the right. |
| `centreStack` | A tall column of labelled panels down the centre, binary blocks left, charts right. The most symmetrical layout. |
| `scattered` | Panels of widely varying sizes across the whole plane, slightly overlapping, with no column structure. Panels only — no binary blocks. |
| `grid` | A regular grid of equally sized panels, each a different content type. Reads as a monitoring wall. |
| `diagonalFlow` | A band running lower-left to upper-right, node web following the diagonal, corners left dark. The most open layout. |
| `dense` | Panels packed edge to edge with minimal gutters, filling the entire plane. |

### Determinism

Every random value comes from Remotion's `random()` keyed by the `seed` prop —
`Math.random` is never called. **The same props always reproduce exactly the
same image**, on any machine, at any time.

---

## Rendering a single still

```bash
npx remotion still DataInterface out/stills/interface-leftBinary-blue-medium-right.png \
  --props='{"seed":"leftBinary-blue-medium-right","palette":"blue","layout":"leftBinary","tilt":"right","density":"medium"}'
```

Add `--scale=0.25` for a fast low-resolution proof.

If Remotion cannot download its own Chrome Headless Shell (offline or
restricted network egress), point it at any Chromium build:

```bash
export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell
```

## Rendering the batch

```bash
node scripts/render-batch.ts                  # the whole batch into out/stills/
node scripts/render-batch.ts --only=amber     # only jobs whose filename matches
node scripts/render-batch.ts --concurrency=2  # default 3
node scripts/render-batch.ts --scale=0.25     # fast proofs
node scripts/render-batch.ts --force          # re-render files that already exist
```

The batch is:

1. **36 stills** — 6 layouts × 6 palettes, at `medium` density and `right` tilt.
2. **12 stills** — the two strongest layouts (`dense` in cyan, `leftBinary` in
   blue) × 3 densities × 2 tilt directions.

Two cells of the second sweep (`medium` density, `right` tilt) are by definition
already in the 6 × 6 grid and resolve to the same filename and the same image,
so the batch writes **46 distinct files**.

Naming: `interface-<layout>-<palette>-<density>-<tilt>.png`.

## Contact sheet

```bash
node scripts/contact-sheet.ts                 # -> out/contact-sheet.png
node scripts/contact-sheet.ts --cols=6 --tile=520
```

## Studio

```bash
npm run studio
```

---

## Project layout

```
src/
  index.ts                        registerRoot
  Root.tsx                        the DataInterface composition
  DataInterface.tsx               props -> layout -> content components
  interface/
    palettes.ts                   the six palettes (the only hex literals)
    plane.ts                      the tilted plane, depth and blur buckets
    layouts.ts                    the six layouts, as data
    types.ts                      props, regions, density settings
    rng.ts                        seeded randomness
    draw.ts                       frames, tabs, ticks, fonts
    ops.tsx                       depth-bucketed draw-op collection
    components/
      BinaryBlock.tsx  LabelledPanel.tsx  ChartPanel.tsx
      TablePanel.tsx   WaveformPanel.tsx  NodeWeb.tsx
      GridPlane.tsx    FocusPass.tsx      shared.ts
scripts/
  render-batch.ts                 the batch
  contact-sheet.ts                tiles out/stills into one sheet
  browser.ts                      browser resolution shared by both
```

A layout is pure data — a list of regions with position, size and content type.
The renderer walks the list and dispatches by type, so adding a seventh layout
needs no new drawing code.

All text in the image is fictional filler and illegible at the sizes used. No
real code, no real values, no logos, no watermark.
