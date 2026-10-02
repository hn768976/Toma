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
```

Each preview is rendered with `--scale=0.3333333333333333` to a lossless PNG
sequence (exactly 1280×720 — the canvas size is rounded so 1/3 never truncates
to 1279×719), then encoded with ffmpeg: H.264, `yuv420p`, 30 fps, CRF 16, no
audio. The script also saves a 720p PNG still per composition.

## Render time

MEASURED_TIMES

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

BANDING_RESULTS

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
  compare.py            pixel/byte comparison of two PNGs
  banding.py            banding probe on a decoded frame
licenses/               Inter OFL, HDRI CC0, Natural Earth terms
```

## Completion checklist

CHECKLIST
