# Cosmic Energy Pairs — Remotion + three.js (WebGL2)

Five 3D looks, two colourways each → **10 compositions**, all defined at
**3840×2160, 30 fps**. Everything is built in code (three.js via
`@remotion/three`, WebGL2, custom GLSL); no MCP servers, no external assets
except the Natural Earth land polygons in `public/data/`.

| # | Look | Compositions | Frames | Notes |
|---|------|--------------|--------|-------|
| 1 | Particle Galaxy Spiral | `GalaxySpiral-Blue`, `GalaxySpiral-Gold` | 600 (20 s loop) | 150k points, 402 streak ribbons, DoF bokeh |
| 2 | Plasma Energy Orb | `EnergyOrb-Blue`, `EnergyOrb-Magenta` | 600 (20 s loop) | 18 noise-deformed ribbon strips, inner grid sphere, pure black |
| 3 | Particles to World Map | `ParticleWorldMap-Blue`, `ParticleWorldMap-Gold` | 450 (15 s) | 28k stars, 280 cubes, ~3.5k map squares, network |
| 4 | Glowing Cell Division | `CellDivision-Cyan`, `CellDivision-Emerald` | 360 (12 s) | raymarched SDF smooth-union, pure black |
| 5 | Nebula Core | `NebulaCore-Violet`, `NebulaCore-Teal` | 600 (20 s loop) | 12 domain-warped fbm planes, 9k stars |

## Setup

```bash
npm install
npx remotion studio          # preview (Studio draws a 1080p buffer)
```

Node 18+ (tested on Node 22). Versions are pinned in `package.json`
(`remotion`/`@remotion/cli`/`@remotion/three` 4.0.515, `three` 0.180.0,
`@react-three/fiber` 9.3.0, React 19.2.3).

### Chromium GL flag

Always render with **`--gl=angle`** (WebGL2 through ANGLE; it is also set in
`remotion.config.ts` via `Config.setChromiumOpenGlRenderer("angle")`). On a GPU
machine ANGLE uses the GPU; on a headless server without one Chromium falls
back to SwiftShader (software) — same pixels, much slower. WebGPU is not used.

`remotion.config.ts` also sets PNG intermediates (`setVideoImageFormat("png")`
— JPEG intermediates block up dark gradients and lift black), H.264, CRF 16,
`yuv420p`, BT.709.

## 4K render commands

```bash
npx remotion render GalaxySpiral-Blue        out/GalaxySpiral_Blue.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709
npx remotion render GalaxySpiral-Gold        out/GalaxySpiral_Gold.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709
npx remotion render EnergyOrb-Blue           out/EnergyOrb_Blue.mp4           --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709
npx remotion render EnergyOrb-Magenta        out/EnergyOrb_Magenta.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709
npx remotion render ParticleWorldMap-Blue    out/ParticleWorldMap_Blue.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709
npx remotion render ParticleWorldMap-Gold    out/ParticleWorldMap_Gold.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709
npx remotion render CellDivision-Cyan        out/CellDivision_Cyan.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709
npx remotion render CellDivision-Emerald     out/CellDivision_Emerald.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709
npx remotion render NebulaCore-Violet        out/NebulaCore_Violet.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709
npx remotion render NebulaCore-Teal          out/NebulaCore_Teal.mp4          --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709
```

(For a ProRes master add `--codec=prores --prores-profile=4444` and drop
`--crf/--pixel-format`.) The compositions are 3840×2160, so no `--scale` is
needed for 4K. `--scale=0.5` gives 1080p; the canvas honours it (the drawing
buffer really is 1920×1080, so 1080p renders are cheap).

### 1080p previews (what was delivered)

`scripts/render-previews.sh` renders each composition as a full PNG sequence at
`--scale=0.5`, then encodes with ffmpeg: H.264, CRF 16, `yuv420p`, 30 fps,
BT.709 tags, no audio. Rendering the sequence first is what lets the
determinism check compare frame 150 of the *full render* against a cold single
frame byte-for-byte.

## Stills (6000×3375)

The compositions are 3840 wide, so 6000×3375 is `--scale=1.5625`:

```bash
npx remotion still GalaxySpiral-Blue out/stills-6k/GalaxySpiral_Blue_f0120.png --frame=120 --scale=1.5625 --gl=angle --image-format=png
```

`scripts/render-stills-6k.sh` renders **2 per composition** (frames far apart;
look 3: mid-swirl 245 and finished map 420; look 4: mid-split 120 and four cells
330). Every pixel size (points, ribbons, grid lines, bloom radius, grain) is
scaled by the drawing-buffer height, so stills match the video at any scale.

## Measured render time per frame

Measured in this container: **no GPU — SwiftShader software WebGL2 via ANGLE**,
4 vCPU. `scripts/time-frames.sh <id> <startFrame> [scale]` renders 5 then 35
frames and reports the marginal per-frame time (excludes browser start-up).

RENDER_TIMES_TABLE

On any real GPU expect these to fall by one to two orders of magnitude; the
bottleneck there becomes PNG capture/encode, not WebGL.

### Counts / resolution reductions

COUNTS_NOTES

## Determinism

Remotion renders frames out of order across tabs. Every value on screen is a
function of `useCurrentFrame()` only:

- All randomness is `mulberry32` seeded at module level or in one-time builders
  (never `Math.random()`), and every particle/streak/ribbon/cube position is a
  closed-form formula of its seed and the frame, evaluated in the vertex shader.
- No simulation stepping, no `Date.now()`, no `useState` driving visuals. R3F's
  `useFrame` is used only as the render hook (priority 1); its clock/delta is
  never read. The frame is latched in a layout effect before `<ThreeCanvas>`
  advances.
- The world map's star travel distance is a cumulative table of the speed curve
  computed once at module load — still a pure function of the frame number.
- No TAA or temporal effects; every render target is fully overwritten per frame.
- Map data is loaded behind `delayRender` / `continueRender`.
- Grain and dither are integer hashes (PCG3D) of pixel position and frame.

## Loops (looks 1, 2, 5)

The animation frame is wrapped `frame mod 600`, and the motion is designed to be
periodic so that the wrap is seamless:

- **Galaxy** — the whole particle/streak set has exact 3-fold rotational
  symmetry (one arm generated, instanced at 0°, 120°, 240°), so whole numbers of
  *third*-turns map it onto itself: bulge 2 × 120°, disk 1 × 120° per loop
  (6°/s, close to the reference's calm spin).
- **Orb** — ribbon deformation is 4D simplex noise at
  `(p.xy, p.z + r·cos 2πt, r·sin 2πt)`; ribbons slide ±1 whole turn along their
  paths; the orb makes 1 turn, the inner mesh 2.
- **Nebula** — noise domains travel closed circles (two octave groups in
  opposite directions); the camera follows a closed Lissajous path (1:2
  frequencies); twinkles use whole-number cycles.

Composition prop `loopCheck: true` makes a loop 601 frames; `noWrap: true`
disables the wrap so frame 600 is computed from the raw motion formulas (used by
the verify script to prove the periodicity is real, not just the wrap).

## Banding

- Everything renders into a half-float HDR target; bloom is a 7-level
  13-tap-down / tent-up chain with a fixed level count (identical look at every
  resolution).
- Tonemapping: ACES (Stephen Hill RRT+ODT fit) → sRGB. Bright cores roll off.
- **TPDF dither ±1/255** after tonemapping, in every look.
- **Grain ~2%** (monochrome, PCG hash of pixel & frame) in looks 1, 3, 5.
- Looks 2 and 4: no grain; dither is masked to where there's signal, plus a tiny
  linear black floor so faint bloom tails never lift black off 0,0,0.

BANDING_RESULTS

## Add a colourway (one data row)

All colours live in `src/colourways.ts`, one row per version. Append a row and a
composition appears automatically (`Root.tsx` maps over the arrays):

```ts
export const GALAXY: GalaxyColours[] = [
  { name: "Blue", ... },
  { name: "Gold", ... },
  { name: "Emerald", particleA: "#8FFFC0", particleB: "#F0FFF6", streak: "#30D890",
    core: "#F0FFF6", bgBottom: "#04261A", bgTop: "#010A06", haze: "#2FA870" }, // → GalaxySpiral-Emerald
];
```

Add the matching line to `scripts/comps.txt` if you want the preview/verify
scripts to include it.

## Verify loop

`python3 scripts/verify.py all` (needs `numpy`, `pillow`, ffmpeg):

1. **probe** — 1920×1080, 30/1, h264, yuv420p, no audio, exact duration & frame count.
2. **loop** — frame 0 vs frame 600 of the 601-frame variant (pixel-identical), seam
   motion vs in-loop motion, and the unwrapped frame-600 check.
3. **black** — corners + outer margins of 2A/2B/4A/4B decoded from the mp4 (≤1).
4. **determinism** — cold `remotion still --frame=150` vs frame 150 of the full render.
5. **banding** — raw pixel lines across glow falloffs/cloud gradients decoded from the
   mp4 of 1A, 3A, 5A, 5B: longest run of identical code values + smoothed profile.
6. **sheets** — five evenly spaced frames per preview → `out/contact-sheets/`.

VERIFY_RESULTS

## Completion checklist

CHECKLIST

## Layout

```
src/
  Root.tsx                 registers 10 compositions from the colour rows
  colourways.ts            ONE DATA ROW PER VERSION
  compositions/*.tsx       thin wrappers (load data, overlay labels)
  looks/*.ts               the five looks (three.js scenes + GLSL)
  lib/pipeline.ts          HDR → bloom → ACES → dither/grain
  lib/Stage.tsx            ThreeCanvas + frame-driven render hook
  lib/landGrid.ts          Natural Earth polygons → grid cells
  lib/random.ts, glsl.ts   seeded PRNG, noise/hash GLSL
public/data/               ne_110m_land.geojson + NATURAL_EARTH_LICENSE.md
scripts/                   render-previews.sh, render-stills-6k.sh, time-frames.sh, verify.py
```

## Licence / credits

Map data: **Made with Natural Earth** (public domain) — see
`public/data/NATURAL_EARTH_LICENSE.md`. Simplex noise GLSL after Ashima Arts /
Stefan Gustavson (MIT).
