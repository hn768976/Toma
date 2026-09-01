# Analytics Dashboard — flat (v1)

A 4K "analytics dashboard" animation for Remotion. Frontal, magenta and blue.
All content is invented: the metric labels, the series, the ticker instruments
and their values are fictional and do not reproduce any real product's
interface, naming, layout or branding, and the ticker carries no real commodity
names or real prices.

## Composition

| | |
|---|---|
| Composition id | **`AnalyticsFlat`** |
| Resolution | **4K — 3840 × 2160** |
| Duration | **300 frames** |
| FPS | **30** (300 / 30 = **10.0 s**) |
| Loops? | **No.** One shot — the values climb and hold. Frames 0 and 300 differ by design, so do not use this as a seamless loop. |

## Extra dependencies

None beyond a standard Remotion project. `@remotion/google-fonts` supplies the
typeface metadata; the woff2 itself is vendored in `public/fonts/` so the render
needs no network access.

## Render at 4K

```bash
npm install
npx remotion render AnalyticsFlat out/analytics-flat.mp4 --codec=h264 --crf=12 --concurrency=8
```

Lower `--concurrency` to the number of CPU cores you actually have; Remotion
refuses a value above it.

Preview at 1080p while you work:

```bash
npx remotion render AnalyticsFlat out/analytics-flat-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion studio
```

## How it is built

* **Everything is drawn to the dashboard's own offscreen canvas.**
  `src/dashboard/renderDashboard.ts` paints the complete frame into a
  caller-supplied canvas of known dimensions, purely as a function of the frame
  number. `src/AnalyticsFlat.tsx` does nothing but blit that buffer. (The tilted
  companion version takes the same buffer and uploads it as a 3D texture — this
  seam is why that version is a texture swap rather than a rebuild.)
* **One shared timeline.** `src/dashboard/timeline.ts` computes a single
  normalised progress; the line reveal, the bar growth, the counters, the donut
  sweep, the sparklines and the side-panel bars all read from it. The ticker is
  the one deliberate exception — it runs straight off the frame number so it
  keeps moving through the zeroed head and the held tail.
  * frames **0–15** — present but at zero: flat lines, counters at 0, empty donut
  * frames **15–260** — everything advances together
  * frames **260–300** — hold
* **Counters jump, they do not slide.** Each counter has a seeded polling
  staircase: irregular moments, irregular increments, flat holds in between,
  monotonic. See `buildStaircase` in `timeline.ts`.
* **Deterministic.** All randomness is Remotion's `random()` with stable string
  seeds — never `Math.random()`. All motion comes from `useCurrentFrame()` and
  `interpolate()` — never `Date.now()`, `requestAnimationFrame`, CSS animation
  or component state. The series data is byte-identical on every render.
* **Static chrome is cached.** Panel borders, grid, axis labels, legends, the
  world map and the side-panel tracks rasterise once into a memoised offscreen
  canvas and cost one `drawImage` per frame. Only the extending lines, growing
  bars, climbing counters, donut sweep and ticker redraw.
* **One palette.** `src/variants.ts` is the only module in the project that
  contains a hex literal.
* **Tabular figures by hand.** Canvas 2D exposes no way to switch on a font's
  `tnum` feature, so `drawTabular` lays every digit on a fixed pitch. The
  counters cannot jitter as their digits change.
* **Finish.** Two-radius bloom on the line series and the counter numerals, an
  18 % vignette, and seeded film grain at 3 % alpha.

## Layout

```
┌──────────────────────── ticker (scrolls left, constant rate) ────────────────┐
├───────────────────────────────────────────────┬──────────────────────────────┤
│  line chart — 3 series + bars + legend        │  donut + legend              │
│  (Platform A heaviest/most volatile,          ├──────────────────────────────┤
│   B medium, C thinnest/calmest)               │  side panel — label rows     │
│                                               ├──────────────────────────────┤
├───────────────────────────────────────────────┤  side panel — label rows     │
│  5 counters, largest type in the frame,       ├──────────────────────────────┤
│  each with a label above and a sparkline below│  world map + highlights      │
└───────────────────────────────────────────────┴──────────────────────────────┘
```

## Source map

```
src/
  variants.ts                  palette + render mode (the only hex literals)
  AnalyticsFlat.tsx            v1 entry — blits the dashboard buffer
  Root.tsx                     composition registration
  dashboard/
    layout.ts                  all geometry, in a fixed 3840×2160 design space
    data.ts                    invented, seeded series / counters / ticker / map
    timeline.ts                the one shared normalised timeline
    fonts.ts                   Inter, gated with delayRender()/continueRender()
    renderDashboard.ts         paints the whole dashboard into a given canvas
    useDashboardBuffer.ts      owns the offscreen canvas, repaints per frame
    paint/
      ScreenChrome.ts          the cached static layer
      LineChartPanel.ts        bars + three extending series
      CounterBlock.ts          five counters + sparklines
      DonutPanel.ts            sweeping ring
      SidePanel.ts             stacked label rows + map highlights
      TickerStrip.ts           scrolling strip
      finish.ts                bloom, vignette, grain
      utils.ts                 canvas helpers, tabular numerals
```

### A note on the panel "components"

The brief named the panels as React components. They are separate modules with
exactly those names, but each exports a canvas **painter** rather than JSX: the
hard requirement that the entire dashboard rasterise into its own offscreen
canvas (so v2 can reuse the identical output as a texture) rules out DOM
rendering, and an explicit ordered painter list keeps the composite identical
whether it is driving a screen or a texture — no dependence on React commit or
effect ordering.
