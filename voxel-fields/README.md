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
  - **Canyon shape:** two layers of 4D simplex noise, stretched along the rows so slabs and canyons form long trenches. A third, column-scale layer is active only below the rim, so canyon walls are ragged while plateau tops stay flat. The target height is deliberately steep:
    - flat slabs at 0, with raised slabs at +1/+2
    - a sheer wall down to −5, then a floor sloping to −7 at the void threshold
    - below that, columns sink into the dark, down to −84
  - **Canyon motion (slow):**
    - The noise moves slowly around a small time circle (radius 0.1).
    - Each column's height is its target averaged over a centred 36-frame triangular window, wrapping around the loop. A column crossing a slab edge glides up or down over about a second instead of snapping.
    - Measured speed of visible columns (`scripts/motion-stats.ts`): p99 about 0.17 cubes/frame and max about 0.24 above the canyon floor; typical columns hold still or drift at under 0.03.
  - **Balance:** each frame, the in-frame noise is normalised so its median sits on the plateau and its 5th percentile sits past the void threshold. Holes stay open in every frame (5–9% of the frame) while canyons cover 20–32%. It's a continuous, periodic function of the frame.
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
- **Canyon:** the noise is sampled around circles in time, `noise(x, z, cos 2πt·r, sin 2πt·r)`, and the smoothing window wraps around the loop, so the motion through the loop point is as smooth as anywhere else.
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

Measured on the build machine: 4 vCPU, no GPU. WebGL ran as ANGLE on SwiftShader, which is software rendering. All times are wall-clock.

| | Canyon (×3) | Wave (×2) |
|---|---|---|
| 1080p (`--scale=0.5`, concurrency 2), full 600-frame render incl. start-up | **5.04–5.08 s/frame** (≈ 50 min per composition) | **3.11 s/frame** (≈ 31 min) |
| 1080p steady state (6-frame minus 1-frame run) | ≈ 7.4 s/frame at concurrency 1 (development benchmark) | ≈ 3.0 s/frame at concurrency 1 (development benchmark) |
| **4K measured** (`--scale=1`, concurrency 2, 6-frame minus 1-frame run) | **24.4 s/frame** → ≈ 4.1 h per composition | **12.5 s/frame** → ≈ 2.1 h per composition |

- **Grid:** 88×88 bounding grid (7,744 columns), of which 3,815 are drawn (the visible footprint plus a 4-cell margin). One `InstancedMesh` holds all of them.
- **Biggest cost:** PCSS soft shadows (10 samples), about 40% of canyon frame time on software GL.
- **All five at 4K on CPU only:** ≈ 16–17 hours.
- **On a GPU (not measured here):**
  - Expect well under a second per 4K frame.
  - Raise `--concurrency`.
  - Keep `--gl=angle`, which uses the GPU through ANGLE when one exists.
  - On Linux servers with an NVIDIA GPU, `--gl=vulkan` or `--gl=egl` may be faster. Check that frame 300 still matches a cold still afterwards.

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
python3 scripts/render-previews.py   # 1080p previews + PNG sequences, logs timing
python3 scripts/verify.py         # probe, loop, determinism, banding, frames, heights
```

- **Loop check.** It renders frames 0 and 600 as stills, with the composition temporarily 601 frames long (env `REMOTION_VOXEL_FRAMES=601`), and compares them byte for byte.
- **Determinism check.** It renders frame 300 from a cold start and compares it with frame 300 of the full render.
- **Height check.** It renders a depth-only pass (env `REMOTION_VF_PROFILE=depth`) of every palette at frame 300 and checks the renders are byte-identical within each look.

## Completion checklist

Status of the 1080p previews in `out/previews` and the final source:

- [x] Five compositions, 3840×2160, 30 fps, 600 frames, seamless 20 s loops
- [x] Look 1 Canyon: Green / White / Blue, identical heights. Depth-only renders at frame 300 are byte-identical.
- [x] Look 2 Wave: Pale Blue / Mint, identical heights (same check)
- [x] One `InstancedMesh` per field. Cube lines are drawn by the shader in world space, constant width, antialiased.
- [x] Neighbouring columns share colours in bands. Colours are chosen once, from a seeded `mulberry32` and noise.
- [x] Soft key light from the upper left plus a cool sky fill, PCSS soft shadows, height-based gap darkening, roughness 0.6 with sheen on the tops
- [x] Real depth of field: sharp middle band, soft near and far. ACES Filmic tone mapping, sRGB output.
- [x] No accumulating effects (no TAA, `AccumulativeShadows` or temporal AO). No `Math.random()`, `Date.now()` or clock at render time.
- [x] **Step 1 – file checks:** 1920×1080, 30/1, 20.0 s, h264, yuv420p, 600 frames, no audio (all five)
- [x] **Step 2 – loop:** frame 600 equals frame 0 byte for byte, rendered at 601 frames (all five). The 599→0 step is no larger than an ordinary frame step.
- [x] **Step 3 – determinism:** a cold still of frame 300 is byte-identical to frame 300 of the full multi-tab render (all five)
- [x] **Step 4 – banding:** in Canyon White and Wave Blue mp4 frames, the row-averaged profile across a flat top changes by at most 0.58 of an 8-bit level per pixel; the raw values are dithered, with flat runs of 3–4 px only
- [x] **Step 5 – frames:** columns move between picks. Canyon: 1.3–2.8% near-black void pixels in every pick. Wave: zero dark pixels. Rows run diagonally. Contact sheets are in `out/verify/*-sheet.png`.
- [x] Stills: 2 per composition at 6000×3375, plus a 1080p PNG of each
- [x] Measured render time recorded above
- [ ] **Known minor artifact:** at a few inner corners where a lit top meets the foot of a taller column, PCSS leaves a very faint dotted pattern, a few pixels at 1080p. It's only visible when zoomed in.
