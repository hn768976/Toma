# Serum Capsule · Crystal Burst · Digit Swirl · Ribbed Dunes · Cube Cluster

One Remotion project with **5 looks → 8 compositions**, all real 3D with
**three.js on WebGL2** via `@remotion/three` (no PixiJS, no WebGPU).

| Composition id | Look | Length | Output name |
|---|---|---|---|
| `SerumCapsule-SilverBlue` | 1A Serum Capsule, Silver Blue | 300 f (10 s story) | `SerumCapsule_SilverBlue.mp4` |
| `SerumCapsule-Gold` | 1B Serum Capsule, Gold | 300 f (10 s story) | `SerumCapsule_Gold.mp4` |
| `CrystalBurst-IceBlue` | 2A Crystal Burst, Ice Blue | 600 f (20 s loop) | `CrystalBurst_IceBlue.mp4` |
| `CrystalBurst-AmethystRose` | 2B Crystal Burst, Amethyst Rose | 600 f (20 s loop) | `CrystalBurst_AmethystRose.mp4` |
| `DigitSwirl-Teal` | 3 Digit Swirl, Teal | 600 f (20 s loop) | `DigitSwirl_Teal.mp4` |
| `RibbedDunes-White` | 4A Ribbed Dunes, White | 600 f (20 s loop) | `RibbedDunes_White.mp4` |
| `RibbedDunes-Graphite` | 4B Ribbed Dunes, Graphite | 600 f (20 s loop) | `RibbedDunes_Graphite.mp4` |
| `CubeCluster-Blue` | 5 Cube Cluster, Blue | 600 f (20 s loop) | `CubeCluster_Blue.mp4` |

All compositions are defined at **3840×2160, 30 fps**.

## Setup

```bash
npm install
npx remotion studio
```

Node 18+ (tested with Node 22). Versions are pinned in `package.json`
(remotion / @remotion/cli / @remotion/three 4.0.515, three 0.180.0,
@react-three/fiber 9.3.0, React 19.2.3).

## Chromium GL flag

WebGL2 must be on in headless Chromium. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the same as passing
`--gl=angle` on the command line. On a machine with a GPU, ANGLE uses it; on a
machine without one, Chromium falls back to SwiftShader (software) through ANGLE
(this is what the times below were measured on).

## 4K render commands (one per composition)

```bash
npx remotion render SerumCapsule-SilverBlue   out/SerumCapsule_SilverBlue.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render SerumCapsule-Gold         out/SerumCapsule_Gold.mp4         --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render CrystalBurst-IceBlue      out/CrystalBurst_IceBlue.mp4      --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render CrystalBurst-AmethystRose out/CrystalBurst_AmethystRose.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render DigitSwirl-Teal           out/DigitSwirl_Teal.mp4           --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render RibbedDunes-White         out/RibbedDunes_White.mp4         --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render RibbedDunes-Graphite      out/RibbedDunes_Graphite.mp4      --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render CubeCluster-Blue          out/CubeCluster_Blue.mp4          --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
```

720p previews (what was rendered here): add `--scale=0.3333333333333333`
(gives exactly 1280×720). `scripts/render-preview.sh <id> <name>` does this as a
PNG sequence + ffmpeg encode (H.264, yuv420p, 30 fps, CRF 16, no audio).

## 6K stills

```bash
# 6000×3375 = 3840×2160 × 1.5625
npx remotion still CubeCluster-Blue out/CubeCluster_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
npx remotion still SerumCapsule-SilverBlue out/SerumCapsule_SilverBlue_6K.png --frame=240 --scale=1.5625 --gl=angle
```

Any composition id works; use a frame from the hold (≥ 225) for Serum Capsule.
(6K stills were not rendered here.)

## Adding a colourway (one data row)

Every version is one row in `src/data.ts`. Copy a row in the matching array,
give it a new `id`, change the colours. `src/Root.tsx` registers every row
automatically. Example:

```ts
// src/data.ts → CRYSTAL_BURST
{
  id: "CrystalBurst-Emerald",
  props: {
    base: "#2A9A78", deep: "#03140E",
    strips: ["#FFFFFF", "#4AE0A8", "#3AD8E8", "#A8F0D0"],
    accents: ["#F0D090", "#A898F0", "#F0A0C0"],
    tint: "#1E4A3C",
  },
},
```

## How it is built

* `src/common/SceneCanvas.tsx` – one `<ThreeCanvas>` per composition; the
  render loop is taken over with a priority-1 `useFrame` whose callback reads
  only the Remotion frame (captured during React render). R3F's clock is never
  read.
* `src/common/Pipeline.ts` – shared post pipeline: scene → **half-float
  (RGBA16F) 4× MSAA target** → SSAO (Cube Cluster) → depth-of-field (CoC from
  depth, half-res gather) → bloom (¼ + ⅛ res) → composite (AO, DoF, bloom,
  chromatic aberration, vignette, tone map, linear→sRGB, **1.5 % grain**,
  **±1/255 blue-noise dither**) → 8-bit canvas.
* `src/common/blueNoise.ts` – 64×64 blue-noise tile made with void-and-cluster at
  module load (deterministic).
* `src/common/random.ts` – `mulberry32`, seeded at module level.
* Looks: `src/looks/*.tsx`.
  * **Serum Capsule** – glass bubbles are analytic sphere impostors (fresnel
    rim, window reflection, thin-shell refraction of the backdrop, faint rim
    iridescence, analytic defocus); the capsule is drawn as a body pass behind
    the molecule and a rim pass in front; 7-atom pentagon + 2 side-atom
    molecule (generic ring structure, no named compound) with
    `MeshPhysicalMaterial` + a RoomEnvironment PMREM; orbit rings are ribbons
    drawn on in a shader, split in front of/behind the capsule.
  * **Crystal Burst** – 420 instanced faceted spindles (12 sectors × 35, 3 depth
    rings), `MeshPhysicalMaterial` metalness 0.3 / roughness 0.05 /
    iridescence 1 (300–800 nm via a thickness map), procedural light-strip
    environment (PMREM, rotated with `envMapRotation`), RGB-split environment
    sampling for fake dispersion. Turns exactly 30° and the environment
    exactly 360° per loop.
  * **Digit Swirl** – 7,000 instanced digit quads (JetBrains Mono atlas built
    once after the font loads), 400 streak ribbons, 20 barcode tags, all moving
    along a curved Bézier tunnel in the vertex shader with whole laps per
    loop; 7 arc rings; teal haze and light rays in the backdrop.
  * **Ribbed Dunes** – 48×48-unit plane (480×640 segments) displaced by
    loop-periodic dunes; ~120 fine ridges are carried by per-pixel analytic
    normals with an `fwidth` fade (no moiré), wrap lighting, fog into the sky.
  * **Cube Cluster** – 220 instanced rounded cubes on a jittered lattice,
    PCF soft shadows, fixed-kernel SSAO, DoF, haze.

## Determinism

Every value on screen is a function of `useCurrentFrame()` only:
no `Math.random()`, no `Date.now()`, no R3F clock, no state carried between
frames, no TAA / accumulation. Loops use `frame % 600` and only whole cycles,
so frame 600 equals frame 0. The font, digit atlas, PMREM environments and
blue-noise tile are built once; the font waits on `delayRender`.

## Measured render times

Machine: 4-vCPU cloud container, **no GPU** – Chromium's WebGL2 runs on
SwiftShader (software) via ANGLE. Times are wall-clock for the whole render
(including bundling and encoding) divided by the frame count, concurrency 2.

| Composition | 720p s/frame | 4K estimate here (software) |
|---|---|---|
| SerumCapsule-SilverBlue | 0.47 | **10.9 s/frame measured** → ~55 min |
| SerumCapsule-Gold | 0.48 | ~55 min |
| CrystalBurst-IceBlue | 6.05 | **97 s/frame measured** → ~16 h |
| CrystalBurst-AmethystRose | 6.18 | ~16.5 h |
| DigitSwirl-Teal | 0.63 | ~13 s/frame → ~2.1 h |
| RibbedDunes-White | 1.02 | ~20 s/frame → ~3.4 h |
| RibbedDunes-Graphite | 1.09 | ~22 s/frame → ~3.6 h |
| CubeCluster-Blue | 0.99 | ~20 s/frame → ~3.3 h |

The two real 4K frames (3840×2160, one-off `remotion still`, start-up cost
subtracted): **1A frame 240 = 10.9 s**, **2A frame 300 = 97 s**. Measured 4K/720p
ratios were 23× (1A) and 16× (2A); the other estimates use 20×. On any machine
with a GPU these drop by one to two orders of magnitude — Crystal Burst is the
heavy one (420 instanced `MeshPhysicalMaterial` shards with iridescence and
three environment lookups for the dispersion).

## Banding check

* Final pass: half-float (RGBA16F) scene/post targets, then ±1/255 blue-noise
  dither (offset by `frame % period`) + 1.5 % grain from an integer hash of
  pixel position and frame. Gradient backdrops add their own blue-noise dither.
* Checked on frames **decoded from the encoded mp4s**
  (`scripts/banding.py`, `scripts/stretch.py`): pixel rows/columns across the
  Serum backdrops, both dune skies, the cube glow and the digit haze. Averaged
  profiles step by ≤ 1.8 levels per pixel with ≤ 2.6 levels residual against a
  smooth fit, and 8× contrast-stretched crops show no contour steps.

## Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps; Look 1 = 300 frames, others 600
- [x] three.js / `@remotion/three` on WebGL2, `--gl=angle`; no PixiJS, no MCP
- [x] JetBrains Mono (OFL, `public/fonts/OFL.txt`) for the digits; no other text
- [x] Generic 7-atom molecule (pentagon + 2 side atoms), no named compound
- [x] Determinism: no `Math.random`, no clocks, no TAA/accumulation;
      cold frame 300 (150 for Look 1) == full-render frame, byte for byte (all 8)
- [x] Loops: frame 600 == frame 0 pixel for pixel on a 601-frame render (all 6);
      the 599→0 step is no larger than normal frame-to-frame change
- [x] Previews: 1280×720, h264, yuv420p, 30/1, no audio, 10.0 s / 20.0 s
- [x] Banding checked on the encoded mp4s
- [x] Render times per composition + two real 4K frames recorded

## Verification scripts

`scripts/render-preview.sh`, `render-all.sh`, `check-loop-det.sh` (ffprobe,
601-frame loop check, cold-frame determinism, contact sheet), `seam.py`,
`compare.py`, `banding.py`, `stretch.py`, `contact.sh`, `crops.py`.
The loop check sets `REMOTION_LOOP_FRAMES=601` (read in `src/Root.tsx`).

