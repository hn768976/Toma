# Gold Low-Poly · Cloud Upload · Price Houses · Network Growth · Connected Globe

Seven 4K motion-graphic compositions in one Remotion project. Every look is real
3D in **three.js** (via `@remotion/three`), rendered with **WebGL2** and a
hand-written, fully deterministic post pipeline (bloom, depth of field,
ACES tonemapping, sRGB, dither, grain).

| Composition id        | Preview file              | Frames | Length | Loop |
|-----------------------|---------------------------|--------|--------|------|
| `LowPolyLuxe-Gold`    | `LowPolyLuxe_Gold.mp4`    | 600    | 20 s   | yes  |
| `LowPolyLuxe-Silver`  | `LowPolyLuxe_Silver.mp4`  | 600    | 20 s   | yes  |
| `CloudUpload`         | `CloudUpload.mp4`         | 600    | 20 s   | yes  |
| `PriceHouses-Dollar`  | `PriceHouses_Dollar.mp4`  | 600    | 20 s   | yes  |
| `PriceHouses-Euro`    | `PriceHouses_Euro.mp4`    | 600    | 20 s   | yes  |
| `NetworkGrowth`       | `NetworkGrowth.mp4`       | 450    | 15 s   | no   |
| `ConnectedGlobe`      | `ConnectedGlobe.mp4`      | 600    | 20 s   | yes  |

All compositions: 3840×2160, 30 fps. (Remotion ids may not contain `_`, so ids
use `-`; output files use `_`.)

## Quick start

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ is required. Every dependency in `package.json` is pinned to an exact
version and `package-lock.json` is included.

## Chromium GL flag

Headless Chromium must use ANGLE for WebGL2:

```
--gl=angle
```

`remotion.config.ts` already sets this (`Config.setChromiumOpenGlRenderer("angle")`),
so the commands below work as written; the flag is repeated on the command line
so they also work from the Node APIs / another config. On a machine with a GPU,
ANGLE uses it; without one it falls back to SwiftShader (software), which is
what the timings below were measured on.

If Remotion cannot download its own headless shell (offline / sandboxed CI),
point it at any Chromium with `--browser-executable=/path/to/chrome`.

## 4K render commands

```bash
npx remotion render src/index.ts LowPolyLuxe-Gold   out/LowPolyLuxe_Gold.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts LowPolyLuxe-Silver out/LowPolyLuxe_Silver.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts CloudUpload        out/CloudUpload.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts PriceHouses-Dollar out/PriceHouses_Dollar.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts PriceHouses-Euro   out/PriceHouses_Euro.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts NetworkGrowth      out/NetworkGrowth.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts ConnectedGlobe     out/ConnectedGlobe.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

Frames are captured as PNG (set in `remotion.config.ts`) so no JPEG step adds
blocking or banding before the encoder. For a mastering intermediate use
`--codec=prores --prores-profile=4444` instead of H.264.

## Stills (6000×3375)

`--scale=1.5625` turns 3840×2160 into exactly 6000×3375:

```bash
npx remotion still src/index.ts LowPolyLuxe-Gold out/LowPolyLuxe_Gold_6K.png --frame=240 --scale=1.5625 --gl=angle
```

(Any composition id / frame works the same way. All screen-space sizes —
line widths, sprite sizes, blur radii, grain — are defined relative to the
frame height, so 720p, 4K and 6K frames look the same.)

## 720p previews

```bash
scripts/render-all.sh                 # all seven
scripts/render-all.sh CloudUpload     # just one
scripts/verify.sh                     # file, loop and determinism checks
```

Set `BROWSER_EXECUTABLE=/path/to/chrome` if Remotion should not use its own
headless shell. `verify.sh` / `banding.py` / `compare.py` need Python 3 with
`numpy` and `pillow`.

Each preview is rendered with `--scale=0.3333333333333333` to a lossless PNG
sequence (exactly 1280×720 — the canvas size is rounded so 1/3 never truncates
to 1279×719), then encoded with ffmpeg: H.264, `yuv420p`, 30 fps, CRF 16, no
audio. The script also saves a 720p PNG still per composition.

## Render time

Measured on the build machine: 4 CPU cores, **no GPU** (WebGL through
ANGLE → SwiftShader, i.e. software rendering), `--concurrency=2`.
Per-frame times exclude startup (bundling, browser launch, asset load and the
~10 s per-tab GPU pipeline warm-up), which was measured separately and
subtracted (`scripts/measure-timing.sh`, 60 frames at 720p, 10 frames at 4K).

| Look | 720p s/frame | Full 720p preview (wall clock) | 4K s/frame measured (software GL) | 4K estimate, 600 frames, this machine |
|------|-------------:|------------------------------:|----------------------------------:|------------------------------------:|
| Low-Poly Luxe (per version) | 0.57 | 334 s (Gold), 319 s (Silver) | 7.7 | ≈ 77 min |
| Cloud Upload | 0.48 | 299 s | 7.0 | ≈ 70 min |
| Price Houses (per version) | 0.72 | 421 s ($), 419 s (€) | 7.7 | ≈ 77 min |
| Network Growth (450 frames) | 0.50 | 214 s | 6.6 | ≈ 50 min |
| Connected Globe | 1.01 | 555 s | 7.1 | ≈ 71 min |

**4K estimate:** with software GL, all seven 4K renders take about **8.5 hours**
on a 4-core machine (render time is fill-bound, so 4K costs ~9× the pixels but
the fixed per-frame CPU work does not scale, giving 7–15× the 720p time). On a
machine with a real GPU (ANGLE uses it automatically) expect roughly an order
of magnitude less, around 0.3–1 s per 4K frame, i.e. 3–10 minutes per
composition — an estimate, not measured here.

## Determinism

Remotion renders frames out of order across several browser tabs. Every value
on screen is a pure function of `useCurrentFrame()`:

- All randomness is `mulberry32` seeded at module level (or with a fixed seed
  inside scene construction); there is no `Math.random()` anywhere.
- No `useFrame` clock, `Date.now()`, `performance.now()` or `useState` drives a
  visual. R3F's render loop is disabled (a priority-1 no-op `useFrame`); the
  scene is updated and drawn in an effect keyed on the frame.
- Loops (looks 1, 2, 3, 5) use `t = (frame % 600) / 600` and only whole-number
  cycles: noise is sampled around a circle in time, particles and pulses use
  integer frequencies, the house row slides exactly N·S, the globe turns exactly
  once.
- No TAA, no temporal AO, no accumulative shadows; bloom, DOF and reflections
  are recomputed from scratch every frame.
- Grain and dither come from an integer PCG hash of `(pixel x, pixel y, frame mod 600)`.
- The HDRI, Natural Earth data and the font load behind `delayRender` /
  `continueRender`.
- GPU pipeline warm-up: ANGLE first draws with quickly linked pipelines and
  later swaps in optimised ones compiled in the background, and the two can
  differ in the last bit. When rendering, each browser tab therefore draws
  8 frames spread over the loop and waits ~1.2 s after each before the first
  real frame (about 10 s per tab, not per frame). Without this, a frame
  rendered cold could differ by 1 code value on a few dozen pixels from the
  same frame rendered mid-sequence.

**Check:** render frame 200 alone from a cold start and compare it to frame 200
of the full sequence:

```bash
npx remotion still src/index.ts CloudUpload /tmp/f200.png --frame=200 --scale=0.3333333333333333 --gl=angle
python3 scripts/compare.py /tmp/f200.png out/frames/CloudUpload/element-200.png
```

**Loop check:** `--props='{"loopCheck":true}'` makes a looping composition
601 frames long so frame 600 can be compared with frame 0:

```bash
npx remotion still src/index.ts ConnectedGlobe /tmp/f0.png   --frame=0   --props='{"loopCheck":true}' --scale=0.3333333333333333 --gl=angle
npx remotion still src/index.ts ConnectedGlobe /tmp/f600.png --frame=600 --props='{"loopCheck":true}' --scale=0.3333333333333333 --gl=angle
python3 scripts/compare.py /tmp/f0.png /tmp/f600.png
```

## Banding check

- The post pipeline renders in half-float, applies bloom, tonemaps (ACES),
  encodes to sRGB and only then adds ±1/255 triangular dither plus ~2% grain
  (fixed formula of pixel position and frame).
- The check is done on the **encoded mp4**, not the preview: extract a frame and
  read pixel values along lines through dark gradients and glows.

```bash
ffmpeg -ss 8 -i out/previews/PriceHouses_Dollar.mp4 -frames:v 1 /tmp/ph.png
python3 scripts/banding.py /tmp/ph.png "col:640:0:330" "row:120:0:1280"
```

`banding.py` reports the longest run of identical 8-bit values along the line
(banding = long flat runs) and the largest step in a strip-averaged profile
(banding = steps of a full code value or more).

Results on frames extracted from the encoded 720p mp4s (`out/previews/*.mp4`,
frame at 8 s). "Flat run" = longest run of identical 8-bit values along the
line; "avg step" = largest step of the strip-averaged profile *inside* the
gradient (steps where a probe line crosses an object edge are excluded).

| Look | Probe | Range (luma) | Longest flat run | Avg step in gradient | Result |
|------|-------|-------------:|-----------------:|---------------------:|--------|
| 1A Low-Poly Gold | glossy facet sheen, row 450 | 10–96 | 4 px | < 1 | smooth |
| 2 Cloud Upload | sky gradient, col 1000 | 5–116 | 15 px (darkest band, grain present, row σ ≈ 3) | 0.27 | smooth |
| 2 Cloud Upload | cloud halo, row 180 | 16–25 | 6 px | 0.26 | smooth |
| 3A Price Houses | sepia haze into black, col 250 | 0–15 | 10 px | < 1 | smooth |
| 3A Price Houses | floor reflection falloff, col 1000 | 82–167 | 5 px | 1.45 (over a 85-value ramp) | smooth |
| 4 Network Growth | glow fall-off around core, row 330 | 31–95 | 8 px | < 1 | smooth |
| 5 Connected Globe | atmosphere halo, row 300 | 19–156 | 12 px | < 1 | smooth |
| 5 Connected Globe | near-black ocean, col 640 | 5–9 | 11 px | 0.17 | smooth |

No stepping was found in any dark gradient or glow.

## How to add a version (one data row)

Versions live in `src/versions.ts`. Copy a row, give it a new `id` and change
its values; `Root.tsx` turns every row into a composition automatically.

```ts
export const HOUSES: Version<HousesParams>[] = [
  { id: "PriceHouses-Dollar", params: { symbol: "$", glow: "#F8E8D0", dark: "#2A1E14" } },
  { id: "PriceHouses-Euro",   params: { symbol: "€", glow: "#F8E8D0", dark: "#2A1E14" } },
  { id: "PriceHouses-Pound",  params: { symbol: "£", glow: "#F8E8D0", dark: "#2A1E14" } }, // new
];
```

Parameters per look:

| Look | Row fields |
|------|------------|
| Low-Poly Luxe | `edge`, `face`, `sparkle`, `envTint` |
| Cloud Upload | `accent`, `bg` |
| Price Houses | `symbol`, `glow`, `dark` |
| Network Growth | `cyan`, `lime`, `floor` |
| Connected Globe | `ocean`, `rim`, `city`, `land` |

## Project layout

```
src/
  Root.tsx              compositions (one per data row)
  versions.ts           the data rows
  lib/Stage.tsx         <ThreeCanvas> host: asset loading, per-frame update + render
  lib/post.ts           bloom, DOF, ACES/AgX, sRGB, grain, dither
  lib/reflector.ts      blurred glossy floor reflections
  lib/assets.ts         HDRI / map data / font loaders (delayRender)
  looks/*.ts            one file per look
public/
  hdri/                 Poly Haven HDRI (CC0)
  data/globe.json       land dots, city lights, pins (from Natural Earth)
  fonts/Inter-Bold.woff2
data-src/               Natural Earth source GeoJSON
scripts/
  build-globe-data.mjs  regenerates public/data/globe.json (npm run prepare-data)
  render-preview.sh     720p preview of one composition
  render-all.sh         all seven previews
  verify.sh             steps 1-3 + contact sheets for the rendered previews
  measure-timing.sh     per-frame render time at 720p and 4K
  package.sh            builds the project zip
  compare.py            pixel/byte comparison of two PNGs
  banding.py            banding probe on a decoded frame
licenses/               Inter OFL, HDRI CC0, Natural Earth terms
```

## Completion checklist

- [x] 7 compositions in one Remotion project, 3840×2160, 30 fps; 600 frames (looks 1, 2, 3, 5) / 450 frames (look 4)
- [x] three.js via `@remotion/three`, WebGL2 through ANGLE (`--gl=angle`), no WebGPU, no PixiJS
- [x] One data row per version (`src/versions.ts`): Gold/Silver, Cyan, Dollar/Euro, Blue, Blue & Amber
- [x] Built entirely in code; no MCP servers; no logos/brands/text except `$` / `€`
- [x] Poly Haven CC0 HDRI, Natural Earth (public domain) data and Inter Bold (OFL) shipped with licences
- [x] ACES tonemapping, sRGB output, ±1/255 dither after tonemapping, ~2 % grain from a fixed pixel/frame hash
- [x] No `Math.random()`, no `useFrame` clock, no `Date.now()`, no state carried between frames, no TAA/temporal AO/accumulative shadows
- [x] Glass is faked (Fresnel, emission, reflections); no transmission
- [x] Step 1: all seven previews 1280×720, h264, yuv420p, 30/1, no audio, 20.0 s / 15.0 s
- [x] Step 2: frame 600 == frame 0 byte for byte for all six looping compositions
- [x] Step 3: cold frame 200 == frame 200 of the full render, byte for byte, all seven
- [x] Step 4: banding probes on frames from the encoded mp4s (table above)
- [x] Step 5: five evenly spaced frames per composition checked
- [x] Steps 6–7: side-by-side checks and independent sub-agent comparisons (3 rounds per look)
- [x] 720p mp4 + 720p PNG still for each composition
- [x] README: 4K commands, still command, GL flag, timings, banding check, how to add a version
