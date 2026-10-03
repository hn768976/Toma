# Trading Terminal Close-Up (Remotion)

A close, tilted view of a dark trading screen in 2.5D. The screen is a flat UI
drawn with Canvas 2D. It is tilted with CSS 3D, the camera glides slowly
across it, and depth of field blurs it tilt-shift style. There are three shots
of the same terminal and five 15 s compositions. Nothing is a loop.

| Output file | Composition id | Shot | Trend |
|---|---|---|---|
| `TradingTerminal_Bear.mp4` | `TradingTerminal-Bear` | Overview | falling, red dominant |
| `TradingTerminal_Bull.mp4` | `TradingTerminal-Bull` | Overview | rising, green dominant |
| `OrderBook_Bear.mp4` | `OrderBook-Bear` | Chart + order book | falling |
| `OrderBook_Bull.mp4` | `OrderBook-Bull` | Chart + order book | rising |
| `IndicatorsMacro.mp4` | `IndicatorsMacro` | Indicator panels, extreme close-up | mixed |

> Remotion composition ids may only contain `a-z A-Z 0-9 -`, so the ids use `-`
> where the file names use `_`.

All compositions are 3840×2160, 30 fps and 450 frames.

## Setup

```bash
npm install
npx remotion studio        # preview
```

Pinned versions: remotion / @remotion/cli 4.0.515, react 19.2.3, typescript 5.9.3.

## Render at 4K

```bash
npx remotion render TradingTerminal-Bear out/TradingTerminal_Bear.mp4
npx remotion render TradingTerminal-Bull out/TradingTerminal_Bull.mp4
npx remotion render OrderBook-Bear       out/OrderBook_Bear.mp4
npx remotion render OrderBook-Bull       out/OrderBook_Bull.mp4
npx remotion render IndicatorsMacro      out/IndicatorsMacro.mp4
```

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, PNG frames and
`--gl=angle`. Add `--concurrency=N` to suit the machine.

### 720p previews (as delivered)

```bash
npx remotion render <id> out/<name>.mp4 --scale=0.3333333333333333
```

ffprobe confirms the output is exactly 1280×720. `scripts/render-previews.sh`
renders all five and logs the timings.

### Stills (6000×3375)

```bash
npx remotion still TradingTerminal-Bear out/TradingTerminal_Bear_6k.png --frame=300 --scale=1.5625
```

The same command works for any id. Screen textures are capped at 8192 px per
side (a common GPU/compositor limit), so 6K stills are rasterised at that cap.
Text in the sharp band is about 20–30 % softer than native 6K. 4K is not
affected by the cap except where noted under "Render times".

## How it works

- **Engine.** HTML/CSS layout with Canvas 2D for every chart. No WebGL.
  1. Each frame is drawn into a sharp screen canvas (`src/draw/*`).
  2. Bright elements are drawn a second time into a ¼-resolution bloom buffer,
     blurred and added back.
  3. Depth of field: on a flat tilted plane, blur in screen-texture space is
     proportional to |depth − focus depth|, and depth is linear across the
     plane. So a pyramid of blurred copies (`src/render/dof.ts`) is blended
     with linear gradient masks along the depth gradient. This is an exact
     tilt-shift for a plane, and the sharp band follows the camera's focus
     point.
  4. The result is placed in the frame with a CSS `matrix`. Its 3D transform
     uses the same math as the DOF (`src/render/camera.ts`).
  5. An output-pixel grain layer and a vignette go on top.
- **Data.** `src/engine/data.ts` contains:
  - a seeded random walk with drift and AR(1) momentum (`mulberry32`,
    generated once at module level);
  - intra-candle tick paths (Brownian bridges) so the live candle grows,
    shrinks and closes;
  - EMA 20 with a 2σ band, SMA 50, RSI(9) with an EMA(3) signal, and
    MACD(12, 26, 9).
- **Clock.** A candle prints every 45 frames (1.5 s). The live price ticks
  every 3 frames. On each close the chart scrolls one slot over 12 frames.
  Value tags update every 6 frames with a 4-frame digit roll.
- **Order book.** Each price level refreshes on its own seeded schedule. On
  the trend side the levels update about twice as often (more red flashes in
  asks for Bear, more green in bids for Bull). A changed row flashes. Depth
  bars are cumulative. The highlighted row is the live price, and the ladder
  re-centres smoothly so the highlight drifts. The chart's current-price tag
  sits at the same height.
- **Signal panel.** Each of 20 rows changes rating on its own seeded period,
  picking from the version's `signalMix`.

All numbers are invented. The screen has no tickers, company names, exchange
names or logos.

### Determinism

Every value is a pure function of `useCurrentFrame()`:

- `Math.random()`, `Date.now()`, CSS animations and transitions are never
  used.
- `useState` never drives visuals.
- Canvases are fully redrawn every frame. Scratch buffers are cleared before
  use.
- Fonts (Inter, JetBrains Mono; OFL, in `public/fonts`) are loaded behind
  `delayRender`, and every frame waits for them before drawing.

To check it, run `scripts/determinism.sh <id>`. It renders all 450 frames on
4 threads as PNG, then renders frame 300 alone from a cold start, and compares
SHA-256 hashes.

### Banding

Grain is ±4 levels (≈1.5 %). It comes from 8 pre-generated 256² noise tiles,
picked and offset by frame number. It is composited as `difference` (0..2A)
plus a constant `plus-lighter` (+A), which makes it zero-mean. To check the
encoded file, run `scripts/banding.py out/<name>.mp4 <frame> x0 y0 x1 y1`. It
reads a pixel line through a blurred dark area of a frame decoded from the
mp4.

## Add a version

Add a row to `VERSIONS` in `src/engine/versions.ts`:

```ts
{ id: "OrderBook_Sideways", shot: "orderbook", seed: 31, drift: 0, vol: 0.005,
  momentum: 0.5, startPrice: 27500,
  signalMix: { "Strong buy": 0.2, Buy: 0.25, Neutral: 0.35, Sell: 0.2 } },
```

`Root.tsx` registers it automatically as `OrderBook-Sideways`. Use
`npm run check-camera` to check that each shot's camera keeps the screen
covering the frame. Seeds were chosen so the trend holds through the clip.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/render-previews.sh [names]` | 720p previews + per-frame timings |
| `scripts/probe.sh` | ffprobe checks of `out/*.mp4` |
| `scripts/determinism.sh <id>` | frame 300 cold vs full render, byte for byte |
| `scripts/banding.py` | pixel profile from the encoded mp4 |
| `scripts/contact.sh <name>` | five evenly spaced frames → contact sheet |
| `src/check-camera.ts` | frame coverage / crop / texture-size check per shot |

## Render times (measured on this 4-core cloud container, no GPU)

| Composition | 720p, 4 threads, wall-clock per frame | 450 frames |
|---|---|---|
| TradingTerminal-Bear | 0.38 s | 2 min 50 s |
| TradingTerminal-Bull | 0.38 s | 2 min 50 s |
| OrderBook-Bear | 0.31 s | 2 min 20 s |
| OrderBook-Bull | 0.30 s | 2 min 16 s |
| IndicatorsMacro | 0.27 s | 2 min 03 s |

Single thread, Overview frames 100–159:
- 720p: about 1.0 s/frame.
- 1080p (`--scale=0.5`): about 2.2 s/frame.

Cost scales roughly with output pixels. It is dominated by Canvas 2D blur and
compositing of the screen texture.

**4K estimate.** 4K has 9× the pixels of 720p:
- about 9–10 s/frame on one thread;
- about 3–3.5 s/frame wall-clock with `--concurrency=4` on a similar 4-core
  machine, so roughly 25 min per composition.

A machine with more cores scales close to linearly with concurrency. A machine
with GPU-backed Chrome is faster still.

At 4K the screen texture reaches the 8192 px cap for the Overview (1.26 vs the
1.35 texture-px/output-px ideal at the end of the push-in) and the Order Book.
It stays above 1:1 everywhere in the sharp band, so text and 1 px lines are
crisp.

## Verification (as run for the delivered previews)

1. **File checks:** all five previews pass ffprobe (`scripts/probe.sh`):
   - h264, yuv420p, 1280×720, 30/1, 15.000 s, 450 frames, no audio stream.
   - `--scale=0.3333333333333333` rounds to exactly 1280×720.
   - `Config.setMuted(true)` removes the silent AAC track Remotion would
     otherwise add.
2. **Determinism:** frame 300 rendered alone from a cold start is
   byte-identical (SHA-256) to frame 300 of a full 4-thread PNG render, for all
   five compositions.
3. **Banding:** checked in frames decoded from the mp4s
   (`scripts/banding.py`). Blurred dark gradients climb smoothly, for example
   20.5 → 31.1 luma over 300 px. The largest smoothed step away from real
   edges is under 1 level. Grain survives encoding at about 1.4–1.8 levels
   px-to-px.
4. **Content:** checked on five evenly spaced frames per preview
   (`scripts/contact.sh`):
   - All five overview panels are present and candles print and scroll.
   - Bear is red/Sell-dominant; Bull is green/Strong-buy-dominant.
   - The order book has red asks over green bids with depth bars, flashing
     rows and a moving live row.
   - The macro shot is an oblique close-up with a tag column.

## Completion checklist

- [x] 5 compositions, 3840×2160, 30 fps, 450 frames, one data row per version
- [x] 2.5D: Canvas 2D screen, CSS 3D camera, tilt-shift DOF from blurred copies; no WebGL
- [x] Candles print every 1.5 s, the live candle grows/shrinks and closes, and the chart scrolls one slot per close
- [x] Bands, MAs, oscillator, histogram, area charts and signal labels update; value tags roll
- [x] Order book: asks/bids, depth bars, flashing rows, moving highlight, matching chart tag
- [x] Grain from pre-generated noise tiles indexed by frame; no `Math.random()` at render time
- [x] No `@keyframes`/transitions, no `Date.now()`, no `useState` visuals; canvases redrawn every frame
- [x] Fonts (OFL) shipped with licences, loaded behind `delayRender`
- [x] Frame 300 cold vs full render byte-identical (all five)
- [x] 720p previews pass the ffprobe checks
- [x] No tickers, company names, exchange names or logos; all numbers invented
