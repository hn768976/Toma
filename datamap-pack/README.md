# Data Map · Plexus Globe · Circuit Warp · Soft Gradient · Wire Peaks

One Remotion project, five looks, seven compositions. All are **3840×2160, 30 fps,
600 frames (20 s), seamless loops**.

| Composition (id) | File name | Look | Engine |
|---|---|---|---|
| `DataMap-Blue` | `DataMap_Blue.mp4` | tilted world map built from 600 data tags, HUD, DoF | three.js (WebGL2) + Canvas 2D glyph atlas |
| `PlexusGlobe-Navy` | `PlexusGlobe_Navy.mp4` | nested wireframe plexus spheres with ▲ number tags | three.js |
| `CircuitWarp-Violet` | `CircuitWarp_Violet.mp4` | forward rush through circuit fragments | three.js |
| `SoftGradient-Lime` | `SoftGradient_Lime.mp4` | blurred OKLab colour blobs | full-screen fragment shader (three.js plane) |
| `SoftGradient-Peach` | `SoftGradient_Peach.mp4` | same, peach / pink / lilac | full-screen fragment shader |
| `WirePeaks-White` | `WirePeaks_White.mp4` | wireframe mountain range with leader lines and numbers | three.js |
| `WirePeaks-Cyan` | `WirePeaks_Cyan.mp4` | same, cyan on navy with glow | three.js |

Remotion forbids `_` in composition ids, so ids use a hyphen and rendered files use an
underscore.

## Setup

```bash
npm install
npx remotion studio
```

Node 18+ is fine (tested with Node 22). All dependency versions are pinned in `package.json`.

## Chromium GL flag

Everything runs on **WebGL2 through ANGLE**. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the same as passing
**`--gl=angle`** on the command line. Keep it for headless renders. WebGPU is not used.

## Render at 4K (per composition)

```bash
npx remotion render src/index.ts DataMap-Blue       out/DataMap_Blue.mp4       --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts PlexusGlobe-Navy   out/PlexusGlobe_Navy.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts CircuitWarp-Violet out/CircuitWarp_Violet.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts SoftGradient-Lime  out/SoftGradient_Lime.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts SoftGradient-Peach out/SoftGradient_Peach.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts WirePeaks-White    out/WirePeaks_White.mp4    --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts WirePeaks-Cyan     out/WirePeaks_Cyan.mp4     --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
```

For a mastering file, ProRes is also possible: `--codec=prores --prores-profile=4444`.

## Stills at 6000×3375

The compositions are 3840×2160; a scale of 1.5625 gives exactly 6000×3375:

```bash
npx remotion still src/index.ts DataMap-Blue out/DataMap_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(Replace the id for any other composition. Line widths and text are defined relative to
the output height, so they stay the same relative size at 6K.)

## 720p previews

```bash
./render-previews.sh            # all seven, or pass ids
```

This renders a lossless PNG sequence at `--scale=0.3333333333333333` (exactly 1280×720)
and encodes it with libx264, CRF 16, yuv420p, 30 fps, no audio. The PNG sequence is kept in
`out/frames/` for the determinism check.

## Add a colourway (one data row)

Every version is one row in `src/versions.ts`. To add one, copy a row, give it a new `id`
(letters, digits and `-`), and change its colours:

```ts
{
  id: "WirePeaks-Amber",
  look: "wirepeaks",
  seed: 1056,
  bg: "#120C04",
  bgTop: "#1A1206",
  mesh: "#FFB84A",
  numbers: "#FFE2B0",
  glow: 0.8,
  meshAlpha: 0.8,
},
```

`Root.tsx` registers a composition for every row automatically. Changing `seed` gives a
different layout (terrain, tag placement, sphere points, fragments).

## How it is built

- **Engine.** `src/lib/gl/Stage.tsx` hosts each look in `@remotion/three`'s `<ThreeCanvas>`
  (WebGL2) and runs its own pipeline in a layout effect keyed on `useCurrentFrame()`. The
  drawing buffer matches the output pixels (Remotion's `--scale` sets `devicePixelRatio`).
- **Lines, dots and sprites** are analytic-AA instanced quads (`src/lib/gl/shaders.ts`).
  Widths are given in pixels at 2160p and scale with the output. **Depth of field** works per
  primitive: each quad grows by its circle of confusion and spreads its energy over the
  wider footprint; text sprites blend a sharp and a pre-blurred glyph atlas.
- **Post chain** (`src/lib/gl/post.ts`): scene → half-float render target → optional bloom
  (13-tap downsample / tent upsample, all half-float) → final pass with the background
  gradient, vignette, ~1% grain and ±1/255 blue-noise dither.
- **Data Map tags** are placed on Natural Earth land with a seeded jittered grid and a
  collision test: 600 tags, about a third ticking (periods 30–150 frames, all dividing 600),
  plus about 20 blinking.
- **Soft Gradient** mixes blobs in **OKLab**, and each blob follows a closed Lissajous path
  with whole cycles per 600 frames. A domain warp samples simplex noise along a circle in
  the noise field.
- **Wire Peaks** is a ridged-noise heightfield (160×80 cells, seeded, not a real place).
  20 leaders sit on local maxima chosen in screen space. Each number changes on its own
  period (60–150 frames, dividing 600), with a 7-frame scramble.

## Determinism

Every value on screen comes from `useCurrentFrame()`:

- seeded `mulberry32` / integer hashes only; no `Math.random()`, `Date.now()`, `useFrame`
  or `useState`-driven visuals; nothing carried between frames;
- grain is a fixed hash of (pixel, loop frame); the dither is a fixed 64×64 blue-noise map,
  generated once by void-and-cluster from a fixed seed and offset per frame;
- all motion is periodic in 600 frames (the pipeline uses `frame % 600`), so frame 600 is
  frame 0;
- fonts, atlases and geometry are built once, behind `delayRender` / `continueRender`;
- no TAA, no accumulation.

`--props='{"loopCheck":true}'` makes any composition 601 frames long for the loop check.

## Assets and licences

- **Fonts** (`public/fonts/`): Inter and JetBrains Mono, both SIL Open Font License 1.1.
  The licence texts are next to the font files (`OFL-Inter.txt`, `OFL-JetBrainsMono.txt`).
- **World map** (`src/data/ne_110m_land.json`): **Made with Natural Earth.** Free vector
  and raster map data @ naturalearthdata.com. Natural Earth 1:110m land (v4.1.0, via the
  `world-atlas` TopoJSON), which is **public domain**. Antarctica is omitted and only outer
  rings are kept. See `data-licenses/NATURAL_EARTH.md`.
- All tags, codes and numbers are made up. No logos or brands.

## Measured render times

Measured in a 4-vCPU cloud container **with no GPU**: Chromium's WebGL2 ran on
ANGLE → SwiftShader, i.e. entirely on the CPU. On a machine with a real GPU these
numbers drop a lot.

**720p (1280×720), per frame**, as (time for 60 frames − time for 1 frame) / 59,
concurrency 1, on an idle machine:

| Composition | s / frame @720p | Full 600-frame preview (concurrency 2, wall clock) |
|---|---|---|
| DataMap-Blue | 0.50 | 241 s |
| PlexusGlobe-Navy | 0.34 | 149 s |
| CircuitWarp-Violet | 0.78 | 379 s |
| SoftGradient-Lime | 0.26 | 148 s |
| SoftGradient-Peach | 0.26 | 146 s |
| WirePeaks-White | 0.54 | 263 s |
| WirePeaks-Cyan | 0.60 | 291 s |

**Two real 4K (3840×2160) frames** (frame 300):

| Composition | Cold single still (includes browser start and the scene/atlas build) | 10-frame render (300–309) | Warm frame ≈ |
|---|---|---|---|
| DataMap-Blue | 9.9 s | 26.6 s | 1.9 s |
| CircuitWarp-Violet | 4.3 s | 22.7 s | 2.0 s |

**4K estimates** for a full 600-frame render on the same CPU-only box at concurrency 1:
DataMap ≈ 19 min, CircuitWarp ≈ 21 min. Scaling the others by the measured
4K/720p ratio (2.6–3.7×) gives: PlexusGlobe ≈ 9–13 min, SoftGradient ≈ 7–10 min
each, WirePeaks ≈ 14–20 min each. That is roughly 1.5–2 h for all seven, before
encoding. Expect several times faster on a GPU machine. Renders are deterministic,
so they can be split with `--frames` across machines.

## Verification (run on the 720p previews)

Scripts are in `verify/`. They need the previews from `./render-previews.sh`.

1. **File check** (`verify/check-files.sh`): all seven are 1280×720, 30/1, h264,
   yuv420p, no audio stream, 20.000 s. **Pass**.
2. **Loop** (`verify/check-loop.sh`): with `loopCheck` (601 frames), frame 600 equals
   frame 0 pixel for pixel. **Pass**, all seven.
3. **Determinism** (`verify/check-determinism.sh`): frame 300 rendered alone from a
   cold start is **byte-for-byte identical** (same PNG file) to frame 300 of the full
   multi-threaded render. **Pass**, all seven.
4. **Banding** (`verify/banding.py`, `verify/banding2.py`): frames are decoded **from
   the encoded mp4s**. On every sampled line (three long lines for each Soft Gradient:
   row 180, row 540 and the full diagonal), an undithered 8-bit ramp at the measured
   slope would sit on one value for **7–40 px**. The encoded frames change value every
   **1–4 px** (median run), with a 31-px mode share of 0.34–0.57, i.e. mixed rather than
   flat bands. Median-filtered steps are 1–3 levels, which is the slope itself and not
   a staircase. A contrast-stretched crop shows grain only, with no contour steps.
   **Pass**.
5. **Contact sheets** (`verify/contact-sheets.sh`, frames 0/120/240/360/480):
   - **Data Map:** continents read from tags alone; ticking values; HUD; DoF.
   - **Plexus:** two nested spheres on the left with ▲ number tags; right ~35% empty.
   - **Circuit Warp:** forward rush with a darker centre, violet-blue.
   - **Soft Gradient:** soft blobs, no edges, no muddy blends.
   - **Wire Peaks:** range with 20 leaders and changing numbers; upper area empty
     apart from the numbers.
   - No logos or brands anywhere. **Pass**.
6. **Motion** (`verify/motion.py`, frames 270–330): mean frame-to-frame change is
   steady:
   - **Warp:** max/median 1.02, no popping.
   - **Plexus:** 1.01.
   - **Gradients:** 1.07 / 1.12; mean luma moves ≤ 1.4 levels over 2 s, so no pulsing.
   - **Wire Peaks:** 1.4–1.6, exactly on the scramble frames when numbers change.
   - Stepping through consecutive 1:1 crops shows no shimmer or crawl on thin lines
     or tags. **Pass**.

## Completion checklist

- [x] 7 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] three.js / WebGL2 via `@remotion/three` for all seven; ANGLE (`--gl=angle`)
- [x] Determinism: no `Math.random`, `Date.now`, `useFrame` or state-driven visuals; seeded generation
- [x] Half-float render targets; ±1/255 dither (blue noise) and ~1% grain on all seven
- [x] OFL fonts only (Inter, JetBrains Mono) with licence texts
- [x] Natural Earth 1:110m land (public domain) with its note; procedural terrain
- [x] One data row per version (`src/versions.ts`)
- [x] 720p previews + 720p stills rendered; checks 1–6 pass
- [x] Render times measured; two 4K frames timed

