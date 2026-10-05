# Logistics Map · Digital World Map · Coin Growth (Remotion, 30 fps)

Ten compositions in one Remotion project, all defined at **3840×2160, 30 fps**:

| Composition id | Look | Engine | Frames | Output name |
|---|---|---|---|---|
| `LogisticsMap-World` | 1A Logistics Map, world | three.js (WebGL2) | 600 (20 s loop) | `LogisticsMap_World.mp4` |
| `LogisticsMap-Asia` | 1B Logistics Map, Asia | three.js | 600 (loop) | `LogisticsMap_Asia.mp4` |
| `LogisticsMap-Routes` | 1C Logistics Map, routes | three.js | 600 (loop) | `LogisticsMap_Routes.mp4` |
| `DigitalWorldMap-Cyan` | 2 Digital World Map | PixiJS 8 (WebGL2) | 600 (loop) | `DigitalWorldMap_Cyan.mp4` |
| `CoinGrowth-StairsWhite` | 3A stairs, plain | three.js | 450 (15 s) | `CoinGrowth_StairsWhite.mp4` |
| `CoinGrowth-StairsFinance` | 3B stairs + finance double exposure | three.js | 450 | `CoinGrowth_StairsFinance.mp4` |
| `CoinGrowth-PileWhite` | 3C pile, plain | three.js | 450 | `CoinGrowth_PileWhite.mp4` |
| `CoinGrowth-PileWarmFinance` | 3D pile, gold/copper/silver + candlesticks | three.js | 450 | `CoinGrowth_PileWarmFinance.mp4` |
| `CoinGrowth-SilverStacksChart` | 3E silver stacks + bar chart | three.js | 450 | `CoinGrowth_SilverStacksChart.mp4` |
| `CoinGrowth-CoinRain` | 3F coin rain (pre-computed physics) | three.js | 450 | `CoinGrowth_CoinRain.mp4` |

Everything is built in code: no photos, no logos, no brand names, no real
currency. Map labels are invented codes (`HUB-01`, `ROUTE A-7`, `PORT-03`) and
all numbers are made up. Coins are generic: reeded edge, raised rim, inner ring,
abstract star-in-circle emblem, no text/numbers/portraits.

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ (tested with Node 22). Dependencies are pinned in `package.json`
(`remotion`/`@remotion/cli`/`@remotion/three` 4.0.532, `three` 0.186.1,
`@react-three/fiber` 9.8.1, `pixi.js` 8.22.0, `cannon-es` 0.20.0 for the build
script only).

## Chromium GL flag

All looks use **WebGL2** (not WebGPU). Headless Chromium needs
`--gl=angle` (set in `remotion.config.ts`, so `npx remotion render` uses it by
default). On a machine **without a GPU**, ANGLE falls back to SwiftShader; you
can request that explicitly with `--gl=swangle`. If Remotion cannot download its
own headless shell, point it at any Chromium with
`--browser-executable=/path/to/chrome-headless-shell`.

## 4K render commands

```bash
npx remotion render LogisticsMap-World         out/LogisticsMap_World.mp4         --gl=angle
npx remotion render LogisticsMap-Asia          out/LogisticsMap_Asia.mp4          --gl=angle
npx remotion render LogisticsMap-Routes        out/LogisticsMap_Routes.mp4        --gl=angle
npx remotion render DigitalWorldMap-Cyan       out/DigitalWorldMap_Cyan.mp4       --gl=angle
npx remotion render CoinGrowth-StairsWhite     out/CoinGrowth_StairsWhite.mp4     --gl=angle
npx remotion render CoinGrowth-StairsFinance   out/CoinGrowth_StairsFinance.mp4   --gl=angle
npx remotion render CoinGrowth-PileWhite       out/CoinGrowth_PileWhite.mp4       --gl=angle
npx remotion render CoinGrowth-PileWarmFinance out/CoinGrowth_PileWarmFinance.mp4 --gl=angle
npx remotion render CoinGrowth-SilverStacksChart out/CoinGrowth_SilverStacksChart.mp4 --gl=angle
npx remotion render CoinGrowth-CoinRain        out/CoinGrowth_CoinRain.mp4        --gl=angle
```

`remotion.config.ts` sets H.264, `yuv420p`, CRF 16, PNG intermediate frames and
concurrency 2. For a mastering-grade file add e.g. `--codec=prores --prores-profile=4444`.

**720p previews** (what was delivered with this project) use
`scripts/render-preview.sh <CompositionId> <OutName>`: it renders a lossless PNG
sequence with `--scale=0.3333333333333333` (exactly 1280×720) and encodes it
with ffmpeg (H.264, yuv420p, 30 fps, CRF 16, no audio).

## Stills (6000×3375)

```bash
npx remotion still <CompositionId> out/<name>.png --frame=300 --scale=1.5625 --gl=angle
```

3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375. Good frames: 300 for the map loops,
420 for the coin versions. (Not rendered here.)

## Rebuilding the coin-rain data (3F)

```bash
npm run build:coinrain
```

`scripts/build-coinrain.mjs` runs a cannon-es rigid-body simulation in Node —
150 coins, fixed 480 Hz timestep, seeded spawn positions and spins — and writes
every coin's position + quaternion per frame to `public/coinrain.bin`
(450 frames × 150 coins × 8 floats, ~2.1 MB). The composition only plays that
data back; there is no physics at render time. The script is deterministic, so
rebuilding produces the same file. It takes ~2.5 minutes.

`scripts/prepare-data.mjs` (one-off, outputs are shipped) converts the Natural
Earth shapefiles and the GRAY_50M_SR raster to the files in `public/data`.

## Measured render time (720p, this machine)

MEASURED_TIMES

## Determinism

Remotion renders frames out of order across several tabs, so every visible
value is computed from `useCurrentFrame()` alone:

- No `Math.random()` — `mulberry32` seeded generators (`src/lib/random.ts`) and a
  stateless integer hash; per-tab tables are built once from fixed seeds.
- No CSS animation, no clocks (`Date.now`, R3F clock), no state carried between
  frames, no TAA/accumulation. React state is only used as a loading gate.
- three.js: `ThreeCanvas` with `frameloop="never"`; a priority-1 render callback
  draws the frame the Remotion frame number describes (scene → 4×MSAA HDR →
  depth of field → bloom → final pass).
- PixiJS: `app.init({canvas, width, height, preference:'webgl', antialias:true,
  autoStart:false, preserveDrawingBuffer:true, ...})`, ticker stopped, one
  `app.render()` per Remotion frame.
- Coin rain plays back `public/coinrain.bin`.
- Map data, raster, fonts, HDRI and coin-rain data are loaded behind
  `delayRender`/`continueRender`.
- Grain is a fixed hash of (pixel, frame % 600); ±1/255 triangular dither in the
  final pass after bloom and tone mapping, in every look.

## Verification (what was checked, see `scripts/verify.sh`)

VERIFICATION_REPORT

## Banding check

Grain (~2 % on the maps, ~1 % on the coins) and ±1/255 dither are applied in
the last shader pass. The check reads rows of pixels from frames decoded **from
the encoded mp4** across the gradients (map vignette, white table falloff,
overlay gradients) and looks for flat runs separated by 1-level steps:

```bash
scripts/verify.sh frame out/CoinGrowth_StairsWhite.mp4 400 /tmp/f.png
ffmpeg -v error -i /tmp/f.png -vf "crop=1:720:200:0" -f rawvideo -pix_fmt gray - | od -An -tu1 -w16
```

## Completion checklist

CHECKLIST

## Adding a map framing

1. Add a row to `src/logistics/versions.ts` (copy `ASIA`): camera target
   (lon/lat), distance, tilt, yaw, loop drift; accent colour; hotspots; pins
   (with invented codes); arcs (pin indices, pulse periods that divide 600);
   counters (step must divide 600); HUD box, labels and extras; optional
   transport routes / static icons.
2. Add it to `MAP_VERSIONS` and to the list in `src/Root.tsx`.
3. Run the loop check: `scripts/verify.sh still <id> 0 a.png --props='{"loopCheck":true}'`,
   same for frame 600, then `scripts/verify.sh same a.png b.png`.

## Adding a coin version

1. Add a row to `COIN_VERSIONS` in `src/coins/versions.ts`: layout
   (`stairs`, `pile`, `pileMixed`, `silver`, `rain`, or a new function in
   `src/coins/layouts.ts` returning `CoinSpec[]`), camera, aperture, set
   colours (display sRGB; the backdrop is inverse-tone-mapped to land on them),
   overlay (`financeBlue`, `candlesWarm`, `barsBlue` or `null`).
2. It is registered automatically in `src/Root.tsx`.
3. Coins land on a `land` frame and are animated as a short eased drop and
   settle; new layouts only need rest poses and land frames.

## Assets and licences

| Asset | Source | Licence | File |
|---|---|---|---|
| Rajdhani 500/600/700 | @fontsource/rajdhani 5.3.0 | SIL OFL 1.1 | `public/fonts/OFL-Rajdhani.txt` |
| JetBrains Mono 400/500 | @fontsource/jetbrains-mono 5.3.0 | SIL OFL 1.1 | `public/fonts/OFL-JetBrainsMono.txt` |
| Natural Earth land (50m, 110m), admin-0 countries (50m), populated places (10m), GRAY_50M_SR shaded relief | naturalearthdata.com (S3 mirror) | Public domain | `public/data/LICENSE-NaturalEarth.txt` |
| Studio HDRI (`studio.exr`) | Poly Haven, via @pmndrs/assets 1.7.0 | CC0 1.0 | `public/hdri/LICENSE-CC0.txt`, `public/hdri/README.txt` |

Project layout: `src/three` (shared post pipeline and R3F driver),
`src/logistics` (look 1), `src/digital` (look 2), `src/coins` (look 3),
`src/lib` (seeded random, asset loading, geo helpers), `scripts/` (coin-rain
build, data prep, preview render, verification helpers).
