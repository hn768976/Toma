# Voxel Fields — Remotion + three.js

Two abstract cube-field loops, seen from above at an angle. Both are 20 s seamless loops: 600 frames at 30 fps, 16:9, with every composition defined at 3840×2160.

| Look | Compositions (id → output file) |
|---|---|
| 1 · Voxel Canyon | `VoxelCanyon-Green` → `VoxelCanyon_Green.mp4` · `VoxelCanyon-White` → `VoxelCanyon_White.mp4` · `VoxelCanyon-Blue` → `VoxelCanyon_Blue.mp4` |
| 2 · Voxel Wave | `VoxelWave-Blue` → `VoxelWave_Blue.mp4` · `VoxelWave-Mint` → `VoxelWave_Mint.mp4` |

Remotion composition ids can't contain `_`, so the ids use `-` and the output files use `_`.

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ is required. Every dependency is pinned in `package.json`, and `package-lock.json` is included.

## Render at 4K

The GL flag is **`--gl=angle`**: WebGL2 through ANGLE in headless Chromium. It's already set in `remotion.config.ts`. Pass it explicitly too if you render through the Node APIs, which don't read the config file.

```bash
npx remotion render VoxelCanyon-Green out/VoxelCanyon_Green.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render VoxelCanyon-White out/VoxelCanyon_White.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render VoxelCanyon-Blue  out/VoxelCanyon_Blue.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render VoxelWave-Blue    out/VoxelWave_Blue.mp4    --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render VoxelWave-Mint    out/VoxelWave_Mint.mp4    --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
```

- **Timeout.** On a machine without a GPU, add `--timeout=900000`. Software WebGL is slow, and a frame can take longer than the default 30 s.
- **Concurrency.** `--concurrency` speeds things up on a real GPU. With software GL it doesn't help, because SwiftShader already uses every core.
- **1080p previews.** These used the same compositions with `--scale=0.5`. See `scripts/render-previews.py`: it renders a PNG sequence, then encodes H.264, yuv420p, CRF 16, 30 fps, with no audio.

## Stills (6000×3375 PNG)

```bash
npx remotion still VoxelCanyon-Green out/stills/VoxelCanyon_Green_f0180.png --frame=180 --scale=1.5625 --gl=angle --image-format=png --timeout=900000
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. The chosen frames, two per composition, are in `scripts/render-stills.sh`. For look 1 they're frames with a clear hole into the void.

## How it's built

- **One box per column.** Each look is a single `InstancedMesh` of unit boxes, each stretched vertically to its column's height. The lines between the stacked cubes are drawn by the shader (`src/three/voxelMaterial.ts`) as a world-space grid on every face:
  - Cube edges fall on whole world units, so a 12-cube column is one box that reads as 12 cubes.
  - Lines are a constant 0.034 world units wide, slightly darker than the face, and antialiased with `fwidth`.
  - Lines never get thinner than about 0.75 px. Below that they fade instead, so they don't shimmer.
- **Only visible boxes are drawn.**
  - Box depth: each box only extends down to the lowest top among its 8 neighbours. Anything below that can't be seen and can't cast a shadow.
  - Grid size: heights are computed on an 88×88 bounding grid. Only the 3,815 columns inside the camera's visible footprint (plus a 4-cell margin) are drawn (`src/lib/frameArea.ts`).
  - The camera is closer than "140 columns" would imply, to match the references: about 30 columns across the frame. A 140×90 grid would be about 80% off screen.
- **Heights** are pure functions of the frame number (`src/lib/fields.ts`):
  - **Canyon:** two layers of 4D simplex noise, stretched along the rows so slabs and canyons form long trenches. A third, column-scale layer is active only below the rim, so canyon walls are ragged while plateau tops stay flat. A gentle terrace step makes groups of columns move as slabs: plateau 0, raised slabs +1/+2, canyon steps −4/−8. Below the void threshold a column keeps falling, to −90.
  - **Balance:** each frame, the field is shifted so that a low percentile of the in-frame noise sits just under the void threshold. This keeps one or more holes open in every frame. It's a continuous, periodic function of the frame.
  - **Wave:** a travelling ridge profile (stepped rise, steep face, wide flat trough). It moves exactly 2 wavelengths per loop, and its height varies along each ridge with circle-in-time noise.
- **Shading:**
  - Light: a soft key from the upper left, plus a cool hemisphere sky fill.
  - Shadows: PCSS, using the same shader as drei's `<SoftShadows>`. It's patched into three's shader chunk at module load rather than in a React effect, so the very first frame a render thread draws already has soft shadows (`src/three/pcss.ts`).
  - Gaps: the shader shifts walls toward a saturated tint and darkens them with depth below the surrounding tops. That's computed from heights, with no screen-space or temporal AO. Holes fade to each palette's deep colour.
  - Materials: matte, roughness 0.6, and 0.42 on top faces for a faint sheen.
  - Post: `DepthOfField` with real depth blur, then ACES Filmic tone mapping, sRGB output, and grain.
  - Nothing accumulates over frames: no TAA, no `AccumulativeShadows`, no temporal AO.
- **Determinism:**
  - No `Math.random()` at render time. `mulberry32` is seeded at module level for noise permutations, column colours and floating-cube paths.
  - No `useFrame` clock, `Date.now()` or carried-over state. `useFrame` is only used to trigger the draw and release the frame.
  - A `RenderGate` holds each frame with `delayRender` until R3F has drawn it with that frame's data.

## Loop

- `t = (frame mod 600) / 600`, so frame 600 is frame 0 exactly.
- **Canyon:** the noise is sampled around circles in time, `noise(x, z, cos 2πt·r, sin 2πt·r)`, so the motion through the loop point is as smooth as anywhere else.
- **Wave:** the ridges travel a whole number of wavelengths, 2 per loop.
- **Floating cubes:** closed paths with whole-number frequencies.
- **Camera:** a closed drift path with frequencies 1 and 2 and an amplitude of 0.7 units, about 2% of the frame. It's a translation only, never an orbit.
- **Grain:** a fixed integer hash of the pixel and `frame % 600`.

`scripts/field-stats.ts` also checks the heights numerically: the jump from 599 to 600 is no larger than an ordinary frame step.

## Banding

- The final pass works in sRGB, after tone mapping, and adds:
  - ±1/255 dither
  - 1.5% monochrome grain, triangular-distributed, from a PCG hash of (pixel, `frame % 600`)
- Intermediate buffers are half-float.

**How to check:** take a frame from the encoded mp4 (not the preview) and read pixel values across a large flat top face:

```bash
ffmpeg -i out/previews/VoxelCanyon_White.mp4 -vf "select=eq(n\,450)" -vsync 0 -frames:v 1 f.png
python3 scripts/verify.py banding     # picks the flattest bright block, writes out/verify/*-banding.txt
```

The raw values should vary pixel to pixel (dither and grain), and the row-averaged profile should change smoothly, by less than one 8-bit level per pixel. Steps mean banding.

## Measured render time (this build machine)

RESULTS_PLACEHOLDER

## How to add a palette (one data row)

Add one object to `PALETTES` in `src/lib/palettes.ts`. It becomes a new composition automatically, using the same heights and motion as the other palettes of its look:

```ts
{
  id: "VoxelCanyon-Coral",          // composition id: letters, digits, "-"
  look: "canyon",                   // "canyon" or "wave"
  colors: ["#ffffff", "#ffeae4", "#ffd2c4", "#ffb39b", "#ff8a6b", "#f0603f"], // lightest first
  weights: [3.4, 3, 2.4, 1.6, 0.9, 0.5], // share of each colour
  accent: { color: "#ffd166", amount: 0.05 }, // optional: a few small patches
  tint: "#f0603f",                  // saturated colour walls shift toward in gaps
  deep: "#2a0c06",                  // deepest gaps / void
  sky: "#fff1ea",                   // sky fill light
},
```

## Verification

```bash
scripts/render-previews.py        # 1080p previews + PNG sequences, logs timing
python3 scripts/verify.py         # probe, loop, determinism, banding, frames, heights
```

- **Loop check.** It renders frames 0 and 600 as stills, with the composition temporarily 601 frames long (env `REMOTION_VOXEL_FRAMES=601`), and compares them byte for byte.
- **Determinism check.** It renders frame 300 from a cold start and compares it with frame 300 of the full render.
- **Height check.** It renders a depth-only pass (env `REMOTION_VF_PROFILE=depth`) of every palette at frame 300 and checks the renders are byte-identical within each look.

## Completion checklist

CHECKLIST_PLACEHOLDER
