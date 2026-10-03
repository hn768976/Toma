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
doesn't pay for them. Text and 1-px lines are drawn at about 2.6 canvas pixels
per screen unit at 4K, so they stay crisp after the camera's ~2.4–2.6× push-in.

## Stills (6000×3375)

```bash
npx remotion still TradingTerminal-Bear out/TradingTerminal_Bear_6k.png --frame=225 --scale=1.5625
npx remotion still TradingTerminal-Bull out/TradingTerminal_Bull_6k.png --frame=225 --scale=1.5625
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. (Not rendered here.)

## Render time

RENDER_TIME_SECTION

## How it is built

* **2.5D.** The screen is one flat UI drawn with **Canvas 2D** (all charts and
  text) and tilted with **CSS 3D**: `perspective(9000px) rotateY(−20°→−17.5°)
  rotateX(15°→13.8°)` plus a slow pan from the main chart toward the signal
  panel and a push-in from 2.40× to 2.58×. Yaw is applied before pitch so
  horizontal chart lines stay level and vertical lines lean, as on a real
  screen filmed from the side. No WebGL.
* **Depth of field.** The canvas is shown three times: sharp, lightly blurred
  (5.5 px) and strongly blurred (15 px). The two sharper copies are masked by a
  linear gradient that runs along the line of constant depth through the focus
  point (computed from the rotation each frame), so the sharp band follows the
  camera. Blurred copies are drawn from a ⅓-resolution copy of the canvas.
* **Data.** Every series comes from a seeded `mulberry32` random walk with drift
  (negative for Bear, positive for Bull), generated once at module level
  (`src/data.ts`). Indicators: Bollinger band (20, 2) with its middle line,
  EMA 50, stochastic (9, 3, 3), MACD (12, 26, 9) and its histogram.
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

DETERMINISM_SECTION

## Banding

The dark background is blurred, so it can band. A grain of about ±1.5 %
(triangular noise, peak ±3.8 levels of 255) is added over the final image. It
comes from 8 pre-generated 128×128 noise tiles (seeded `mulberry32`), picked by
`frame % 8` and offset by a frame-based shift. It is split into a positive half
(`mix-blend-mode: plus-lighter`) and a negative half (`difference`), so it adds
no average brightness. The grain canvas is sized to the output pixel grid.

BANDING_SECTION

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

CHECKLIST_SECTION
