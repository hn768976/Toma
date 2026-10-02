# Data · Map · Finance — Remotion project

Eight motion-graphics compositions in one Remotion project, all built in code
(React, three.js via `@remotion/three`, SVG, Canvas 2D). Compositions are defined
at **3840×2160, 30 fps**.

| Composition id | Output file | Look | Frames | Loop |
|---|---|---|---|---|
| `DotMapGlobe-SilverNavy` | `DotMapGlobe_SilverNavy.mp4` | 1 · Dot Map & Globe (3D) | 600 | yes |
| `DotMapGlobe-Teal` | `DotMapGlobe_Teal.mp4` | 1 · Dot Map & Globe (3D) | 600 | yes |
| `DataMatrix-BlueOrange` | `DataMatrix_BlueOrange.mp4` | 2 · Data Streams to Matrix (3D) | 450 | no |
| `DataMatrix-GreenCyan` | `DataMatrix_GreenCyan.mp4` | 2 · Data Streams to Matrix (3D) | 450 | no |
| `FinanceDepth-Blue` | `FinanceDepth_Blue.mp4` | 3 · Finance Depth Field (3D, on black) | 600 | yes |
| `FinanceDepth-Gold` | `FinanceDepth_Gold.mp4` | 3 · Finance Depth Field (3D, on black) | 600 | yes |
| `HologramMap-IceBlue` | `HologramMap_IceBlue.mp4` | 4 · Hologram World Map (2.5D) | 600 | yes |
| `FinanceOverlay-Teal` | `FinanceOverlay_Teal.mp4` | 5 · Finance HUD Overlay (2D, on black) | 600 | yes |

> **Look 5 blend mode:** `FinanceOverlay_Teal` is an overlay on pure black. Put it
> over your own footage with the **Screen** (or **Add / Linear Dodge**) blend mode,
> and the black drops out.

## Setup

```bash
npm install
npx remotion studio          # opens the Studio with all 8 compositions
```

Node 18+ is required (tested with Node 22). All dependency versions are pinned
in `package.json`, and `package-lock.json` is included.

### Chromium GL flag

The three.js looks need WebGL2 in headless Chromium. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`. On the command line, the equivalent is

```
--gl=angle
```

On a machine with a GPU, ANGLE uses it. Without one (CI, containers), Chromium
falls back to SwiftShader, which is slower but gives the same pixels. If your
headless Chromium refuses WebGL entirely, try `--gl=swangle`.

## Render commands (4K)

`remotion.config.ts` already sets H.264, CRF 16, `yuv420p` and PNG intermediate
frames. The flags below are repeated so each command stands on its own.

```bash
npx remotion render DotMapGlobe-SilverNavy out/4k/DotMapGlobe_SilverNavy.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render DotMapGlobe-Teal       out/4k/DotMapGlobe_Teal.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render DataMatrix-BlueOrange  out/4k/DataMatrix_BlueOrange.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render DataMatrix-GreenCyan   out/4k/DataMatrix_GreenCyan.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render FinanceDepth-Blue      out/4k/FinanceDepth_Blue.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render FinanceDepth-Gold      out/4k/FinanceDepth_Gold.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render HologramMap-IceBlue    out/4k/HologramMap_IceBlue.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render FinanceOverlay-Teal    out/4k/FinanceOverlay_Teal.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

To render all eight in one go, run `scripts/render-4k.sh`.

**1080p preview** (how the delivered previews were made: lossless PNG frames, then
x264 CRF 16):

```bash
scripts/render-preview.sh DotMapGlobe-SilverNavy DotMapGlobe_SilverNavy
# or straight to mp4:
npx remotion render DotMapGlobe-SilverNavy out/DotMapGlobe_SilverNavy.mp4 --scale=0.5 --gl=angle --crf=16
```

## Stills (6000×3375)

The scale is 6000 / 3840 = 1.5625:

```bash
npx remotion still DotMapGlobe-SilverNavy out/stills/DotMapGlobe_SilverNavy_f90_6000.png --frame=90 --scale=1.5625 --gl=angle
```

`scripts/stills.sh` renders two stills for every composition, at the frames
listed in `scripts/compositions.txt`. For Look 2, frame 150 shows the strands
falling and frame 430 shows the matrix filling the frame.

## Measured render time

Measured in a cloud container with **4 vCPU, no GPU** (WebGL ran on Chromium's
SwiftShader software renderer through ANGLE), Remotion 4.0.532, `--concurrency=3`.
Times are wall clock for the whole job divided by its frame count, so they
include browser start-up.

| Look | 1080p (`--scale=0.5`), full render | 4K, 24-frame sample | 4K estimate, full length |
|---|---|---|---|
| 1 · Dot Map & Globe (each version) | **0.85 s/frame** (600 f in 514 s / 500 s) | 3.1 s/frame | ≈ 3.0 s/frame → ~30 min per version |
| 2 · Data Matrix (each version) | **1.80 s/frame** (450 f in 811 s / 806 s) | 5.5 s/frame | ≈ 5.3 s/frame → ~40 min per version |
| 3 · Finance Depth (each version) | **0.67 s/frame** (600 f in 403 s / 400 s) | 3.4 s/frame | ≈ 3.2 s/frame → ~32 min per version |
| 4 · Hologram Map | **0.73 s/frame** (600 f in 435 s) | 2.0 s/frame | ≈ 1.9 s/frame → ~19 min |
| 5 · Finance Overlay | **0.09 s/frame** (600 f in 52 s) | 0.26 s/frame | ≈ 0.22 s/frame → ~2–3 min |

All eight at 4K come to about **4 hours** on that machine. 4K has 4× the pixels
and costs 2.7–4× the 1080p time. A machine with a real GPU behind ANGLE will be
much faster on Looks 1–3, which are bound by fragment shading.


## Determinism

Remotion renders frames out of order on several browser tabs, so every value on
screen is a pure function of `useCurrentFrame()`:

- Random layouts come from `mulberry32` seeded at **module level**
  (`src/lib/random.ts`). Per-frame variation (flicker, grain) comes from a
  stateless integer hash (PCG in GLSL, `hash01` in TS). `Math.random()` is never
  used.
- There are no CSS `@keyframes` or transitions, no `Date.now()`, no
  `useFrame` clock, and no state carried between frames. Typing, rolling digits,
  chart data and camera paths are all computed from the frame number.
- The three.js `useFrame` hook is used only to run the post pass's render call.
  It reads the Remotion frame, never the R3F clock.
- There is no TAA or other temporal effect. MSAA is spatial only.
- Fonts (`src/lib/fonts.ts`) and Natural Earth data (`src/lib/geo.ts`) load
  behind `delayRender` / `continueRender`.
- Every looping motion uses a whole number of cycles per 600 frames: the globe
  makes exactly one turn, the depth field travels exactly 1 × L, the scrolling
  candles move exactly one data period, and the background text scrolls exactly
  one block. Grain is seeded with `frame % 600`, so frame 600 equals frame 0
  pixel for pixel.

Loop test: `--props='{"loopTest":true}'` makes the looping compositions 601
frames long, so frames 0 and 600 can be rendered and compared.

## Banding

- **Looks 1, 2 (three.js):** the scene renders into a half-float, 4× MSAA target.
  One final pass (`src/lib/ThreeStage.tsx`) adds triangular-PDF dither of ±1/255
  plus about 2% grain from a fixed hash of (pixel x, pixel y, frame), then
  quantises to 8 bit once.
- **Look 4 (CSS / SVG):** `src/lib/GrainLayer.tsx` draws the same dither + 2%
  grain formula in a small WebGL2 canvas. It is split into a positive layer
  (blend `plus-lighter`) and a negative layer (blend `difference`), so the noise
  is signed.
- **Looks 3, 5:** the background is exactly 0,0,0. Look 3 adds dither only where
  there is signal (`blackSafe`). Look 5 adds no noise at all.

**Banding check (on the encoded 1080p mp4, `scripts/verify.py`):** frames were
decoded from the H.264 files and luma profiles read down the frame, averaged
over 32-px columns and smoothed over 31 rows.

| Preview / frame | Range | Largest step between neighbouring rows (smoothed) |
|---|---|---|
| DotMapGlobe_SilverNavy, t = 6 s, edge column | luma 0.5 → 50.5 | 1.58 levels/row (at the grid lines), 0.35 in a clean gradient column |
| DataMatrix_BlueOrange, t = 12 s | luma 0.3 → 93 | 2.2–3.0 levels/row (at dot rows, which is real detail) |
| HologramMap_IceBlue, t = 6 s | luma 5 → 26 | 0.48 levels/row, 0.09 in the flat side |

Neighbouring pixels in the gradients vary by ±1–4 levels (dither + grain), for
example `(1,3,28) (4,6,31) (5,7,32) …`. The profiles climb smoothly, with no
flat terraces and steps between them.

**Black check (Looks 3, 5):** the background is exactly 0,0,0 in every
lossless frame. In the mp4, every pixel more than 32 px from content is within
±1 **code value** of black (Y = 16, U = V = 128). The preview encode uses
`-x264-params chroma-qp-offset=-12:no-fast-pskip=1:no-dct-decimate=1:trellis=2`
(still H.264, CRF 16, yuv420p) to stop chroma drift in flat black. Without it,
x264 left isolated blocks at RGB 2–10.


## Adding a colourway (one data row)

Every version is one row in `src/versions.ts`. For example, to add a red
Data Matrix:

```ts
export const DATA_MATRIX = [
  // ...existing rows
  { id: "DataMatrix-RedWhite", file: "DataMatrix_RedWhite", palette: { dots: "#FF4A5A", accent: "#FFFFFF", bg: "#12040A" } },
];
```

`Root.tsx` registers one composition per row, so nothing else changes. To
include the new row in the batch scripts, add a line to
`scripts/compositions.txt`.

## Project layout

```
src/
  Root.tsx, index.ts, versions.ts      compositions + colour rows
  lib/        random, loop maths, fonts, Natural Earth loader, three.js stage +
              post pass, instanced depth-of-field dots, 2D grain layer
  looks/dotglobe/       Look 1
  looks/datamatrix/     Look 2
  looks/financedepth/   Look 3
  looks/hologram/       Look 4
  looks/overlay/        Look 5
public/fonts/   Inter, JetBrains Mono (woff2) + OFL licences
public/data/    Natural Earth 1:50m land (GeoJSON) + licence (public domain)
scripts/        render, still and verification helpers
```

## Licences and content

- **Inter** and **JetBrains Mono** are under the SIL Open Font License 1.1. See
  `public/fonts/LICENSE-*.txt`. The font files come from the `@fontsource`
  packages (v5.3.0).
- **Natural Earth** 1:50m land is public domain. See
  `public/data/LICENSE-NaturalEarth.md`. Antarctica is left out in code.
- All tickers are invented codes (`IDX-01`, `SEC-A`, `FND-7`, …), and all numbers
  are made up. The on-screen code text is our own generic lines. No product,
  company or brand names appear.

## Completion checklist

Verified on the delivered 1080p previews (`scripts/verify.py`, plus the
commands noted below):

- [x] 8 previews, 1920×1080, H.264, yuv420p, 30/1, no audio, durations 20.0 s
      (Look 2: 15.0 s).
- [x] Loops: frame 0 and frame 600 (`loopTest`, 601 frames) are pixel-identical
      for all six looping compositions.
- [x] Determinism: frame 150 **and** frame 333, rendered cold with
      `remotion still`, are byte-identical to the same frames of the full
      multi-tab render, for all 8 compositions.
- [x] Black check, Looks 3 and 5: 0,0,0 in the render. In the mp4, Gold and the
      overlay never exceed RGB 1 in empty areas. **Blue:** 0.0035% of empty
      pixels decode to RGB 2. That is a single ±1 chroma code step, which
      BT.709 maps to RGB 2. See the black check above.
- [x] Banding: smooth profiles in 1A, 2A and 4 (above).
- [x] Contents: 5 evenly spaced frames per preview reviewed. The map and globe
      are recognisable, the globe turns and the code types and clears. Strands
      fall and curve into the matrix, and the camera ends low over a full-frame
      matrix. Look 3 has numbers, candles and lines at many depths, with large
      dotted numbers close and a black background. Look 4 has a glowing tilted
      map with a bright outline, crossing streaks, and a visible light sweep.
      Look 5 has all listed elements, invented codes only, on black. Each pair
      differs only in colour.
- [x] 1080p PNG still of each composition, plus 2 × 6000×3375 PNG stills per
      composition.
- [x] Fonts and Natural Earth shipped with licences. No `Math.random`,
      `@keyframes`, CSS transitions, `Date.now` or TAA.
- [x] `npm install && npx remotion studio` works from a clean copy of the zip.

