# Brain X-Ray · Satellite Network · Aurora · Star Disc · Diatoms

Five looks, **eight 20-second seamless loops** (600 frames, 30 fps, 3840×2160), one Remotion
project. Everything is built in code; no text, logos or brands.

| # | Composition id | Output file | Look | Engine |
|---|----------------|-------------|------|--------|
| 1 | `BrainXRay-Gold` | `BrainXRay_Gold.mp4` | 2D side-view X-ray head, gold signals | PixiJS 8 / WebGL2 |
| 2 | `BrainXRay-Cyan` | `BrainXRay_Cyan.mp4` | same, white-cyan signals | PixiJS 8 / WebGL2 |
| 3 | `SatelliteNetwork-Blue` | `SatelliteNetwork_Blue.mp4` | 3D night Earth, satellite shells, links (wide) | three.js / `@remotion/three` |
| 4 | `SatelliteNetwork-Close` | `SatelliteNetwork_Close.mp4` | 3D close follow of one satellite, DoF | three.js / `@remotion/three` |
| 5 | `Aurora-Green` | `Aurora_Green.mp4` | 2D aurora curtains over a treeline | PixiJS 8 / WebGL2 |
| 6 | `Aurora-VioletGreen` | `Aurora_VioletGreen.mp4` | same, violet-pink tops | PixiJS 8 / WebGL2 |
| 7 | `StarDisc-Orange` | `StarDisc_Orange.mp4` | 200k-particle ringed disc, projected in a vertex shader | PixiJS 8 / WebGL2 |
| 8 | `Diatoms-BrightField` | `Diatoms_BrightField.mp4` | bright-field microscope, 600 objects, 3 focus layers | PixiJS 8 / WebGL2 |

Remotion composition ids cannot contain `_`, so ids use `-`; the rendered files use `_`.

## Setup

```bash
npm install
npx remotion studio          # preview (studio renders at half resolution for speed)
```

Pinned: remotion / @remotion/cli / @remotion/three 4.0.515, pixi.js 8.22.0, three 0.186.1,
@react-three/fiber 9.8.2, react 19.2.3.

**Chromium GL flag:** WebGL2 through ANGLE — `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, equivalent to `--gl=angle` on the CLI. Not WebGPU.
On a machine with a GPU, ANGLE uses it; on a headless box without one it falls back to
SwiftShader (software), which is what the timings below were measured on.

## Render commands

4K (3840×2160, H.264, yuv420p, CRF 16 — codec/pixel format/CRF are also set in `remotion.config.ts`):

```bash
npx remotion render BrainXRay-Gold        out/BrainXRay_Gold.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render BrainXRay-Cyan        out/BrainXRay_Cyan.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render SatelliteNetwork-Blue out/SatelliteNetwork_Blue.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render SatelliteNetwork-Close out/SatelliteNetwork_Close.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render Aurora-Green          out/Aurora_Green.mp4          --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render Aurora-VioletGreen    out/Aurora_VioletGreen.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render StarDisc-Orange       out/StarDisc_Orange.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render Diatoms-BrightField   out/Diatoms_BrightField.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

6K still (6000×3375 = scale 1.5625), any composition and frame:

```bash
npx remotion still StarDisc-Orange out/StarDisc_Orange_6k.png --frame=300 --scale=1.5625 --gl=angle
```

720p previews (what was rendered here): `scripts/render-all.sh` renders each composition with
`--scale=0.3333333333333333` (exactly 1280×720) as a PNG sequence, encodes H.264 yuv420p CRF 16
30 fps with ffmpeg, then runs `scripts/verify.py` (all checks below).

All shaders scale with the output: Pixi and three.js set their backing resolution from
`window.devicePixelRatio`, which Remotion sets to `--scale`, so a 720p preview really renders at
720p and a 6K still renders at 6K (not a scaled screenshot).

## How a colourway is added (one data row)

Every version is one row in `src/rows.ts`. Copy a row, change `id` and the params:

```ts
{
  id: "BrainXRay-Magenta",
  look: "brain",
  params: { signal: "#FF5AC8", core: "#FFFFFF", burst: "#FF3A9A" },
},
```

The composition appears in the studio automatically. Params per look: brain
`{signal, core, burst}`; aurora `{green, edge, top, topMix, brightness}`; star disc
`{core, glow, dust, particles}`; diatoms `{field, objects}`; satellites
`{shot: "wide"|"close", tint, rim, link, satellites}`.

## Determinism and loops

* Every visible value is a function of `useCurrentFrame()` only. All random layouts use
  `mulberry32` seeded at module level and are generated once; no `Math.random()`, no
  `Date.now()`, no ticker / R3F clock, no TAA or accumulation, no state carried between frames.
* PixiJS: `autoStart: false`, ticker stopped; the stage is rendered once per Remotion frame in
  a layout effect (`src/lib/pixi/PixiCanvas.tsx`). three.js: a priority-1 `useFrame` callback
  that ignores R3F's clock and reads the Remotion frame, plus a layout-effect render.
* Assets (GLBs, Black Marble, baked sprite atlases, anatomy masks) are loaded/baked once behind
  `delayRender` / `continueRender`.
* Loops: every periodic motion uses whole cycles of `θ = 2π·frame/600` (orbits 1–2 per loop,
  disc bands 1–4 turns, spark/burst/twinkle periods that divide 600 — 60, 75, 100, 120, 150,
  200, 300, 600). Noise loops by sampling tileable noise textures around circles in θ.
  Grain is a hash of pixel position and `frame % 600`.
* Loop check: `--props='{"loopCheck":true}'` makes a composition 601 frames (via
  `calculateMetadata`); frames 0 and 600 must be identical.

## Banding

Pixi looks render into **rgba16float** targets; the satellite look uses **HalfFloatType** render
targets (MSAA ×4). A final pass adds a **±1/255 triangular dither**, **grain ≈1.5 %** from a fixed
hash of (pixel, frame % 600), faded to zero below ~3 % luminance on the dark looks
(brain, satellites, aurora, star disc), and a fixed **64×64 void-and-cluster blue-noise** dither
on the aurora and microscope looks. Noise fields come from float32 textures.

Checked on frames **decoded from the encoded mp4** (frame at 10 s): per region, the
row-averaged luminance profile (largest step between neighbouring columns) and the longest run
of identical 8-bit values. Smooth gradients show sub-level steps; long flat runs occur only in
near-black areas (values 0–3) where the grain is deliberately faded, and 12–14× contrast
stretches of those areas show dither noise / codec macroblocking but no contour bands.

| Composition | Region | Mean | Range | Max profile step | Longest flat run |
|---|---|---|---|---|---|
| BrainXRay_Gold | navy left / right | 4.5 / 5.0 | 1–12 | 0.26 / 0.25 | 15 px |
| BrainXRay_Cyan | navy left / right | 4.5 / 5.0 | 1–12 | 0.28 / 0.32 | 20 px |
| SatelliteNetwork_Blue | space glow / night globe | 40.2 / 27.2 | 11–203 | object edges | 7 px |
| SatelliteNetwork_Close | sky / globe glow | 11.7 / 14.2 | 2–30 | 0.57 / 0.48 | 14 px |
| Aurora_Green | dark sky / lower sky | 3.5 / 3.1 | 0–61 | 0.53 / 0.54 | 44 px (near black) |
| Aurora_VioletGreen | dark sky / lower sky | 3.5 / 3.1 | 0–62 | 0.59 / 0.51 | 50 px (near black) |
| StarDisc_Orange | black / halo | 2.0 / 27.5 | 0–113 | 1.19 / 1.95 | 61 px (near black) |
| Diatoms_BrightField | pale field ×2 | 207 | 59–251 | objects | 6 px |

Full numbers per composition: `out/verify/<Name>/verify.json` (regenerated by `scripts/render-all.sh`).

## Satellite model

TDRS (C) from **NASA 3D Resources** (`github.com/nasa/NASA-3D-Resources`), cleaned and reduced to
40,985 triangles (hero) plus a 9,647-triangle instanced LOD. Licence: the repository states the
assets are *free and without copyright* (README copied to `public/models/`); NASA's media
guidelines forbid using the insignia — the texture atlas was inspected and contains **no meatball,
logotype, flag or mission text**, so nothing had to be removed (details:
`public/models/SATELLITE-MODEL-LICENSE.md`). Materials are colour-graded to the blue palette.
Build step: `scripts/clean-satellite.mjs`.

**Credit line: Satellite model: NASA 3D Resources.**

Night lights: **NASA Earth Observatory Black Marble 2012** (public domain), 4096×2048
(`public/textures/BLACK-MARBLE-CREDIT.md`).

## Measured render times

Measured on the build box: 4 vCPU, **no GPU** — Chromium/ANGLE fell back to SwiftShader
(software WebGL2). Expect large speed-ups on a real GPU. 720p = `--scale=1/3`, PNG sequence,
default concurrency; seconds per frame = wall time / 600.

| Composition | 720p s/frame (measured) | 720p, 600 frames | 4K cold single still (measured) | 4K s/frame | 4K 600 frames (estimate, this box) |
|---|---|---|---|---|---|
| BrainXRay-Gold | 0.17 | 1.7 min | 5.7 s | ~2.5 (est.) | ~25 min |
| BrainXRay-Cyan | 0.17 | 1.7 min | — | ~2.5 (est.) | ~25 min |
| **SatelliteNetwork-Blue** | 6.45 | 65 min | **33.2 s** | **34.7 (measured)** | **~5.8 h** |
| SatelliteNetwork-Close | 2.88 | 29 min | 17.9 s | ~15 (est.) | ~2.5 h |
| Aurora-Green | 0.83 | 8.3 min | 9.7 s | ~6.5 (est.) | ~65 min |
| Aurora-VioletGreen | 0.82 | 8.2 min | — | ~6.5 (est.) | ~65 min |
| **StarDisc-Orange** | 4.53 | 45 min | **8.9 s** | **6.6 (measured)** | **~66 min** |
| Diatoms-BrightField | 0.21 | 2.1 min | 5.7 s | ~2.5 (est.) | ~25 min |

The two timed real 4K frames (requirement): **SatelliteNetwork-Blue** — a cold `remotion still`
at 4K took 33.2 s; a 3-frame 4K render took 102.5 s, i.e. **≈34.7 s per additional frame**.
**StarDisc-Orange** — cold 4K still 8.9 s; 3-frame render 22.2 s, **≈6.6 s per additional
frame** (the 200k-particle disc is vertex-bound, so 4K costs only ~1.5× the 720p frame). The
other 4K figures are estimates: cold 4K still minus ~3 s page start-up. On a desktop GPU expect
roughly an order of magnitude less.

## Completion checklist

All eight compositions, final renders (`scripts/verify.py`):

| Composition | Step 1 file checks | Step 2 loop (frame 0 vs 600, cold) | Step 3 frame 300 cold vs full render | Step 6 frame-diff max/median |
|---|---|---|---|---|
| BrainXRay_Gold | 1280×720, 30/1, h264, yuv420p, no audio, 20.0 s | pass (identical) | byte-identical | 1.01 |
| BrainXRay_Cyan | same | pass | byte-identical | 1.01 |
| SatelliteNetwork_Blue | same | pass | byte-identical | 1.17 |
| SatelliteNetwork_Close | same | pass | byte-identical | 1.16 |
| Aurora_Green | same | pass | byte-identical | 1.07 |
| Aurora_VioletGreen | same | pass | byte-identical | 1.07 |
| StarDisc_Orange | same | pass | byte-identical | 1.01 |
| Diatoms_BrightField | same | pass | byte-identical | 1.01 |

- [x] 8 compositions, 3840×2160, 30 fps, 600 frames, seamless loops; one data row each
- [x] PixiJS 8 / WebGL2 (brain, aurora, star disc, diatoms); three.js via `@remotion/three` (satellites); `--gl=angle`
- [x] Deterministic: no `Math.random`, `Date.now`, ticker or R3F clock; seeded mulberry32 at module level
- [x] Half-float targets, ±1/255 dither, 1.5 % grain from (pixel, frame % 600) faded below ~3 % luminance on dark looks, blue-noise on aurora + microscope
- [x] Star disc: 200,000 particles projected in a vertex shader; bands turn 1–4 whole turns per loop
- [x] Satellite model: NASA 3D Resources TDRS (C), 40,985 tris hero + 9,647-tri instanced LOD; no insignia present; credit line in README
- [x] Black Marble night lights (public domain), credit included
- [x] Anatomy check (3 rounds), aurora realism (3 rounds), diatoms realism (3 rounds), reference comparisons by fresh sub-agents (3 rounds per look)
- [x] 720p previews + 720p stills; 4K render and 6K still commands above
- [x] Banding checked on the encoded mp4

**Deliberate deviations (documented):** composition ids use `-` (Remotion forbids `_`);
SatelliteNetwork-Blue uses **96** instanced satellites and **24** signal icons (the brief says
about 60 / about 10) because with Earth-centred whole-orbit shells only ~17 of 60 are in the
reference's crop at a time — both are one value in the data row (`satellites`) / `scene.ts`;
Aurora-Green carries a faint pink-violet tint at its highest tops (`topMix 0.6`), as the
reference's fold tip does; Black Marble is the 4096×2048 version (NASA hosts were unreachable
from the build box).

## Layout

```
src/Root.tsx, src/rows.ts           compositions from data rows
src/lib/pixi/                       PixiJS harness, post pass (dither/grain/blue noise), instancing
src/lib/{rand,noisetex,bluenoise,spline}.ts
src/looks/brain/                    anatomy paths, mask bake, X-ray shader, sparks
src/looks/satellites/               three.js scene (Earth, shells, links, icons, post)
src/looks/aurora/                   ribbon curtains, treeline, stars
src/looks/stardisc/                 200k-particle disc, star/flare shader
src/looks/diatoms/                  sprite atlas bake, layout, multiply compositing
scripts/                            render-all.sh, render-preview.sh, verify.py, still.sh,
                                    clean-satellite.mjs, orbit-search.mjs
```
