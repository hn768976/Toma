# Global Markets — Remotion project

Three compositions, two looks, all **30 fps · 600 frames (20 s) · 3840×2160 · seamless loops**.

| Composition id | Look | Engine | GPU |
|---|---|---|---|
| `GlobalMarketsMap` | Global Markets Map — world map with ~170 floating market widgets, drifting camera, depth of field, bloom | **three.js** via `@remotion/three` (`ThreeCanvas`), each widget a plane with a **Canvas 2D texture** | **WebGL2** |
| `CandleChartFlow-Blue` | Candle Chart Flow — scrolling candlesticks over an area chart, dotted map, lens-flare streak, ticker labels | **Canvas 2D** | — |
| `CandleChartFlow-Gold` | same, gold colourway | **Canvas 2D** | — |

Everything is generated in code. Fonts: **Inter** and **JetBrains Mono** (SIL OFL 1.1, `public/fonts/*-OFL.txt`). Map data: **Natural Earth** (public domain, `public/data/NATURAL_EARTH.txt`). All tickers/labels are invented (`IDX-01`, `SEC-A`, …); all numbers are made up.

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ (tested with Node 22). Versions are pinned in `package.json`.

### Chromium GL flag (required for `GlobalMarketsMap`)

Look 1 needs WebGL2 in headless Chromium: **`--gl=angle`**. It is already set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), and it is spelled out in the commands below so they also work with the Node API / another config. On a machine without a GPU, ANGLE falls back to SwiftShader (software) — it works, just slower.

## Render at 4K (per composition)

```bash
npx remotion render GlobalMarketsMap     out/GlobalMarketsMap.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render CandleChartFlow-Blue out/CandleChartFlow_Blue.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render CandleChartFlow-Gold out/CandleChartFlow_Gold.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

(For a master, `--codec=prores --prores-profile=4444` is also fine.)

## Stills (6000×3375)

```bash
npx remotion still GlobalMarketsMap     out/GlobalMarketsMap_6k.png     --frame=300 --scale=1.5625 --gl=angle
npx remotion still CandleChartFlow-Blue out/CandleChartFlow_Blue_6k.png --frame=300 --scale=1.5625 --gl=angle
npx remotion still CandleChartFlow-Gold out/CandleChartFlow_Gold_6k.png --frame=300 --scale=1.5625 --gl=angle
```

`--scale=1.5625` × 3840×2160 = 6000×3375. Canvas textures and the map texture size themselves from the output scale (map texture capped at 8192 px, widget textures at 2048 px).

## 720p previews

`scripts/render-previews.sh` renders each composition at `--scale=0.3333333333333333` (exactly 1280×720, confirmed with ffprobe) as a lossless PNG sequence into `out/frames/<id>/`, then encodes H.264 CRF 16 yuv420p 30 fps with ffmpeg. Keeping the PNGs makes the determinism check possible against the full render.

## Render time

Measured in this build environment: 4 vCPU, **no GPU** (WebGL via SwiftShader), headless Chromium, 720p (`--scale=1/3`):

| Look | per frame, 1 thread | full 600-frame preview, concurrency 2 |
|---|---|---|
| Global Markets Map | **0.48 s** | 227 s |
| Candle Chart Flow (Blue / Gold) | **0.20 s** | 75 s / 76 s |

**4K estimate** (9× the pixels; extrapolated, not measured): Global Markets Map ≈ 4–5 s/frame on software GL, i.e. ~45 min single-threaded or ~12 min at concurrency 4. On a machine with a real GPU it should be well under 1 s/frame. Candle Chart Flow ≈ 1.5–2 s/frame (Canvas 2D blur + per-pixel grain pass scale with pixel count), i.e. ~15–20 min single-threaded.

## How it works

### Look 1 — `src/look1/`
- `layout.ts` — seeded (`mulberry32`, module level) widget placement, camera path. The map lies on z = 0. The camera sits ~17 units above it with a **15° tilt** and 22° vertical FOV. It drifts on a closed Lissajous path (`cameraAt(frame)`), with slight height and yaw changes.
- 172 widgets of 11 types: panel, table, bars, area, line, percent, column, tag, mini candles, quad numbers, ticker row. Each has a tick period that divides 600 and periodic data series of length `600 / period`, so every value returns to its frame-0 state at frame 600.
- `drawWidget.ts` — Canvas 2D drawing, a pure function of `(widget, tick)`. `engine.ts` redraws a widget's canvas (and re-uploads the texture) only when its tick changes and it is in the frustum. The content depends only on the tick, so render order never matters.
- Depth of field is computed per widget plane in its fragment shader. A circle-of-confusion radius comes from view depth vs. focus distance, and a 40-tap golden-angle disc gathers over the texture's mip chain. Planes are padded so the blur can spill past their edges. Big "Volume" panels sit in a foreground layer close to the camera, so they pass large and soft.
- Post: HalfFloat MSAA scene target, then a 6-level bloom (13-tap down / tent up), then a composite. The composite adds haze and vignette, then **±1/255 triangular dither + ~2 % grain from `pcg3d(pixel, frame % 600)`**.
- No `useFrame` clock: R3F's `useFrame` is only a hook that runs when Remotion advances, and it reads the Remotion frame.

### Look 2 — `src/look2/`
- `data.ts` — 64 periodic candles (48 px apart at 4K) and a 192-point periodic area series (16 px apart). The chart scrolls exactly one data period (3072 px) in 600 frames. Label values cycle fixed sequences whose length × step = 600.
- `draw.ts` — redraws the whole frame from `frame % 600`:
  1. Radial background gradient, then the dotted Natural Earth map (pre-rendered once), then the grid.
  2. Area chart, then candles with blurred glow copies; the right-most candle is shown forming.
  3. Flare streak (pulse: 3 and 7 whole cycles per loop), labels, and edge darkening.
  4. A grain + dither pass from an integer hash of (x, y, frame % 600).

### Determinism rules followed
No `Math.random()`, no `Date.now()`, no CSS animation, no state carried between frames, no temporal effects. Fonts and map data are loaded behind `delayRender` / `continueRender` (`src/common/assets.ts`). Canvases are redrawn from scratch each frame. Cached textures are keyed by tick and are pure functions of it.

## Verification (run before delivery)

`scripts/verify.py` (Pillow + numpy) does the comparisons.

1. **File check**: `ffprobe` on all three previews: 1280×720, 30/1, 20.000 s, h264, yuv420p, video stream only. ✅
2. **Loop**: with `--props='{"loopCheck":true}'` every composition is 601 frames. Frames 0 and 600, rendered as stills, are **byte-identical** for all three. ✅
3. **Determinism**: frame 300 rendered alone from a cold start equals frame 300 of the full PNG-sequence render **byte for byte**, for all three. ✅
4. **Banding**: frame 300 is decoded from each **encoded mp4**. The background gradients were checked by median profiles across bands, which ignore grid lines and map dots: the background of Look 2 changes ≤ 1 level per pixel with no plateaus. A ×6 gain view of all three shows no contour bands. ✅
5. **Content** checked on five evenly spaced frames per composition. ✅

```bash
npx remotion still CandleChartFlow-Blue a.png --frame=0   --scale=0.3333333333333333 --props='{"loopCheck":true}'
npx remotion still CandleChartFlow-Blue b.png --frame=600 --scale=0.3333333333333333 --props='{"loopCheck":true}'
python3 scripts/verify.py same a.png b.png
python3 scripts/verify.py banding out/CandleChartFlow_Blue.mp4 300
```

## Completion checklist

- [x] 3 compositions in one project, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] Look 1 three.js + Canvas 2D textures, WebGL2 (`--gl=angle`); Look 2 Canvas 2D
- [x] Fonts (Inter, JetBrains Mono, OFL) and Natural Earth data shipped with licences
- [x] No real tickers, company names, exchange names or logos
- [x] Seeded randomness at module level only; everything is a function of the frame
- [x] Dither (look 1 shader) + ~2 % grain from pixel position and `frame % 600` (both looks)
- [x] Loop check (frame 0 == frame 600), cold-start frame 300 == full-render frame 300
- [x] Banding checked on the encoded mp4
- [x] 720p previews + stills; render time per frame measured and 4K estimated
- [ ] Look 2 compared against its reference clip (`1368839281`): the clip was not available when this was built

## Add a colourway

1. Add a row to `MAP_PALETTES` or `CANDLE_PALETTES` in `src/common/palettes.ts` with a new `id` (e.g. `"Green"`) and its colours. That row is the only data for a version.
2. `src/Root.tsx` maps over the palette arrays, so the composition appears automatically as `CandleChartFlow-Green`. For look 1, once there is more than one row each composition gets an id suffix: `GlobalMarketsMap-<id>`.
3. Render it with the commands above.

## Project layout

```
remotion.config.ts      GL flag, codec defaults
src/Root.tsx            compositions (one per palette row)
src/common/             constants, palettes, seeded random/hash, asset loading
src/look1/              Global Markets Map (three.js)
src/look2/              Candle Chart Flow (Canvas 2D)
public/fonts/           Inter + JetBrains Mono woff2, OFL licences
public/data/            Natural Earth land/borders (50m, 110m) + notices
scripts/                build-map-data.mjs, render-previews.sh, verify.py
```
