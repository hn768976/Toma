# Finance Screens (Remotion + three.js / WebGL2)

Ten seamless 20 s loops (600 frames at 30 fps, 3840×2160) of glowing finance
screens: one shared chart-widget kit, seven looks, ten colourways.

| # | Look | Composition id(s) | Output file(s) |
|---|------|-------------------|----------------|
| 1 | Finance Montage (2D layers, ortho camera) | `FinanceMontage-Blue` | `FinanceMontage_Blue.mp4` |
| 2 | Curved Chart Wall | `CurvedChartWall-Blue`, `CurvedChartWall-Emerald` | `CurvedChartWall_Blue.mp4`, `CurvedChartWall_Emerald.mp4` |
| 3 | Bar Race | `BarRace-Cyan`, `BarRace-Amber` | `BarRace_Cyan.mp4`, `BarRace_Amber.mp4` |
| 4 | Ticker Line | `TickerLine-Blue` | `TickerLine_Blue.mp4` |
| 5 | Column Chart | `ColumnChart-Blue`, `ColumnChart-Violet` | `ColumnChart_Blue.mp4`, `ColumnChart_Violet.mp4` |
| 6 | Trading Dashboard | `TradingDashboard-Purple` | `TradingDashboard_Purple.mp4` |
| 7 | Night Chart | `NightChart-Gold` | `NightChart_Gold.mp4` |

(Remotion composition ids may not contain `_`, so ids use `-`; output files use `_`.)

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ (tested on Node 22). All dependency versions are pinned in `package.json`.

### Chromium GL flag

Everything renders through WebGL2 in headless Chromium. Use the ANGLE backend:

```
--gl=angle
```

It is also set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), so the
CLI picks it up automatically; passing it explicitly does no harm. On a machine with a real GPU,
ANGLE uses it; without one it falls back to SwiftShader (correct but slow).

## Render commands (4K)

```bash
npx remotion render src/index.ts FinanceMontage-Blue      out/FinanceMontage_Blue.mp4      --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts CurvedChartWall-Blue     out/CurvedChartWall_Blue.mp4     --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts CurvedChartWall-Emerald  out/CurvedChartWall_Emerald.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts BarRace-Cyan             out/BarRace_Cyan.mp4             --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts BarRace-Amber            out/BarRace_Amber.mp4            --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts TickerLine-Blue          out/TickerLine_Blue.mp4          --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts ColumnChart-Blue         out/ColumnChart_Blue.mp4         --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts ColumnChart-Violet       out/ColumnChart_Violet.mp4       --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts TradingDashboard-Purple  out/TradingDashboard_Purple.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts NightChart-Gold          out/NightChart_Gold.mp4          --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
```

For a ProRes master add `--codec=prores --prores-profile=4444` and drop `--pixel-format/--crf`.

### Stills (6000×3375)

The compositions are 3840×2160; a scale of 1.5625 gives 6000×3375 exactly:

```bash
npx remotion still src/index.ts CurvedChartWall-Blue out/CurvedChartWall_Blue_6K.png --frame=150 --scale=1.5625 --gl=angle
```

(Screen textures follow the render size, capped at the GPU's max texture size.)

### 720p previews

```bash
npx remotion render src/index.ts TickerLine-Blue out/TickerLine_Blue_720p.mp4 --scale=0.3333333333333333 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
```

`scripts/render-preview.sh <id> <file>` is what produced the delivered previews: one 601-frame
PNG-sequence render (frames 0–599 encoded with ffmpeg: H.264, yuv420p, 30 fps, CRF 16, no audio;
frame 600 kept for the loop check), a cold-start frame 300 for the determinism check and a frame-150
PNG still. `scripts/verify.py <id> <file>` runs the file, loop and determinism checks.

## How to add a colourway (one data row)

Open `src/versions.ts`, copy an existing row of the look you want, and change:

```ts
{
  id: "BarRace-Magenta",          // composition id (letters, digits, dashes)
  file: "BarRace_Magenta",        // output name
  look: "barRace",
  palette: { bg: "#08040A", screen: "#160A14", bar: "#FF6AD0", barTop: "#FFE0F6",
             text: "#E0B8D8", grid: "#8A3A78", donuts: ["#3AC8B0", "#5AD8F0", "#F0D040"] },
},
```

That is all: `Root.tsx` registers one composition per row.

## Project layout

```
src/
  Root.tsx, index.ts      compositions (one per row of versions.ts)
  versions.ts             the 10 data rows (palettes)
  engine/
    FinanceScreen.tsx     <ThreeCanvas> host; redraws everything from useCurrentFrame()
    Pipeline.ts           post: scene (HalfFloat, MSAA, alpha = signed CoC) -> DoF gather
                          -> bloom (dual filter) -> vignette, grain, dither
    materials.ts          screen material: canvas texture + thin-lens circle of confusion
    ScreenCanvas.ts       Canvas 2D screen textures (mipmaps + anisotropic filtering)
    series.ts             periodic seeded random walks
    rng.ts                mulberry32, integer hash, tickers on schedules dividing 600
    assets.ts             fonts + map dot grid, loaded once behind delayRender
  kit/draw.ts             shared widget kit: glow lines, candles, bars, donut, grids,
                          number columns, tables, code text, dot map, sparkline cards,
                          glints, flares, HUD scatter
  looks/*.ts              the seven looks
public/fonts              Inter + JetBrains Mono (OFL) and their licence texts
public/data               world-dots.json (generated from Natural Earth)
data/naturalearth         ne_110m_land.geojson (public domain) + note
scripts/                  build-map.mjs, render-preview.sh, verify.py, stills/compare helpers
```

## Determinism

* Every value on screen is computed from `useCurrentFrame()` alone: no `Math.random()`, no
  `Date.now()`, no `useFrame` clock, no state carried between frames. Each frame redraws every
  canvas texture from scratch.
* Random series / numbers / lit cells come from `mulberry32` seeded at module level or from an
  integer hash of (seed, index); ticking digits use schedules whose periods divide 600.
* All motion is periodic in 600 frames (whole-cycle sines; scrolls of whole series lengths;
  the curved wall's camera turns exactly one 40° texture period; the night chart scrolls exactly
  one cell-grid period).
* No TAA, no accumulation buffers, no `shadowBlur` (glow = stacked strokes).
* Grain is a PCG hash of (pixel x, pixel y, frame % 600); dither is ±1/255 triangular noise from
  the same hash.
* `@remotion/three`'s `<ThreeCanvas>` owns the context; R3F's own render of its empty default scene
  is a no-op (`autoClear = false`), and the frame is drawn in a layout effect before Remotion
  captures it.

## Fonts and data

* Inter and JetBrains Mono, SIL Open Font License 1.1 — `public/fonts/OFL-*.txt`.
* Natural Earth 1:110m land — public domain (see `data/naturalearth/README.md`).
  `npm run build-map` regenerates `public/data/world-dots.json`.

## Measurements (this machine)

Rendered in a cloud container with **no GPU**: 4 vCPU, headless Chromium with `--gl=angle`,
which falls back to SwiftShader (software WebGL2). All numbers are wall-clock and include
Chromium start-up amortised over the run.

### 720p (`--scale=0.3333333333333333`, 1280×720), per frame

Measured as (wall time of the 601-frame render) / 601. Concurrency 2 vs 4 made no difference
(the software GL renderer already uses every core).

| Composition | s / frame | 1 · file | 2 · loop | 3 · determinism | 4 · banding | 6 · motion |
|---|---|---|---|---|---|---|
| `FinanceMontage-Blue` | 0.72 s | pass | pass (Δmax 0; seam 8.07 vs 7.70–8.62) | pass (bytes equal) | pass | pass (cv 0.021) |
| `CurvedChartWall-Blue` | 0.68 s | pass | pass (Δmax 0; seam 4.68 vs 3.97–4.52) | pass (bytes equal) | pass | pass (cv 0.013) |
| `CurvedChartWall-Emerald` | 0.69 s | pass | pass (Δmax 0; seam 4.69 vs 3.98–4.57) | pass (bytes equal) | pass | pass (cv 0.013) |
| `BarRace-Cyan` | 0.68 s | pass | pass (Δmax 0; seam 3.13 vs 2.83–3.15) | pass (bytes equal) | pass | pass (cv 0.035) |
| `BarRace-Amber` | 0.66 s | pass | pass (Δmax 0; seam 3.08 vs 2.82–3.09) | pass (bytes equal) | pass | pass (cv 0.035) |
| `TickerLine-Blue` | 0.71 s | pass | pass (Δmax 0; seam 5.69 vs 4.61–6.24) | pass (bytes equal) | pass | pass (cv 0.023) |
| `ColumnChart-Blue` | 0.65 s | pass | pass (Δmax 0; seam 3.35 vs 2.74–3.50) | pass (bytes equal) | pass | pass (cv 0.028) |
| `ColumnChart-Violet` | 0.65 s | pass | pass (Δmax 0; seam 3.45 vs 2.78–3.60) | pass (bytes equal) | pass | pass (cv 0.025) |
| `TradingDashboard-Purple` | 0.62 s | pass | pass (Δmax 0; seam 4.37 vs 3.38–3.65) | pass (bytes equal) | pass | pass (cv 0.011) |
| `NightChart-Gold` | 0.63 s | pass | pass (Δmax 0; seam 4.35 vs 3.58–4.40) | pass (bytes equal) | pass | pass (cv 0.101) |

### Two real 4K frames (3840×2160)

| Composition | 1 frame (cold, incl. start-up) | 5 frames | steady-state per frame |
|---|---|---|---|
| `CurvedChartWall-Blue` (2A) | 14.6 s | 42.1 s | **6.9 s** |
| `TradingDashboard-Purple` (6) | 11.4 s | 38.2 s | **6.7 s** |

### 4K estimates

* **This machine (software GL):** ≈ 6.8 s × 600 ≈ **68 min per composition**, ≈ 11.5 h for all ten.
* **A machine with a real GPU** (ANGLE on the GPU): the GL passes that dominate here
  (MSAA scene pass, DoF gather, bloom chain) become negligible and the remaining cost is
  Canvas 2D drawing, texture upload and PNG capture — expect roughly **0.5–1.5 s per 4K
  frame, i.e. ~5–15 min per composition**. This is an estimate, not a measurement.

## Verification (what was checked, how)

1. **File checks** — `ffprobe`: 1280×720, 30/1, h264, yuv420p, no audio stream, 20.000 s. All ten pass.
2. **Loop** — each composition rendered as 601 frames (`--props='{"loopCheck":true}'`);
   frame 600 vs frame 0 compared pixel for pixel: identical for all ten. Because motion is
   evaluated at `frame % 600`, this alone would be trivially true, so the seam is also checked:
   the mean change 599 → 600 must look like an ordinary frame step (table above). That second
   test caught a real problem in the first full render: every ticker and lit-cell schedule
   divided 600, so they all switched on frame 0 and the loop point flashed (Night Chart seam
   10.8 vs 3.4 typical). Schedules now have seeded phase offsets.
3. **Determinism** — frame 300 rendered alone from a cold start (new browser) vs frame 300 of
   the full multi-threaded render: **byte-for-byte identical PNGs** for all ten (also from a
   clean `npm install` copy of the project).
4. **Banding** — frame 300 decoded **from the encoded mp4**; long profiles through the dark
   gradient areas (edge columns, top/bottom rows, a diagonal) smoothed 9×9 to remove grain and
   scanned for staircase steps (≥24 px flat then a ≥2-level jump). None found in any file.
   Grain ≈1.5 % from a PCG hash of (x, y, frame % 600), ±1/255 triangular dither in the final
   pass; Night Chart fades grain to zero below ~3 % luminance.
5. **Content** — one contact sheet per preview (5 evenly spaced frames). Labels are generic
   only (INDEX, VOLUME, OPEN, HIGH, LOW, CLOSE, ACTIVE SEARCH, MARKET DATA, ANALYTICS, made-up
   codes like IDX 01 / SER-A / FX 07); no tickers, brands or exchanges.
6. **Motion** — frames 270–330 of every composition: per-frame mean change is even (coefficient
   of variation 0.01–0.10, no stalled frames); crops stepped through visually. Screen textures
   are mipmapped with anisotropic filtering.

## Completion checklist

- [x] 10 compositions, one data row each (`src/versions.ts`), 3840×2160, 30 fps, 600 frames
- [x] three.js on WebGL2 via `@remotion/three`; Canvas 2D screen textures; real camera + DoF gather pass (looks 2–7); orthographic layered stack (look 1)
- [x] Shared widget kit (`src/kit/draw.ts`); glow = stacked strokes, no `shadowBlur`
- [x] Deterministic: no `Math.random`/`Date.now`/`useFrame` clock/state; module-level seeded RNG; fonts + map behind `delayRender`
- [x] Seamless 20 s loops (frame 600 ≡ frame 0, seam step normal)
- [x] Bloom, vignette, grain (frame % 600), dither
- [x] OFL fonts (Inter, JetBrains Mono) with licences; Natural Earth 1:110m dot-grid map with public-domain note
- [x] 720p previews + PNG stills; render times measured; two 4K frames timed
- [x] Clean copy: `npm install && npx remotion studio` works

