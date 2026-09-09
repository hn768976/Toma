# Data Report Dashboard — Remotion template

A clean, light-or-dark report panel: a category pill, a title and subtitle, a
card holding an S-curve with pulsing cluster markers, a row of four KPI boxes,
a scrolling ECG trace and a data disclaimer.

Everything is real DOM, CSS and SVG — no canvas, no 3D, nothing rasterised — so
the type stays crisp at any render scale.

**Compositions are defined at 3840×2160, 30fps, 450 frames (15s).** They build
and hold; they are not loops.

---

## ⚠️ Data honesty

**Every number in this project is invented.** There are no real case counts, no
real climate figures, no real place names, organisations or dates. The titles
are deliberately generic.

Each topic carries a `footnote` that says so, and it is rendered in every
version:

- Health: *Illustrative epidemiological model — not real outbreak data*
- Climate: *Illustrative climate model — not real monitoring data*

**Keep the footnote.** Health and climate graphics get cut into news coverage;
the disclaimer is what stops a generic panel being read as a record of a real
event. If you add a topic, write it a matching footnote — do not leave the
field blank and do not shrink it below the size set in `src/layout.ts`, which
is chosen so it stays readable at 1080p.

---

## Install

```bash
npm install
```

The Inter variable font is vendored at `public/fonts/Inter-Variable.woff2` and
loaded through `delayRender()`, so rendering never depends on a network fetch
and no frame is ever captured with a fallback face.

## Preview in the browser

```bash
npm run dev
```

## Render at 4K

Full 3840×2160, one command per composition:

```bash
npx remotion render V1-ReportHealthLight   out/V1_ReportHealthLight.mp4   --scale=1 --crf=16
npx remotion render V2-ReportHealthDark    out/V2_ReportHealthDark.mp4    --scale=1 --crf=16
npx remotion render V3-ReportClimateLight  out/V3_ReportClimateLight.mp4  --scale=1 --crf=16
```

Stills (frame 400 is fully built and holding):

```bash
npx remotion still V1-ReportHealthLight   out/V1_ReportHealthLight.png   --frame=400 --scale=1
npx remotion still V2-ReportHealthDark    out/V2_ReportHealthDark.png    --frame=400 --scale=1
npx remotion still V3-ReportClimateLight  out/V3_ReportClimateLight.png  --frame=400 --scale=1
```

### 1080p previews

Same compositions at half scale — this is what ships in `out/`:

```bash
npx remotion render V1-ReportHealthLight out/V1_ReportHealthLight.mp4 --scale=0.5 --crf=18
```

`h264` / `yuv420p` are set in `remotion.config.ts`, so the output plays
everywhere without further flags.

---

## Adding a new topic

The layout, timing and animation are identical whatever the subject. A new
topic is **a data entry and a registration** — no component changes. If a new
subject needs you to edit a component, the template has a gap worth fixing
rather than working around.

### 1. Add the topic to `src/topics.ts`

Export a new `Topic` beside `HEALTH` and `CLIMATE`:

```ts
export const ENERGY: Topic = {
  category: "GRID OPERATIONS",        // the pill, short letter-spaced caps
  title: "Regional Load Analysis",    // keep it generic — no real places
  subtitle: "Demand growth and reserve margin across a modelled network",
  chartLabel: "DEMAND CLUSTERS",      // dim caps, top-left of the card
  chartData: S_CURVE,                 // or your own normalised points
  stats: [
    { label: "PEAK DEMAND", value: 41.8, decimals: 1, suffix: " GW", delta: "+2.6%" },
    { label: "RESERVE MARGIN", value: 14, decimals: 0, suffix: "%", delta: "-1.1%" },
    { label: "ACTIVE NODES", value: 1260, decimals: 0, thousands: true, delta: "+45" },
    { label: "UPTIME", value: 99.6, decimals: 1, suffix: "%", delta: "+0.2%" },
  ],
  footnote: "Illustrative network model — not real operational data",
  accent: { /* light-ground accents, see below */ },
  accentDark: { /* the same hues lifted for the dark ground */ },
  markerSeed: 4390,
  markerCount: 10,
};
```

**Stat fields.** `value` is the target the counter climbs to; `decimals`,
`thousands`, `prefix` and `suffix` control formatting and are fixed by the stat
rather than by the current value, so the row never reflows mid-count. `delta`
is rendered verbatim beside the value and is coloured `accent.negative` when it
starts with `-`, `accent.positive` otherwise.

Keep it to **four stats**. If a label is too long to sit on one line, shorten
the label or drop to three boxes — do not reduce the type size, which is set at
the legibility floor for 1080p.

**`chartData`** is normalised: `x` runs 0→1 left to right, `y` runs 0→1 bottom
to top. Reuse the exported `S_CURVE`, or supply your own points; they are drawn
as a Catmull-Rom spline, so 6–10 points give a smooth curve without overshoot
at the flat ends.

**`markerSeed`** seeds the cluster scatter. Change the number to reshuffle the
layout; the same seed always yields the same arrangement, which is what lets
Remotion render frames out of order across threads.

### 2. Set the accent

`accent` is used on the light ground, `accentDark` on the dark one — the same
hues, lifted slightly so they hold up against `#0e1114`.

| Field | What it colours |
|---|---|
| `line` | the chart curve |
| `marker` | the cluster dot |
| `halo` | the marker halo, as an unquoted `"r,g,b"` triple |
| `positive` / `negative` | the stat deltas |
| `badgeBg` / `badgeText` | the category pill |

`halo` must be the numeric triple matching `marker` (e.g. `marker: "#e04a3a"`
→ `halo: "224,74,58"`), because the halo needs that colour at several alpha
stops.

The shipped accents:

- **Health** — teal `#2a8a8a` curve, red `#e04a3a` markers
- **Climate** — green-blue `#2a7a9a` curve, amber `#d99022` markers

### 3. Register it in `src/Root.tsx`

```tsx
<Composition
  id="V4-ReportEnergyLight"
  component={ReportDashboard}
  durationInFrames={DURATION_IN_FRAMES}
  fps={FPS}
  width={WIDTH}
  height={HEIGHT}
  defaultProps={{ topic: ENERGY, style: "light" as const, idPrefix: "v4" }}
/>
```

`style` is `"light"` or `"dark"`. `idPrefix` must be unique per composition — it
namespaces the SVG gradient and filter ids so two instances can share a page in
the Studio without colliding.

That is the whole procedure: **one entry in `topics.ts`, one `<Composition>`.**

---

## Project layout

```
src/
  index.ts           registerRoot
  Root.tsx           composition registrations — one per topic × style
  ReportDashboard.tsx the whole piece; everything subject-specific is a prop
  topics.ts          ← topic data lives here (copy, numbers, curve, accent)
  theme.ts           light and dark grounds
  layout.ts          all geometry in 3840×2160 design px, scaled at runtime
  timing.ts          the build, as frame ranges
  geometry.ts        curve spline and ECG path builders
  markers.ts         seeded cluster scatter
  format.ts          value formatting for the counters
  rand.ts            seeded PRNG (mulberry32)
  reveal.ts          the shared fade-and-rise entrance
  fonts.ts           vendored Inter + tabular-figure settings
  components/        Badge, Heading, ChartCard, StatRow, EcgLine, Footnote, Grain
public/fonts/        Inter-Variable.woff2
```

## The build

| Frames | Beat |
|---|---|
| 0–30 | Badge fades and scales up very slightly |
| 20–60 | Title fades in with a rise; subtitle follows 8 frames later |
| 50–90 | Main card fades in with a small rise |
| 80–200 | Chart line draws left to right, unaeased |
| 120–260 | Cluster markers appear one at a time, each with a halo that expands once and settles |
| 180–300 | Stat boxes fade in left to right, values counting up on an ease-out |
| 210–450 | ECG fades in and scrolls right to left, continuously |
| 300–450 | Hold — only the ECG and the marker halo pulses keep moving |

All timing derives from `useCurrentFrame()` with explicit `clamp`
extrapolation. There is no state and no timer anywhere, because Remotion
renders frames out of order across threads.

## Sizing

Geometry is written in design pixels against a 3840×2160 frame and multiplied
by a single factor taken from `useVideoConfig()`. Rendering at `--scale=0.5` or
at full 4K therefore changes the multiplier and nothing else.
