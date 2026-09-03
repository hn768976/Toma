# Animated Data Chart — "World Population"

Four stock motion-graphic versions of the same animated chart, built as flat SVG
in [Remotion](https://remotion.dev). Every composition is defined at
**3840×2160, 30 fps, 600 frames (20s)** and is designed to be rendered at 4K.

The build runs over the first ~9 seconds and then holds on the finished chart
for the rest, so a buyer can cut the hold to whatever length they need. It is
not a loop.

| Composition id | Version | Description |
|---|---|---|
| `V1-ChartLineDark` | V1 | Dotted cyan line on near-black — the reference match |
| `V2-ChartBarDark` | V2 | Bars growing from the baseline, same styling and beat |
| `V3-ChartAreaDark` | V3 | The dotted line plus a gradient fill under it |
| `V4-ChartLineLight` | V4 | Light mode: `#f5f6f8` ground, dark grid, no glow |

## Render at 4K

```bash
npm install

npx remotion render V1-ChartLineDark out/V1_ChartLineDark.mp4 --scale=1 --crf=16
npx remotion render V2-ChartBarDark  out/V2_ChartBarDark.mp4  --scale=1 --crf=16
npx remotion render V3-ChartAreaDark out/V3_ChartAreaDark.mp4 --scale=1 --crf=16
npx remotion render V4-ChartLineLight out/V4_ChartLineLight.mp4 --scale=1 --crf=16
```

`--scale=1` renders the composition at its native 3840×2160. Drop to
`--scale=0.5` for a 1920×1080 preview — the layout is identical, because every
measurement is a fraction of the frame's own width or height.

Stills (frame 400 is the completed chart):

```bash
npx remotion still V1-ChartLineDark out/V1_ChartLineDark.png --frame=400 --scale=1
```

Codec, pixel format (`yuv420p`), PNG intermediates and muting are set in
`remotion.config.ts`, so they do not need to be passed on the command line.

Preview and scrub in the studio:

```bash
npx remotion studio
```

## Re-dating the chart

Everything downstream is derived from `src/chart/data.ts`:

```ts
export const MONTHS = ["JAN", "FEB", … "DEC"];   // X labels — one-line swap
export const VALUES = [520, 180, 500, …];        // one value per month
export const ORIGIN_VALUE = 200;                  // where the line meets the Y axis
export const Y_TICKS = [100, … 1000];             // Y labels
export const Y_MAX = 1100;                        // top of the grid
export const TITLE = "WORLD POPULATION";
export const SUBTITLE_LINES = [ … ];              // placeholder copy
```

`MONTHS` keeps the reference's `AGO` rather than `AUG`. Changing the number of
months or the value range re-lays the grid, the labels and the series
automatically; nothing else needs editing.

## Timing sheet

All beats live in `src/chart/timing.ts`, in frames at 30 fps.

| Frames | Beat |
|---|---|
| 0–20 | Dashed Y axis wipes up from the origin, dashed X axis wipes right (`easeOutCubic`) |
| 15–45 | Y labels fade in bottom-to-top, 2 frames apart |
| 30–90 | Vertical grid lines draw downward, staggered left to right; horizontals fade in behind |
| 25–52 | Title types on character by character |
| 52–70 | Subtitle types on, line one then line two, at one shared character rate |
| 60–270 | The series draws left to right at a linear pace; each month label fades in as the series crosses its column |
| 270–600 | Hold, with a ±5% glow pulse on a 90-frame cycle |

Nothing scales or slides in from off-frame — everything is drawn or typed.

## Project structure

```
src/
  index.ts              registerRoot
  Root.tsx              the four <Composition> definitions
  load-fonts.ts         loads the bundled Inter from public/fonts
  chart/
    data.ts             the dataset and all copy
    timing.ts           the timing sheet and composition dimensions
    layout.ts           layout fractions, value→pixel maps, polyline helpers
    theme.ts            dark and light palettes
    DataChart.tsx       assembles one chart from a variant + theme
    parts/
      Axes.tsx          the two dashed axes and their wipe
      Grid.tsx          vertical and horizontal grid
      Labels.tsx        Y ticks and month labels
      TitleBlock.tsx    typewriter title and subtitle
      SeriesLine.tsx    dotted line, optional area fill (V1, V3, V4)
      SeriesBars.tsx    bars (V2)
public/fonts/           Inter (latin subset, variable weight)
```

### Notes on the build

- **Resolution independence.** `DataChart` reads `useVideoConfig()` and passes
  the frame size to `getLayout()`, which expresses every position, font size and
  stroke width as a fraction of width or height. A 1080p preview and a 4K render
  are the same picture at different sizes.
- **The dotted series is real geometry.** The dots are individual `<circle>`
  elements placed at an even pitch along the polyline, revealed in sequence.
  A dashed stroke under a moving mask would slide the dash phase around instead
  of adding one dot at a time.
- **The axes wipe by moving their end point,** not by masking a finished line,
  so the dash pattern stays anchored at the origin and the dashes appear one
  after another.
- **Fonts are bundled**, not fetched from a CDN, so the project renders
  identically offline. The stack falls back to Helvetica Neue / Arial.

## Requirements

Node 18+ and the platform packages `npm install` pulls in for you. Remotion
downloads a headless Chrome on first render. If your machine needs to use a
browser that is already installed, pass `--browser-executable=/path/to/chrome`
or set it in `remotion.config.ts` — see
<https://www.remotion.dev/docs/config#setbrowserexecutable>.
