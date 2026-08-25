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
program of trend regimes — a 38-candle decline, a 27-candle base, a 47-candle
climb — and because the loop forces the walk back to where it started, that
program reads as a V-shaped recovery. Candle magnitudes are drawn from a cubed
distribution: mostly small candles with a handful of very large ones. Wicks
scale off each candle's own range and are zero about one time in six.

Candles are drawn as hollow outlines with the interior knocked back to the
substrate so the wick does not read through the body; about a quarter are
solid, mixed in irregularly.

The rightmost candle is still forming. Its close drifts, so the body grows and
shrinks and can flip between green and red, settling onto its true close as the
scroll locks it in.

## Deliberate departures from the brief

Three, all of them forced by something else in the brief:

1. **112 candles, not ~220.** The loop closes by scrolling exactly one series
   width across 1000 frames, which pins frames-per-candle to `1000 / N`. The
   brief also asks for roughly one candle every 9 frames. Those two can only
   both hold at N ≈ 111; 220 candles would need a ~1980-frame loop. The stated
   scroll speed and the exact loop won, since the shape of the walk survives
   the smaller count intact (the regime runs are still 27–47 candles).

2. **The price axis follows the trend.** With a fixed full-range fit, the
   visible window — about a quarter of the series — used a thin slice of the
   vertical band and left most of the frame empty. The axis now rides a rolling
   mean of the closes over one screen width (`PRICE_FOLLOW`, `PRICE_ZOOM` in
   `config.ts`). It is still a pure, periodic function of the frame, and it is
   the chart's price axis, not the camera — the camera is locked off, as
   specified.

3. **The chart panel ends at ~52% of frame width, not further right.** With the
   panel running to two thirds, the forming candle — the detail that makes the
   chart read as live — sat behind the maximum-blur ladder and was invisible.
   Pulling the live edge in also matches the reference framing, where the
   candles stop right about where the ladder starts.

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
