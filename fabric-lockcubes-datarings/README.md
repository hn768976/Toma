# Pastel Fabric · Lock Cubes · Data Rings

Remotion 4 + three.js (WebGL2), 30 fps, 600 frames (20 s) seamless loops.
Compositions are defined at 3840×2160.

| Composition id | Look | Reference |
|---|---|---|
| `PastelFabric-Iridescent` | 1A | 2157407170 |
| `PastelFabric-Champagne` | 1B | (colourway of 1A) |
| `LockCubes-BlueOrange` | 2 | 2226670958 |
| `DataRings-FrontTilt` | 3A | 2227247513 |
| `DataRings-CloseAngle` | 3B | 2227245781 |
| `DataRings-LowHorizon` | 3C | 2227246601 |
| `DataRings-TopSpin` | 3D | 2227248200 |
| `DataRings-FrontTiltViolet` | 3E | (colourway of 3A) |

## Setup

```bash
npm install
npx remotion studio          # preview
```

Node 18+ (tested on Node 22). Versions are pinned in `package.json`.

### Chromium GL flag

WebGL2 in headless Chromium needs ANGLE:

```
--gl=angle
```

`remotion.config.ts` sets this (`Config.setChromiumOpenGlRenderer("angle")`), so
the CLI commands below pick it up automatically. Pass `--gl=angle` explicitly
if you render through another entry point. On a machine with a GPU, ANGLE uses
it; on a GPU-less machine Chromium falls back to SwiftShader (software), which
is much slower (that is what the timings below were measured on).

## Render commands (4K)

```bash
npx remotion render src/index.ts PastelFabric-Iridescent   out/PastelFabric_Iridescent.mp4   --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts PastelFabric-Champagne    out/PastelFabric_Champagne.mp4    --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts LockCubes-BlueOrange      out/LockCubes_BlueOrange.mp4      --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts DataRings-FrontTilt       out/DataRings_FrontTilt.mp4       --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts DataRings-CloseAngle      out/DataRings_CloseAngle.mp4      --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts DataRings-LowHorizon      out/DataRings_LowHorizon.mp4      --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts DataRings-TopSpin         out/DataRings_TopSpin.mp4         --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts DataRings-FrontTiltViolet out/DataRings_FrontTiltViolet.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
```

720p preview of any composition: add `--scale=0.3333333333333333` (gives an
exact 1280×720 drawing buffer; the canvas renders at the device scale, it is
not downsampled from 4K).

### Stills (6000×3375)

```bash
npx remotion still src/index.ts DataRings-FrontTilt out/DataRings_FrontTilt_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375. Swap the composition id for the others.)

## Measured render times

Measured in a GPU-less cloud container (4 vCPU, Chromium falls back to
SwiftShader software GL behind ANGLE). **A machine with a real GPU will be far
faster**; treat these as worst-case numbers.

720p (`--scale=0.3333333333333333`, 1280×720):

| Composition | Single cold still (minus ~3 s browser start) | Sequence render, 10 frames, concurrency 2 (wall s / frame, incl. start-up) |
|---|---|---|
| PastelFabric-Iridescent | ~15.9 s | 9.86 s |
| PastelFabric-Champagne | (same shader as 1A) | 8.63 s |
| LockCubes-BlueOrange | ~3.0 s | 2.01 s |
| DataRings-FrontTilt | — | 3.52 s |
| DataRings-CloseAngle | — | 3.31 s |
| DataRings-LowHorizon | ~5.5 s | 3.55 s |
| DataRings-TopSpin | — | 3.61 s |
| DataRings-FrontTiltViolet | — | 3.43 s |

The fabric's cost at 720p is dominated by the 1024×576 vertex displacement
(3 × 5 4D-noise evaluations per vertex), so it scales less than linearly
with resolution.

Real 4K frames (3840×2160, frame 300, single cold still):

| Composition | Wall time | Minus ~3 s start-up |
|---|---|---|
| **3C DataRings-LowHorizon** (≈213k points with shader DoF + 5,920 blocks + gather DoF) | 52.0 s | ~49 s |
| **1A PastelFabric-Iridescent** (shallow DoF, 48-tap gather) | 57.7 s | ~55 s |
| 2 LockCubes-BlueOrange (extra measurement) | 35.9 s | ~33 s |

4K estimate per composition, 600 frames, on this software-GL container at
concurrency 2 (≈ per-frame × 600 / 2):

| Composition | Estimate here | Rough estimate on a desktop GPU |
|---|---|---|
| PastelFabric-Iridescent / -Champagne | ~4.6 h each | ~10–20 min each |
| LockCubes-BlueOrange | ~2.8 h | ~5–10 min |
| DataRings-* (×5) | ~4.1 h each | ~10–20 min each |

(The GPU column is an estimate, not a measurement: these passes are
fill-rate/vertex bound and typically run 30–100× faster on hardware.)


## How it works

- `src/lib/Stage.tsx` wraps `@remotion/three`'s `<ThreeCanvas>`. Each look owns
  its scene, camera and post pipeline and renders **as a pure function of the
  frame number** from `useCurrentFrame()`. `useFrame` is used only as the hook
  that takes over rendering (priority 1); its clock is never read.
- `src/lib/post.ts` is the shared, non-temporal post chain: HDR scene target
  (scene shaders write linear view depth into alpha) → depth-of-field gather
  with a fixed golden-angle tap pattern and mip-assisted taps → bloom
  (threshold, 6-level down/up chain) → exposure, tonemap, vignette, chromatic
  fringe → **dither (±1 LSB TPDF) and grain last**, both a fixed hash of pixel
  position and `frame % 600`.
- Randomness: `mulberry32` seeded at module level (`src/lib/random.ts`) or
  integer hashes in GLSL. No `Math.random()`, `Date.now()`, `useState` or
  carried state; no TAA or temporal accumulation.

### Look 1 — Pastel Fabric (`src/fabric`)
1024×576-segment plane displaced in the vertex shader by skewed diagonal
ridges, a slow swell and crest ripples, all sampled from 4D simplex noise with
time on a circle; the ridges also roll one wavelength per loop. Normals by
finite differences. The satin shader mixes a hue coordinate (sideways facing +
view direction) into lit → foldA / lit → foldB ramps, troughs and the lower
frame sink to the deep colour, plus a Kajiya-Kay sheen along the folds. Very
shallow DoF with a focus plane that drifts once per loop, light bloom, 1 % grain.

### Look 2 — Lock Cubes (`src/cubes`)
2,500 instanced cubes (50×50). Heights = seeded static offset + 7 travelling
sine waves with integer temporal cycles (±25 % of a cube). Analytic AO from the
four neighbours' heights (no noise, no history), bevelled-edge normals, cool sky
light, and warm point lights at the two hot cubes (pulsing in whole cycles).
Glyph atlas (`0`, `1`, padlock) drawn once with Canvas 2D paths (no fonts);
each cube face changes glyph 0–3 times per loop on its own schedule.

### Look 3 — Data Rings (`src/rings`)
One shared structure (`structure.ts`), four camera presets and two palettes
(`presets.ts`).
- 5,920 instanced blocks: inner bar ring (160 segments), outer skyline ring
  (300 segments) and two low notched HUD bands. Each ring turns by a whole
  number of segments per loop; bar values blend from segment *i* to segment
  *i + shift* over the loop (variance-preserving, zero velocity at the seam), so
  frame 600 is identical to frame 0.
- ~213,000 points in one draw call: dashed dotted rings, the dotted bright
  circles, 1,200 fine radial hairlines across the disc, outward-flowing disc
  points and the dashed bokeh arcs out to ~2R. Moving points use a whole-loop
  life cycle (fade in, travel, fade out), so any speed loops exactly. Point
  size by distance, DoF in the shader (CoC → disc size, energy kept), soft
  occlusion against the blocks' depth, and a foreshortening term so rings seen
  edge-on do not pile up into hot spots.

## Adding a colourway or a camera angle

- **Colourway:** add an entry to `FABRIC_COLOURWAYS` (`src/fabric/palettes.ts`),
  `CUBES_COLOURWAYS` (`src/cubes/palettes.ts`) or `RING_PALETTES`
  (`src/rings/presets.ts`), then add one row to `ROWS` in `src/Root.tsx`.
- **Camera angle (Data Rings):** add a preset to `RING_CAMERAS`
  (`src/rings/presets.ts`: elevation, azimuth, distance, roll, lens shift,
  focus point, aperture, motion) and one row to `ROWS`. Camera motion must be
  closed: use `driftDeg`/`pushIn` (whole cycles) or `orbitDeg` (out and back).

## Verification scripts

- `scripts/frames.mjs <id> <outDir> <scale> <frames>`: render frames with one browser.
  `LOOP_CHECK=1` makes every composition 601 frames (for the frame 0 vs 600 check).
- `scripts/verify.sh [ids…]`: loop check, cold-vs-sequence determinism, contact sheets, timing.

## Checks (run with `scripts/verify.sh` and `scripts/banding.py`)

The 720p mp4 previews were dropped from this delivery on request, so the
checks run on PNG frames rendered by Remotion (the same pixels that would be
encoded).

| Check | Result |
|---|---|
| Frame size | Stills are exactly 1280×720 at `--scale=0.3333333333333333`; 4K stills exactly 3840×2160 |
| Loop: frame 0 vs frame 600 (601-frame mode) | **Byte-identical PNGs for all 8** |
| Determinism: frame 300 from a cold `remotion still` vs frame 300 from a multi-threaded sequence render (frames 296–305, concurrency 2) | **Byte-identical for all 8** |
| Banding (PNG, 9-px-averaged profiles) | Fabric gradients (1A, 1B): longest flat run 6–7 px, smooth fractional steps. Orange glow on the cubes: longest flat run 4 px. Ring background / dark corner: longest flat run 5–6 px, dither present. No stepped plateaus. |
| Contact sheets (frames 0/120/240/360/480) | Folds roll; cubes bob and glyphs change; rings rotate, points flow; 3D orbit visible. No text or logos. 3E: 0 % cyan, 94 % violet/magenta of saturated pixels. |
| Motion (frames 296–305 of 1A, 2, 3D) | Mean frame-to-frame difference is steady (1A 1.34→1.40, 2 2.33→2.35, 3D 2.17→2.23), no stutter or popping |

### Completion checklist

- [x] 8 compositions at 3840×2160, 30 fps, 600 frames, one data row each (`src/Root.tsx`)
- [x] Four Data Rings angles share one scene; only camera/focus presets differ; 3E is a palette row
- [x] Every visual is a function of `useCurrentFrame()`; mulberry32 at module level; no `Math.random()`, `Date.now()`, `useState`, TAA or temporal accumulation
- [x] Dither ±1/255 and grain (1 % fabric, 1.5 % others) last, from `frame % 600`
- [x] Loop and determinism checks pass for all 8
- [x] 720p stills of all 8; 4K timings for 3C and 1A
- [ ] 720p mp4 previews: not rendered (dropped on request)


### Known differences from the references

- **Point count** is ~213k rather than 250k. Packing in more points turned the
  dark gaps into glitter haze, which moved the frames away from the references.
  Most of the budget goes into the disc's fine radial hairlines.
- **One structure, four angles.** The four Data Rings references don't show the
  same object: 3C is a flat disc of radial rays with no blocks, while 3B and 3D
  show dense tall bar towers around a small hole. The shared structure is a
  compromise between them.
- **Lock Cubes:** the reference has a single hot cube; the brief asks for two,
  so the second glows more dimly. The reference's merged two-cube blocks are
  not reproduced.
- **Fabric:** colour placement uses a view-dependent hue term, so the violet
  side of the frame changes less over the loop than the folds do.
