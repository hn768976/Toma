# Steel Pipes, Glyph Surfaces (Remotion, 30 fps)

Seven 20-second seamless loops (600 frames, 3840×2160) built in code with
three.js on WebGL2 inside one Remotion project.

| Composition id | Look | Engine |
|---|---|---|
| `SteelPipes-Stacked` | 1 — even hex stack of steel pipes | `src/looks/pipes.ts` |
| `SteelPipes-Bundle` | 2A — mixed-size steel bundle | `src/looks/pipes.ts` |
| `CopperPipes-Bundle` | 2B — the 2A scene in copper | `src/looks/pipes.ts` |
| `DataTileFloor-GreenTeal` | 3A — glowing tile floor | `src/looks/glyphs.ts` |
| `DataTileFloor-MagentaBlue` | 3B — 3A in magenta / blue | `src/looks/glyphs.ts` |
| `GlyphWave-Blue` | 4 — undulating character surface | `src/looks/glyphs.ts` |
| `BinaryCubes-CyanViolet` | 5 — rippling binary / padlock cubes | `src/looks/glyphs.ts` |

Every version is one data row in `src/versions.ts`.

## Setup

```bash
npm install
npx remotion studio          # preview
```

Node 18+ is required. `package.json` pins exact versions.

### Chromium GL flag

`remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("angle")`, which is
the same as passing **`--gl=angle`** on the command line. WebGL2 through ANGLE is the reliable
path in headless Chromium. On a machine without a GPU, ANGLE falls back to
SwiftShader (software). It is slow but gives identical results.

## Render commands (4K)

```bash
npx remotion render src/index.ts SteelPipes-Stacked        out/SteelPipes_Stacked.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts SteelPipes-Bundle         out/SteelPipes_Bundle.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts CopperPipes-Bundle        out/CopperPipes_Bundle.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts DataTileFloor-GreenTeal   out/DataTileFloor_GreenTeal.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts DataTileFloor-MagentaBlue out/DataTileFloor_MagentaBlue.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts GlyphWave-Blue            out/GlyphWave_Blue.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts BinaryCubes-CyanViolet    out/BinaryCubes_CyanViolet.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

720p preview: add `--scale=0.3333333333333333`, which gives exactly 1280×720.

### Still (6000×3375)

```bash
npx remotion still src/index.ts SteelPipes-Bundle out/SteelPipes_Bundle_6K.png --frame=300 --scale=1.5625 --gl=angle
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. Every size-dependent effect (DoF
radius, bloom radius, grain) is defined relative to image height, so 6K and 720p
have the same look.

## Measured render times

Measured in a CPU-only cloud container with 4 vCPUs. There is no GPU, so ANGLE
falls back to SwiftShader. Per-frame figures are marginal cost, `(16-frame time −
1-frame cold time) / 15`, with startup excluded. On a real GPU expect these to
drop by one to two orders of magnitude.

| Composition | 720p s/frame (measured) | 4K s/frame | 4K, 600 frames (CPU estimate) |
|---|---|---|---|
| SteelPipes-Stacked | 17.6 | ~104 (est., ×5.9) | ~17 h |
| SteelPipes-Bundle (2A) | 9.3 | **54.7 (measured)** | ~9.1 h |
| CopperPipes-Bundle | 9.3 | ~55 (est.) | ~9.2 h |
| DataTileFloor-GreenTeal (3A) | 1.4 | **4.9 (measured)** | ~49 min |
| DataTileFloor-MagentaBlue | 1.4 | ~4.9 (est.) | ~49 min |
| GlyphWave-Blue | 0.9 | ~3.1 (est., ×3.4) | ~31 min |
| BinaryCubes-CyanViolet | 2.5 | ~10 (est., ×4) | ~1.7 h |

The two 4K frames were timed for real:

- **2A** (140 instanced pipes, PMREM, 4× MSAA, DoF): 1 cold frame took 98.8 s,
  and 4 frames took 262.8 s, so about **54.7 s** per 4K frame.
- **3A** (about 49 k instanced cells with 8 depth patches, DoF and bloom): 1
  cold frame took 12.1 s, and 4 frames took 26.9 s, so about **4.9 s** per 4K
  frame.

The other 4K figures scale the 720p measurement by the measured 4K/720p ratio
for the same engine: ×5.9 for pipes, ×3.4 for glyph quads, ×4 for cubes.
Rendering in parallel (`--concurrency`) divides wall-clock time accordingly.


## How it works

### Determinism

- Everything on screen is a function of `loopFrame = frame mod 600` and nothing
  else (`src/engine/rng.ts`). R3F's `useFrame` is used only as the render hook,
  and its clock is ignored. There is no `Date.now()`, no `Math.random()` and no
  state carried between frames.
- All random layout (pipe packing, cell palettes, glyph schedules, padlocks,
  brushed-noise texture) comes from `mulberry32` with fixed seeds.
- Glyph swaps use holds from {10, 12, 15, 20, 24, 30, 40, 60} frames, all of
  which divide 600. The glyph is `hash(cell, step mod (600/hold))`, evaluated on
  the GPU, with a per-cell phase offset so swaps never line up.
- Waves sample simplex noise around a circle in time (`cos θ, sin θ`).
  Flicker uses whole cycles per loop. The floor moves exactly one patch depth
  (64 × 1.12 units) per loop.
- DoF and bloom are single-frame passes. There is no TAA.
- The font, glyph atlas and environment are built once, before the first frame
  (`delayRender` in `src/engine/Stage.tsx`).
- Grain and dither are fixed hashes of pixel position and `frame % 600`.

### Post pipeline (`src/engine/post.ts`)

1. The scene renders to a 4× MSAA half-float target. Alpha holds view depth.
2. DoF prefilter: downsample to about 540 rows max and compute a signed CoC.
   Each half-res texel takes its CoC from its nearest tap, so bright in-focus
   edges never inherit a background CoC.
3. DoF gather: a fixed 72-sample Vogel disc with scatter-as-gather weighting.
   Background samples are clamped so they cannot bleed over sharper foreground.
   An optional tilted focal plane gives the diagonal band in Glyph Wave.
4. Composite: blend sharp full-res with the blurred buffer by the gathered blur
   amount.
5. Bloom: a fixed 6-level mip chain (box down, tent up), with the base at about
   360 rows at every output size.
6. Final pass: exposure, ACES, grade, vignette, sRGB, then grain (1.5 %) and
   ±1/255 dither.

## Adding a colourway or a metal

- **Glyph colourway:** copy a row in `src/versions.ts`, e.g.
  `FLOOR_MAGENTA_BLUE = { ...floorBase, palette: [...], accent, fog }`.
  Register it in `src/Root.tsx` with a new `<Composition id=... />`.
- **Metal:** copy `BUNDLE_COPPER` and change `metal.color`, `metal.roughness`,
  the `env` tints (`panel`, `top`, `base`) and the grade (`lift` / `gain`).
  The studio environment is rebuilt from those tints.

## Fonts and licences

All glyphs are drawn from **JetBrains Mono Bold** (`public/fonts/`), under the
SIL Open Font License 1.1 (`public/fonts/OFL.txt`). The padlocks are drawn with
Canvas paths. There are no logos, brands, words or real code: every glyph is a
random single character, hex digit or binary digit.

## Verification (run on the delivered code)

| Check | Method | Result |
|---|---|---|
| Loop: frame 600 = frame 0 | `REMOTION_LOOP_CHECK=1` (601-frame comps), stills at 0 and 600, pixel diff | **0 / identical** for all 7 |
| Seam continuity | mean abs diff 599→0 vs 0→1 | equal within noise for all 7 |
| Determinism | cold `remotion still --frame=300` vs frame 300 of a `--concurrency=2` sequence (296–304) | **byte-identical** (max diff 0) for all 7 |
| Banding | 720p still → H.264 CRF 16 yuv420p → decode, pixel runs across a pipe streak, glyph bokeh, cube gradient | no steps (max smoothed step ≤ 1 level in the dark bokeh; no flat runs except clipped highlights); grain left at 1.5 % |
| Output size | `--scale=0.3333333333333333` | exactly 1280×720 |

Two bugs were found by these checks and fixed:

- **Glyph swap flash.** Every hold length divides 600, so originally every cell
  swapped glyph (and dipped) on frame 0. Each cell now gets a hashed phase
  offset inside its hold.
- **Tile streak popping.** Streak runs switched whole cells on and off, and all
  lanes aligned on frames 0 and 300. Runs now have soft edges and fractional
  lane phases.

### Completion checklist

- [x] 7 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] One data row per version (`src/versions.ts`)
- [x] WebGL2 via `@remotion/three` and `--gl=angle`; no WebGPU, no TAA
- [x] Everything deterministic from `useCurrentFrame()`; seeded `mulberry32`
- [x] JetBrains Mono (OFL) only, licence included; no logos, words or real code
- [x] Dither ±1/255 and 1.5 % grain from pixel position and `frame % 600`
- [x] 720p timing for every composition; 4K frames of 2A and 3A timed
- [ ] Full 4K renders: not done here (CPU-only container); commands above


## Deviations from the brief (and why)

The brief's camera numbers and sizes were starting points. These values were
changed to match the reference footage:

- **Stacked:** the stack is 18 × 8 pipes, not 7 × 5, so the oblique reference
  framing fills the frame with no visible stack edge. Wall thickness is 5 % of
  the radius.
- **Bundle:** the camera sits below the bundle, looking up about 25° off the
  axis, with a 26° FOV to reduce the fan-out.
- **Data Tile Floor:** the camera is 13 units up and pitched 40°. At 2.5 units
  up the tiles were far larger than in the reference. The floor uses 8 patches
  (about 49 k cells), and the far edge fades out so it never pops at the loop.
- **Glyph Wave:** the wave amplitude is 3.0, not 1.5, so the fold reads. The
  camera views the sheet from the side, so rows recede to the right as in the
  reference. Glyphs are drawn on an 11-column LCD pixel grid sampled from
  JetBrains Mono, which gives the blocky reference look within the OFL-font
  rule.
- **Binary Cubes:** the colour gradient is in screen space (top cyan → bottom
  magenta, with violet toward the sides). It is not tied to world depth, because
  the steep camera compresses depth.
- **Studio environment:** the studio light panels are computed into a float
  buffer, not an 8-bit canvas, so they can be HDR (panels up to 10×), then
  PMREM-filtered.
