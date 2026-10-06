# Topo Data Terrain · Headline Words · Ticker Floor · Trend Ribbon

One Remotion project, four looks, **8 compositions** (16:9, defined at 3840×2160, 30 fps).
Everything is built in code with three.js (WebGL2) inside `@remotion/three`. There are no
MCP servers, logos, brands, real tickers or real data; all numbers are invented.

| Composition id | Output name | Look | Frames | Loop |
|---|---|---|---|---|
| `TopoTerrain-Teal` | `TopoTerrain_Teal` | Topo Data Terrain, teal | 600 (20 s) | yes |
| `TopoTerrain-Blue` | `TopoTerrain_Blue` | Topo Data Terrain, blue + "BIG DATA" tags | 600 (20 s) | yes |
| `HeadlineWords-Tariffs` | `HeadlineWords_Tariffs` | Headline Words | 450 (15 s) | build-in, then live hold |
| `HeadlineWords-Recession` | `HeadlineWords_Recession` | Headline Words | 450 (15 s) | build-in, then live hold |
| `HeadlineWords-Inflation` | `HeadlineWords_Inflation` | Headline Words | 450 (15 s) | build-in, then live hold |
| `TickerFloor-Blue` | `TickerFloor_Blue` | Ticker Floor, blue | 600 (20 s) | yes |
| `TickerFloor-BearRed` | `TickerFloor_BearRed` | Ticker Floor, market-crash red | 600 (20 s) | yes |
| `TrendRibbon-Multicolour` | `TrendRibbon_Multicolour` | Trend Ribbon | 600 (20 s) | yes |

Remotion ids can't contain `_`, so ids use `-`; render to the `_` file names below.

## Setup

```bash
npm install
npx remotion studio          # preview
```

Pinned: remotion / @remotion/cli / @remotion/three 4.0.533, three 0.186.1,
@react-three/fiber 9.8.1, react 19.2.3.

### Chromium GL flag

WebGL2 runs through ANGLE. `remotion.config.ts` sets it already
(`Config.setChromiumOpenGlRenderer("angle")`). On the command line it is **`--gl=angle`**.
Don't use WebGPU, and don't use `--gl=swiftshader` on a GPU machine: it works, but it's slow.

## 4K render commands (3840×2160, H.264, yuv420p, CRF 16)

```bash
npx remotion render TopoTerrain-Teal        out/TopoTerrain_Teal.mp4        --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render TopoTerrain-Blue        out/TopoTerrain_Blue.mp4        --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render HeadlineWords-Tariffs   out/HeadlineWords_Tariffs.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render HeadlineWords-Recession out/HeadlineWords_Recession.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render HeadlineWords-Inflation out/HeadlineWords_Inflation.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render TickerFloor-Blue        out/TickerFloor_Blue.mp4        --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render TickerFloor-BearRed     out/TickerFloor_BearRed.mp4     --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render TrendRibbon-Multicolour out/TrendRibbon_Multicolour.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
```

On a single GPU, add `--concurrency=1` or `--concurrency=2`: each tab renders the full post
chain at 4K.

### Stills (6000×3375)

`--scale=1.5625` turns 3840×2160 into 6000×3375:

```bash
npx remotion still TopoTerrain-Teal out/TopoTerrain_Teal_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(Use any composition id and frame. For Headline Words use a frame of 90 or later, after the
slam-in.)

### 720p previews (as delivered)

`scripts/render-previews.sh` renders a PNG sequence at `--scale=0.3333333333333333`
(exactly 1280×720), then encodes it with ffmpeg (libx264, CRF 16, yuv420p, 30 fps, no audio).
`scripts/verify.py <id>` runs the checks below.

## Render time

Measured in this build environment: 4-core cloud container, **no GPU**. ANGLE falls back to
SwiftShader (software WebGL2). 720p = `--scale=0.3333333333333333`, `--concurrency=4`, PNG
sequence; time is wall-clock for the full composition.

| Look | Composition | Frames | Wall time | **Per frame (720p)** |
|---|---|---|---|---|
| Topo Data Terrain | TopoTerrain-Teal | 600 | 550 s | **0.92 s** |
| Topo Data Terrain | TopoTerrain-Blue | 600 | 595 s | **0.99 s** |
| Headline Words | Tariffs / Recession / Inflation | 450 | 222 / 210 / 216 s | **0.47–0.49 s** |
| Ticker Floor | TickerFloor-Blue / BearRed | 600 | 261 / 267 s | **0.44 s** |
| Trend Ribbon | TrendRibbon-Multicolour | 600 | 529 s | **0.88 s** |

**4K estimate.** 4K has 9× the pixels of 720p, and almost all of the cost is fill (fragment shaders
and the post chain).
* Same software-GL machine: about 9× slower, so roughly 8–9 s per frame for Topo/Ribbon and
  4 s for Headline/Ticker. A 600-frame Topo loop would take about 1.5 h.
* Desktop GPU with ANGLE (e.g. an RTX-class card): about **0.3–0.8 s per frame**, mostly
  PNG/JPEG readback and encoding. That's roughly 3–8 min per 20 s composition at
  `--concurrency=2`. This is an estimate; it wasn't measured here because no GPU was available.

## How it's built

```
src/
  Root.tsx                 compositions (one per data row)
  versions.ts              ← the data rows: colourways, headline topics, ticker colourways
  lib/
    Stage.tsx              ThreeCanvas + one deterministic render callback per frame
    post.ts                HDR target → pyramid → DoF + bloom → ACES → vignette → grain → dither
    glyphs.ts              glyph atlas + instanced sprite layer (text, icons, rects), dot-matrix option
    lines.ts               anti-aliased glowing polylines (+ depth-only core for DoF)
    noise.ts               periodic gradient noise, identical in GLSL and JS
    glsl.ts                hash + fwidth anti-aliased line helpers
    random.ts              mulberry32 (module-level seeds), stateless hash
    assets.ts              fonts + Natural Earth behind delayRender/continueRender
  looks/topo|headline|ticker|ribbon/
public/fonts               Inter, JetBrains Mono (OFL, licences alongside)
public/data/natural-earth  ne_110m_land.geojson (public domain, LICENSE.md)
```

* **Topo terrain:** a displaced plane. Contour lines are drawn in the fragment shader where the
  height crosses fixed levels (every 5th line brighter). They are anti-aliased with `fwidth`,
  masked by a world-space dot lattice for the particle look, and fade to their mean coverage
  where lines get closer than a few pixels, so there's no moiré at grazing angles. The noise is
  periodic along the flight direction, and the world moves exactly one tile (96 units) in 600
  frames. Pins, tags and city lights are replicated per tile and wrapped.
* **Headline Words:** a dotted map rasterised from Natural Earth into a canvas. The headline is
  an Inter Black Italic canvas texture with a thin bright edge, extrusion layers and a
  dark-red panel; it slams in with zoom blur and a flash. The ticker strip is a wrapping canvas
  texture with motion blur that grows toward the edges, where it fades. The number floor is an
  instanced glyph field.
* **Ticker Floor:** a 4096² canvas texture of ticker rows on the floor, scrolling exactly 4 rows
  per loop. Above it are the line charts (sine sums with whole-cycle phase drift), candles,
  labels and beams, all on whole cycles.
* **Trend Ribbon:** a periodic zig-zag path (period 64 units). The camera travels exactly one
  period per loop. The ribbon shader draws 40 strands (every 4th brighter) of dots, coloured
  along arc length (violet → pink → teal → green, the same period). The dot-matrix number
  walls, grids, candles and markers are all periodic in the same period.

## Determinism

* Every on-screen value is computed from `useCurrentFrame()` alone. The R3F `useFrame` hook is
  used only as the render callback (priority 1); its clock is never read.
* No `Math.random()`: `mulberry32` is seeded at module/factory level, and per-frame variation
  uses the stateless `hash01(frame…)`.
* No `Date.now()`, no state driving visuals, no TAA or temporal effects, and no values carried
  between frames. Canvas textures are drawn once at mount; per-frame text is rebuilt from
  scratch as instanced glyphs.
* Grain and dither are a fixed hash of (pixel x, pixel y, frame mod loop).
* Fonts and map data are loaded behind `delayRender`/`continueRender`.

## Banding

* The final pass adds triangular dither of ±1/255 after bloom and tonemapping, plus 1.5% grain
  from a fixed formula of pixel position and frame.
* The check was made on the **encoded mp4**, not the preview (see the checklist).

## Adding a headline topic or a colourway

* **Headline topic:** add one row to `HEADLINE_VERSIONS` in `src/versions.ts`:
  ```ts
  { id: "HeadlineWords-Stagflation", headline: "STAGFLATION", keywords: ["PRICES", "GROWTH", "WAGES"], seed: 61 },
  ```
  The word is fitted to width automatically.
* **Topo colourway:** add a row to `TOPO_VERSIONS` (contour, base, haze, gold, tag mode, tag
  count, base gain, seed).
* **Ticker colourway:** add a row to `TICKER_VERSIONS`, as `TickerFloor-BearRed` does.
* **Ribbon colourway:** add a row to `RIBBON_VERSIONS` (4-colour cyclic gradient, candle and
  label colours).

## Verification & completion checklist

All 8 previews were checked with `scripts/verify.py` (reports in `out/verify/`, which is not
shipped):

- [x] **Files:** 1280×720, 30/1, h264, yuv420p, a single video stream (no audio). Durations are
      20.000 s for the loops and 15.000 s for Headline Words.
- [x] **Loop** (6 loops; composition at 601 frames via `--props='{"loopCheck":true}'`): frame 0 =
      frame 600, **0 differing pixels** for every loop.
- [x] **Determinism:** frame 300 rendered alone from a cold start = frame 300 from the full
      multi-threaded render, **byte for byte** (same md5) for all 8. Headline Words frame 70
      (mid slam-in) also matches.
- [x] **Banding:** read on frames decoded from the encoded mp4. Every dark luminance level is
      present (no empty histogram bins). Haze and gradient profiles change smoothly, and the
      longest run of identical pixels in a dark gradient is 5–15 px (grain plus dither break up
      plateaus).
- [x] **Contact sheets** (5 frames each): terrain and camera travel; Headline Words build-in,
      slam and ticker; ticker rows moving; ribbon colour shift, candles and markers.
      TickerFloor-BearRed has red tiles, mostly ▼ and lines trending down.
- [x] **Text:** words spelled correctly. There are no people, parties, countries, brands or real
      tickers, and all numbers are invented.
- [x] **Motion and aliasing:** frames 299/300/301 have equal frame-to-frame differences (no
      popping). Contours and ribbon strands use `fwidth` anti-aliasing and fade to mean coverage
      below a few pixels per line.
- [x] **Reference comparison:** 3 rounds, each with fresh, uninstructed reviewer agents.
- [x] **Clean copy:** `npm install && npx remotion studio` serves (tested from an unzipped copy).

To re-run the checks: `scripts/render-previews.sh` then `python3 scripts/verify.py <id>`
(`refs/` is not shipped).

## Licences

* Inter — SIL Open Font License 1.1 (`public/fonts/inter/OFL.txt`)
* JetBrains Mono — SIL Open Font License 1.1 (`public/fonts/jetbrains-mono/OFL.txt`)
* Natural Earth — public domain (`public/data/natural-earth/LICENSE.md`)
