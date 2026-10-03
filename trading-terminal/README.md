# Trading Terminal Close-Up (Remotion)

Two 15-second, 30 fps, 2.5D motion graphics of a dark trading screen seen close
and tilted, with candles printing, indicators updating, price tags rolling and
a slow camera glide with tilt-shift depth of field.

| Composition id         | Output file                | Trend                                               |
|------------------------|----------------------------|-----------------------------------------------------|
| `TradingTerminal-Bear` | `TradingTerminal_Bear.mp4` | price falling with bounces, red dominant, mostly **Sell** |
| `TradingTerminal-Bull` | `TradingTerminal_Bull.mp4` | price rising with dips, green dominant, mostly **Strong buy** |

Remotion composition ids may not contain `_`, so the ids use `-`; the rendered
files use the `_` names.

Compositions are defined at **3840×2160**, 450 frames (15 s), 30 fps. Nothing
loops.

## Quick start

```bash
npm install
npx remotion studio
```

Node 18+ is required. All versions in `package.json` are pinned.

## Render at 4K

```bash
npx remotion render TradingTerminal-Bear out/TradingTerminal_Bear.mp4
npx remotion render TradingTerminal-Bull out/TradingTerminal_Bull.mp4
```

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, no audio and PNG
intermediate frames (JPEG frames would smear the anti-banding grain). Add
`--concurrency=<n>` to suit the machine.

720p previews (what was rendered here):

```bash
npx remotion render TradingTerminal-Bear out/TradingTerminal_Bear.mp4 --scale=0.3333333333333333
```

`--scale` sets the browser's device pixel ratio. The screen canvases size their
backing store from it, so a 4K render gets 4K-crisp canvases and a preview
doesn't pay for them. At 4K the screen canvas is drawn at 2.8 canvas pixels per
screen unit (8120×3248), so text and 1-unit lines stay crisp after the camera's
2.2–2.4× zoom plus perspective.

## Stills (6000×3375)

```bash
npx remotion still TradingTerminal-Bear out/TradingTerminal_Bear_6k.png --frame=225 --scale=1.5625
npx remotion still TradingTerminal-Bull out/TradingTerminal_Bull_6k.png --frame=225 --scale=1.5625
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. (Not rendered here.)

## Render time

Measured here: 4 vCPUs, 15 GB RAM, Chromium headless shell (software
rendering, no GPU), `--concurrency=4`, PNG intermediate frames, 720p
(`--scale=0.3333333333333333`):

| Composition | 450 frames, wall time | Per frame (wall) | Per frame per thread |
|-------------|-----------------------|------------------|----------------------|
| Bear        | 290.7 s               | 0.65 s           | ≈2.6 s               |
| Bull        | 276.8 s               | 0.62 s           | ≈2.5 s               |

A single cold `remotion still` of one frame takes about 2.1 s plus bundling.

**4K estimate.** Nearly all the cost scales with pixel count: canvas raster,
the three composited blur layers and PNG capture. 4K has 9× the pixels of
720p, so expect about **5.5–6 s per frame wall time at concurrency 4** on a
similar 4-core machine (≈23 thread-seconds per frame). That is roughly **40–45
minutes per composition**, and it scales down with more cores and a GPU.
No 4K frames were rendered to measure this.

## How it is built

* **2.5D.** The screen is one flat UI drawn with **Canvas 2D** (all charts and
  text) and tilted with **CSS 3D**: `rotateZ(−4.2°→−3.6°) perspective(2700px)
  rotateY(−20°→−17.5°) rotateX(15°→13.8°)`, a slow pan from the main chart
  toward the signal panel and a push-in from 2.20× to 2.38×. The small roll
  keeps the panel divider near vertical, as in the reference. No WebGL.
* **Depth of field.** The canvas is shown three times: near-sharp (0.8 px),
  lightly blurred (5.5 px) and strongly blurred (14 px), in 4K CSS pixels. The
  two sharper copies are masked by a linear gradient that runs along the line
  of constant depth (computed from the rotation each frame) and sits slightly
  toward the near side, so the sharp band follows the camera and the far side
  falls off hardest. Blurred copies are drawn from a ⅓-resolution copy of the
  canvas.
* **Data.** Every series comes from a seeded `mulberry32` random walk with drift
  (negative for Bear, positive for Bull), generated once at module level
  (`src/data.ts`). Indicators: Bollinger band (20, 2) with its middle line,
  EMA 40 and 50 (a two-strand ribbon), stochastic (6, 2, 2), MACD (12, 26, 9)
  and its histogram with a signal line.
* **Candles.** A new candle forms at the right edge every 45 frames (1.5 s). Its
  live price follows a fixed path open → high/low → low/high → close, sampled in
  4-frame ticks; the wick grows to the extremes reached so far. When it closes,
  the chart eases one slot left over 10 frames. The price scale eases between
  the ranges of consecutive windows.
* **Tags** on the axes tick every 4 frames; each changed digit rolls vertically
  over 3 frames.
* **Signal panel.** Ten cells hold a fixed mix of labels (Bear: 5 Sell, 2
  Neutral, 2 Buy, 1 Strong buy; Bull: 5 Strong buy, 2 Buy, 2 Neutral, 1 Sell).
  Every 1.3–2.6 s two cells swap labels with a short slide, so the mix holds on
  every frame. Icons are drawn chevrons and dashes.
* **No real names.** No tickers, company, exchange or platform names, logos or
  wording beyond generic terms. All numbers are made up.

## Determinism

Everything on screen is a pure function of `useCurrentFrame()`:

* `Math.random()` is never used. `mulberry32` is seeded at module level; all
  random data, including the grain tiles, is generated once at import.
* No CSS animations or transitions, no `Date.now()`, no state driving visuals,
  nothing carried between frames. The forming candle, scroll offset, ranges,
  indicator values, tag rolls and signal transitions are all recomputed from the
  frame number. Canvases are cleared and fully redrawn every frame.
* Fonts load through `FontFace` behind `delayRender` / `continueRender`, and
  the canvases are drawn only after they are ready.

**Checked.** For both compositions, frame 300 rendered alone by a cold
`remotion still` is **byte-identical** to frame 300 from a full
`remotion render --sequence` (4 threads, out of order). SHA-256: Bear
`3397080f…f5c4`, Bull `cde0e116…433c`.

## Banding

The dark background is blurred, so it can band. A grain of about ±1.5 %
(triangular noise, peak ±3.8 levels of 255) is added over the final image in
2×2-pixel cells. It comes from 8 pre-generated 128×128 noise tiles (seeded
`mulberry32`), picked by `frame % 8` and offset by a frame-based shift.
Single-pixel grain this faint was dropped by x264 in the dark areas (it left
blotchy flat patches); 2×2 cells survive CRF 16. It is split into a positive half
(`mix-blend-mode: plus-lighter`) and a negative half (`difference`), so it adds
no average brightness. The grain canvas is sized to the output pixel grid.

**Checked on the encoded mp4, not the preview.** Frame 0 of each mp4 was
extracted and the luma read across the blurred, dark navy area between the
histogram and MACD panels in the far (top-left) corner (x 0–400, y 600–625 at
720p). Averaged over 25 rows, the values climb smoothly from about 27 to 37,
with no flat runs ending in a step; the largest step between neighbouring
pixels after light smoothing is 0.56 levels. A ×6 contrast stretch of the
same crop shows even grain and no contour bands.

## Fonts

`public/fonts/` holds Inter (400/500/600) and JetBrains Mono (500/600), latin
subset, woff2, both under the SIL Open Font License 1.1 (`Inter-OFL.txt`,
`JetBrainsMono-OFL.txt`). Taken from the `@fontsource/inter@5.2.8` and
`@fontsource/jetbrains-mono@5.2.8` packages.

## Adding a version

1. Add a row to `VERSIONS` in `src/versions.ts`: an `id` (letters, digits and
   `-` only), a `seed`, the price-walk `drift` and `vol`, `startPrice`, the
   two area-chart drifts and the `signalMix` (shares out of 10 cells).
2. That's all: `Root.tsx` registers a composition for every row.
3. Check the trend lands where you want it over the 10 candles that print
   during the clip (indices 205–214) and over the ~30 visible ones before it.
   Seeds 1016 (Bear) and 1052 (Bull) were picked that way: the trend over the
   clip is clear, the visible price range is tight enough for chunky candles,
   and over 60 % of candles in view go with the trend.

## Files

```
src/
  index.ts       registerRoot
  Root.tsx       one <Composition> per version
  versions.ts    version table (one row each)
  data.ts        timing constants, seeded data, indicators
  draw.ts        Canvas 2D drawing of the whole screen for a frame
  Terminal.tsx   camera, depth-of-field layers, grain, vignette
  grain.ts       noise tiles and grain drawing
  rng.ts         mulberry32 and a gaussian
  fonts.ts       FontFace loading
public/fonts/    fonts and licences
```

## Completion checklist

- [x] 2 compositions, 3840×2160, 30 fps, 450 frames, not looping
- [x] Bear: price falls with bounces, red dominant, mostly Sell, area chart falls
- [x] Bull: price rises with dips, green dominant, mostly Strong buy, area chart rises
- [x] Main chart: candles, two MAs plus a shaded band, axis tags, volume
- [x] Oscillator, histogram with signal line, red and green area charts, signal panel with self-drawn icons
- [x] A candle every 1.5 s, scrolling one slot on close; tags roll; signals switch
- [x] Tilted 2.5D camera gliding from the main chart to the signal panel with push-in; tilt-shift DOF
- [x] Canvas 2D for every chart, HTML/CSS layout, no WebGL, no MCP
- [x] Grain from fixed noise tiles indexed by frame; no `Math.random()`
- [x] Deterministic: frame 300 cold equals frame 300 in a full render, byte for byte (both)
- [x] Fonts behind `delayRender`; OFL licences included
- [x] 720p previews: 1280×720, 30/1, 15.0 s, H.264, yuv420p, no audio (ffprobe)
- [x] Banding checked on the encoded mp4
- [x] 720p PNG still of each
- [x] `npm install && npx remotion studio` works from a clean copy
- [x] Render time measured at 720p; 4K estimated
- [x] No tickers, company, exchange or platform names, or logos
