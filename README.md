# CandleChart

A 4K, 16.67-second seamless loop: a macro shot of a market terminal, shot
off-axis with shallow depth of field. Built in Remotion v4 + TypeScript, drawn
entirely into a single `<canvas>`.

```bash
npm install
npm start                      # Remotion Studio
npm run build                  # 4K h264 render
npm run verify:loop            # proves frame 0 and frame 1000 are identical
```

Render command in full:

```bash
npx remotion render CandleChart out/candle-chart.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

The low CRF matters: the frame is mostly near-black gradients under heavy blur,
and those band badly at Remotion's default. `--concurrency` must not exceed the
machine's core count — drop it on smaller boxes.

## Determinism

Everything is a pure function of `useCurrentFrame()`. There is no `Date.now`,
no `requestAnimationFrame`, no CSS animation, no component state, and no
`Math.random` — the price series, the ladder layout, the bokeh, the flash
schedule and the film grain all come from seeded generators built once in a
`useMemo` and reused every frame. Frames can be rendered out of order, on any
machine, and come out identical.

The canvas is painted synchronously in a `useLayoutEffect` from the current
frame number, once per React render.

## The loop

Every time-varying quantity has period 1000:

| element | how it closes |
| --- | --- |
| scroll | translates by exactly one series width across 1000 frames |
| price walk | the per-candle steps are mean-subtracted so `close[N] === close[0]`, and candle `i` opens on `close[i]` and closes on `close[i+1]` — so the last candle hands off to the first |
| brightness breathe | sine of period 500 |
| flash schedule | evaluated against this loop and the previous one, so a flash that starts near frame 1000 carries its tail across the seam |
| grain | 8 tiles indexed by `frame % 8`, offset by `frame % 1000` |

`npm run verify:loop` renders the seam and compares it byte for byte. That is
what the extra `CandleChartLoopCheck` composition exists for — it is the same
component one frame longer, so frame 1000 is renderable.

## How the shot is put together

**Two coordinate systems.** Content is laid out on a flat *board* — the
terminal's screen — and a single affine matrix (rotate −8°, shear, compress the
right side) maps board to screen. That is the whole off-axis camera: parallel
lines stay parallel, which is invisible at this blur level. Anything that has
to land at a specific spot in frame is authored in screen coordinates and
pushed back through `boardFromScreen`.

**Three depth buffers, not per-element blur.** Every element is bucketed by its
distance from the focal point (the chart's mid-left, vertically centred) into a
sharp, mid or far buffer. Each buffer is blurred exactly once. Per-element
blurring at 4K would be unusably slow. Two details make it work:

- The bands overlap. An element near a boundary is drawn into both adjacent
  buffers with complementary alpha, so the buckets cross-fade instead of
  showing as seams.
- The mid and far buffers render at ½ and ⅓ scale and are blurred *at that
  scale*, with the radius scaled to match, before being upscaled. A quarter to
  a ninth of the pixels for the same result — the upscale hides the rest.

**Bloom.** Bright things in the blurred buffers are boosted and given an
additive halo *before* the blur, so defocused cells read as glowing discs
rather than smeared rectangles. Globally, the finished frame is downscaled,
multiplied by itself (which squares the values and so keeps the darks out of
it), blurred and composited back with `lighter`.

**Colour clamping preserves hue.** Boosting each channel independently turns a
bright green cyan the moment green and blue both peg. `tint` instead holds the
hue and rolls the excess into a white-hot core, which is what an overexposed
highlight actually does.

## The price series

220 candles of pure random walk look flat and characterless. This one is a
program of trend regimes — a 26-candle decline, a 20-candle base, a 34-candle
climb — and because the loop forces the walk back to where it started, that
program reads as a V-shaped recovery. Candle magnitudes are drawn from a cubed
distribution: mostly small candles with a handful of very large ones. Wicks
scale off each candle's own range and are zero about one time in six.

Candles are drawn as hollow outlines with the interior knocked back to the
substrate so the wick does not read through the body; about a quarter are
solid, mixed in irregularly.

The rightmost candle is still forming. Its close drifts, so the body grows and
shrinks and can flip between green and red, settling onto its true close as the
scroll locks it in. It sits at ~32% of frame width, inside the focal band, so
the formation is actually legible.

## Matching the reference

Most of the numbers in `config.ts` were measured off the reference clip rather
than guessed, because guessing kept landing in the wrong place. What was
measured, and how:

| quantity | method | result |
| --- | --- | --- |
| scroll rate | SSD block-match of a sharp chart band between frames 0→10 and 100→125 of the 768-wide encode | ~1.75 px/frame → 219 px/sec at 4K |
| candle pitch | detrended autocorrelation of the vertical-edge profile across the sharp band, confirmed by counting candles against a pixel ruler | ~46px at 4K (34px body, 12px gap) |
| focal band | 99.5th-percentile luminance-normalised gradient, tiled 8×6 across the frame | peaks at ~18% of frame width, gentle vertical falloff |
| live edge / panel edge | brightened crop of the chart's right half | last candle ~32% of width, panel runs to ~52% |
| ladder density | counting cells against the frame height | ~13 cells across frame, ~165px apart |
| tone | luminance percentiles at 640×360 | p25 16, p50 25, p75 51, p90 95, p99 215 |

The render now sits within a few levels of the reference at every percentile.
Two deliberate residuals: the blacks are a touch lifted (p1 12 vs 9) because
the reference is a JPEG with crushed shadows, and the peak highlight is a
little softer (p99 198 vs 215) because our ladder cells spread slightly wider
under the blur.

## Deliberate departures from the brief

Where the brief's numbers and the reference disagreed, the reference won — that
was the explicit call. Each departure below is a measurement, not a preference.

1. **80 candles at 12.5 frames each, not ~220 at ~9.** Two independent
   constraints collide here. The loop closes by scrolling exactly one series
   width across 1000 frames, which pins frames-per-candle to `1000 / N`. And
   the reference's actual scroll rate is 4.8 candles per second — 12.5 frames
   each at 60fps — not the ~6.7/sec the brief's "one candle every 9 frames"
   implies. Matching the measured rate fixes N at 80. The walk's shape survives
   intact: the regime runs are still 26 / 20 / 34 candles.

2. **Candle geometry 34/12/4, not 26/10/3.** Measured pitch is ~46px at 4K, not
   36. The brief's proportions are preserved; the scale is not.

3. **16 ladder cells, not ~28.** At 28 the chain fuses into a single bright
   stripe under this much blur. The reference resolves ~13 separate cells
   across the frame height, which is what 16 along the full chain gives.

4. **Two dashed price markers, not one**, and grid rules that are visible
   rather than "barely visible" — both are plain in the reference.

5. **The price axis follows the trend.** With a fixed full-range fit the
   visible window used a thin slice of the vertical band and left most of the
   frame empty. The axis now rides a rolling mean of the closes over one screen
   width (`PRICE_FOLLOW`, `PRICE_ZOOM`). Still a pure, periodic function of the
   frame, and it is the chart's price axis, not the camera — the camera is
   locked off, as specified.

## Layout

```
src/
  config.ts      geometry, palette, camera matrix, depth-of-field constants
  series.ts      the seeded price walk and its rolling mean
  motion.ts      pure frame -> value functions (scroll, breathe, flash, formation)
  layout.ts      depth bucketing, ladder, bokeh, terminal chrome
  render.ts      the painter: buffers, candles, ladder, bloom, vignette, grain
  CandleChart.tsx  canvas + useLayoutEffect
  Root.tsx       compositions
```
