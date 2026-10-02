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

**Recommended for the grain looks (Galaxy, Map, Nebula):** Remotion's CLI
exposes `--x264-preset` but not x264 *tuning*, and at CRF 16 plain x264 smooths
the 2% grain away in near-black areas. Render them as a PNG sequence and encode
with `-tune grain`, exactly as the previews were made:

```bash
SCALE=1 OUT=out/4k scripts/render-previews.sh "GalaxySpiral|ParticleWorldMap|NebulaCore"
SCALE=1 OUT=out/4k scripts/render-previews.sh "EnergyOrb|CellDivision"   # or the plain commands above
```

For a ProRes master add `--codec=prores --prores-profile=4444` and drop
`--crf/--pixel-format`. The compositions are 3840×2160, so no `--scale` is
needed for 4K. `--scale=0.5` gives 1080p; the canvas honours it (the drawing
buffer really is 1920×1080, so 1080p renders are cheap).

### 1080p previews (what was delivered)

`scripts/render-previews.sh` (defaults `SCALE=0.5`, `OUT=out`) renders each composition as a full PNG sequence at
`--scale=0.5`, then encodes with ffmpeg: H.264, CRF 16, `yuv420p`, 30 fps,
BT.709 tags, no audio (`-tune grain` for the grain looks 1, 3, 5). Rendering the sequence first is what lets the
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

| Look | 1080p s/frame (concurrency 1) | 1080p batch throughput (concurrency 2) | 4K s/frame measured (concurrency 1) | 4K estimate per composition (this box) |
|------|------|------|------|------|
| 1 Galaxy Spiral | 0.73 | 0.48 s (600 f in 290 s) | 2.23 | ~22 min |
| 2 Energy Orb | 0.53 | 0.40 s (600 f in 238 s) | 1.49 | ~15 min |
| 3 Particle World Map | 1.15 | 0.78 s (450 f in 352 s) | 3.46 | ~26 min |
| 4 Cell Division | 1.05–1.20 | 0.99 s (360 f in 360 s) | 4.01 | ~24 min |
| 5 Nebula Core | 1.98 | 1.55–1.62 s (600 f in 930–973 s) | 6.82 | ~68 min |

All 10 at 4K on this CPU-only box: ≈ 5.2 h at concurrency 1 (≈ 3.5–4 h at
concurrency 2). 4K costs ~3–3.5× 1080p here (fill-rate bound; ×4 pixels, some
per-frame overhead is fixed). Each 6000×3375 still took ~10–25 s.

On any real GPU expect these to fall by one to two orders of magnitude; the
bottleneck there becomes PNG capture/encode, not WebGL.

### Counts / resolution reductions

Nothing had to be cut to the bone; what was tuned for speed:

- **Nebula (slowest):** the 12 cloud planes render into an offscreen buffer at
  **0.5× output resolution** (`NEBULA_CLOUD_SCALE`), then composite over the
  full-res background/stars; fbm is 3D simplex (time on a circle in the xy
  domain) rather than 4D. Stars stay full-res so they're crisp.
- **Cell Division:** the raymarch was first tried at 0.5× resolution, but the
  glass rims stair-stepped visibly, so it runs at **full resolution** (it fits:
  ~1.1 s/frame at 1080p). Rays outside the cells' bounding spheres skip the march;
  interior is a fixed 18-step march.
- **Galaxy:** full 150k points + 402 streaks; no reduction needed.
- **World Map:** 4× MSAA on the HDR target (cubes/squares edges); 28k stars.

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

Measured on frames decoded from the **encoded mp4**, not the preview: luminance
along lines crossing glow falloffs and cloud gradients (1A f300, 3A f60, 5A f300,
5B f300). A *band* is a run of one identical code value that (a) spans ≥ 2 codes
of the underlying gradient (65-px running median) and (b) repeats on the
neighbouring lines (a contour). Results: worst contour-coherent run 0.63 codes
(5A), 0.00 elsewhere; grain present everywhere. Full output in
`deliverables/verify-report.txt` (render times: `deliverables/render-times.txt`).

Two things were changed because of this check:
1. The dark background hexes were being crushed to near-black by ACES's toe
   (1A sky at code 1–3, long flat runs). Backgrounds are now passed through an
   inverse of the same ACES curve (`bg()` in `src/lib/color.ts`) so they land on
   the specified colours (1A top now 4,11,32 ≈ #03081C).
2. x264 at CRF 16 was quantising the 2% grain away in near-black dust (5B: luma
   identical over 14 px). Grain looks (1, 3, 5) are encoded with **`-tune grain`**.
   Cost: bigger files (galaxy ≈ 200 MB / 20 s at 1080p).

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

Final run (all 10 previews):

| Step | Result |
|------|--------|
| 1 File checks | **PASS** ×10 — h264, 1920×1080, 30/1, yuv420p, no audio, 20.000 / 15.000 / 12.000 s, exact frame counts |
| 2 Loop | **PASS** ×6 — frame 0 ≡ frame 600 (max diff 0); seam motion = in-loop motion (×1.00–1.01); **unwrapped** frame 600 vs 0: ≤0.18% px differ by float noise (one frame of motion = 1.0–7.6 mean) |
| 3 Black | **PASS** 2A/2B/4A/4B at 3 frames each, decoded from mp4 — corners 0, everything away from the subject 0 (0.000% non-zero) |
| 4 Determinism | **PASS** ×10 — cold `remotion still --frame=150` ≡ frame 150 of the full render (pixel sha256 equal) |
| 5 Banding | **PASS** (see Banding) |
| 6 Content | contact sheets in `deliverables/contact-sheets/` — galaxy turns, orb ribbons change shape, map starfield→cubes→swirl→map (no Antarctica), cells 1→2→4 with pinches, nebula layers parallax; pairs differ only in colour |

## Completion checklist

- [x] 5 looks × 2 colourways = 10 compositions, 3840×2160, 30 fps, all 3D (`@remotion/three`, WebGL2)
- [x] Lengths: looks 1/2/5 600 f loops, look 3 450 f, look 4 360 f
- [x] Built in code, no MCP servers; Natural Earth data shipped with licence; no text except map placeholder numbers
- [x] ACES tonemapping, sRGB output; cores roll off (no flat clipped plateau)
- [x] Dither ±1/255 in every look; ~2% grain (fixed hash) in looks 1, 3, 5; no grain on black in 2, 4
- [x] Deterministic: seeded at module level, pure functions of the frame, no TAA
- [x] One data row per colourway (`src/colourways.ts`)
- [x] Render time per frame measured at 1080p (and 4K) per look; reductions noted
- [x] 2 stills per composition at 6000×3375 (`scripts/render-stills-6k.sh`)
- [x] 10 × 1080p previews (H.264 CRF 16 yuv420p 30 fps) + 1080p PNG still each
- [x] Verify loop steps 1–6 pass
- [x] `npm install && npx remotion studio` works from a clean copy of the zip (checked: install, typecheck, 10 compositions listed, Studio builds and serves)

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
