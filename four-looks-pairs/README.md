# Four Looks × Two Versions (Remotion, 30 fps, 3840×2160)

Eight compositions in one Remotion project. Everything is built in code: no MCP servers,
no icon libraries, no logos, no stock assets. Fonts are Montserrat and Inter (SIL OFL,
shipped in `public/fonts/` with their licences).

| # | Look | 2D/3D | Compositions | Length |
|---|------|-------|--------------|--------|
| 1 | Grain Gradient Glow | 2D (WebGL2 fragment shader) | `GrainGlow-Violet`, `GrainGlow-Sunset` | 600 f (20 s loop) |
| 2 | Plexus Sphere | 3D (`@remotion/three`) | `PlexusSphere-BlueViolet`, `PlexusSphere-TealWhite` | 450 f (15 s) |
| 3 | Hex Mosaic Transition | 2D (canvas) | `HexMosaic-Blue`, `HexMosaic-Gold` | 240 f (8 s) |
| 4 | Neon Badge | 3D (`@remotion/three`) | `NeonBadge-MadeByHuman`, `NeonBadge-MakePeace` | 600 f (20 s loop) |

## Setup

```bash
npm install          # Node 18+; versions are pinned in package.json / package-lock.json
npx remotion studio  # preview (the studio renders 3D looks at half resolution to stay responsive)
```

**Chromium GL flag:** WebGL2 in headless Chromium needs ANGLE. It is set in
`remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), equivalent to passing
`--gl=angle` on every `render` / `still` command. On a machine without a GPU, ANGLE falls
back to SwiftShader (software); results are identical, just slower.

## Render commands

4K masters (H.264, yuv420p, CRF 16 and lossless PNG intermediates come from `remotion.config.ts`):

```bash
npx remotion render GrainGlow-Violet        out/GrainGlow_Violet_4K.mp4        --gl=angle
npx remotion render GrainGlow-Sunset        out/GrainGlow_Sunset_4K.mp4        --gl=angle
npx remotion render PlexusSphere-BlueViolet out/PlexusSphere_BlueViolet_4K.mp4 --gl=angle
npx remotion render PlexusSphere-TealWhite  out/PlexusSphere_TealWhite_4K.mp4  --gl=angle
npx remotion render HexMosaic-Blue          out/HexMosaic_Blue_4K.mp4          --gl=angle
npx remotion render HexMosaic-Gold          out/HexMosaic_Gold_4K.mp4          --gl=angle
npx remotion render NeonBadge-MadeByHuman   out/NeonBadge_MadeByHuman_4K.mp4   --gl=angle
npx remotion render NeonBadge-MakePeace     out/NeonBadge_MakePeace_4K.mp4     --gl=angle
```

For a mastering codec instead of H.264 add e.g. `--codec=prores --prores-profile=4444`.

1080p previews: add `--scale=0.5` (or run `scripts/render_previews.sh`).

File sizes: CRF 16 keeps per-pixel grain, so the previews are large: GrainGlow ≈ 450 MB
(≈ 180 Mbit/s), NeonBadge ≈ 240 MB, PlexusSphere ≈ 195 MB, HexMosaic ≈ 30 MB per 1080p file.
4K at CRF 16 will be several times bigger; that is the cost of keeping the grain intact.

Stills (6000×3375 = 3840×2160 × 1.5625):

```bash
npx remotion still PlexusSphere-BlueViolet out/plexus_sphere.png --frame=440 --scale=1.5625 --gl=angle
```

`scripts/render_stills_6000.sh` renders the two stills per composition used for delivery.

`--scale` really changes the render resolution (the WebGL drawing buffer and the 2D canvas
follow `devicePixelRatio`), so a 6000 px still is rendered at 6000 px, not upscaled.

## Measured render time

Measured in this project's build machine: 4 vCPU, **no GPU** (Chromium's ANGLE falls back to
SwiftShader software WebGL), one browser tab (`--concurrency=1`), start-up time subtracted.
`scripts/time_looks.sh 0.5 30` (1080p) and `scripts/time_looks.sh 1 8` (4K) reproduce it.

| Look | 1080p (`--scale=0.5`) | 4K measured (`--scale=1`) | 4K full composition (one comp, this machine) |
|------|-----------------------|---------------------------|-----------------------------------------------|
| 1 Grain Glow | 0.57 s / frame | 2.06 s / frame | 600 f ≈ 21 min |
| 2 Plexus Sphere | 1.71 s / frame | 5.13 s / frame | 450 f ≈ 38 min |
| 3 Hex Mosaic | 0.11 s / frame | 0.32 s / frame | 240 f ≈ 1.3 min |
| 4 Neon Badge | 1.79 s / frame | 5.88 s / frame | 600 f ≈ 59 min |

All eight 4K masters on this machine: ≈ 4 h. Wall-clock for the 1080p previews matched the
per-frame cost (e.g. Neon Badge 600 frames in 1,035 s); more tabs did not help because
software WebGL already uses every core. On a machine with a GPU (`--gl=angle` on real
hardware) the 3D looks should be several times faster; that was not measurable here.

If a single 4K/6000 px frame takes longer than Remotion's 30 s default on a slow machine,
add `--timeout=300000` (the 6000 px stills script does).

## How it is built

- **Determinism.** Every value on screen is a function of `useCurrentFrame()` only. All
  randomness comes from `mulberry32` seeded at module level (`src/lib/random.ts`); per-pixel
  noise uses integer hashes (`pcg3d` in GLSL, an integer mixer in JS). No `Math.random()`,
  no `Date.now()`, no `useState` driving visuals, no CSS animation, no R3F clock: the 3D
  looks take over R3F's render with a priority-1 `useFrame` whose callback ignores the clock
  and draws the Remotion frame (`src/lib/gl/GLStage.tsx`). No TAA / temporal effects.
- **Loops** (looks 1 and 4). Time enters as `2π·((frame·k) mod 600)/600` with integer `k`
  (`src/lib/loop.ts`), so frame 600 produces bit-identical inputs to frame 0. Look 1's noise is
  sampled on a circle in time; grain uses `frame % 600`. Look 4's hologram streak pattern is
  3 badge-heights tall and scrolls exactly one pattern repeat per loop; glitch windows sit
  inside one loop. Each looping composition accepts `{"loopCheck": true}` to become 601 frames.
- **Post pipeline (looks 2 and 4, `src/lib/gl/post.ts`).** HDR scene (4× MSAA + depth
  texture) → depth of field (48-tap scatter-as-gather with a per-tile reach map that skips
  pixels with no out-of-focus geometry nearby) → bloom (soft threshold + dual-filter mip chain)
  → composite (background, highlight roll-off, ~2% grain from pixel position + frame,
  ±1/255 triangular dither).
- **Look 1** is one fragment shader: Gaussian blobs on closed Lissajous paths, a soft
  moving dark wedge, deep corners, three tapered light streaks, a 5-stop colour ramp,
  ~7% monochrome grain + dither.
- **Look 2**: 3,000 instanced cubes and ~6,500 links (3–4 nearest neighbours in the final
  sphere, computed once at module level) drawn as screen-space quads in one instanced draw
  call, so lines keep the same visual weight at 1080p, 4K and 6000 px. Each node has a
  column position derived from its sphere position (polar angle → height, azimuth kept),
  so sphere neighbours are already near each other in the column.
- **Look 3**: one canvas, one path per tile, tile timings from distance to centre plus
  seeded angular noise and jitter. Grain is multiplicative and only touches lit pixels,
  so black stays exactly 0,0,0.
- **Look 4**: `TubeGeometry` along the rounded hexagon, face text drawn to a 4096×2617
  canvas texture (after the fonts load, behind `delayRender`), hologram streaks in a shader
  layer, glitch smear / stretched copy / RGB split / brightness dip in the composite.

## Add a version (one data row)

Each look has a `versions.ts`; `src/Root.tsx` maps over it, so a new row is a new composition.

```ts
// src/looks/neon-badge/versions.ts
{
  id: "NeonBadge-StayCurious",
  top: { kind: "text", text: "100%" },      // or { kind: "icon", icon: "dove" }
  line1: "STAY",
  line2: "CURIOUS",
  strip: "ASK MORE",
  ring: "CURIOUS · ",
  neon: "#5FD8FF",
  stripColor: "#E8343C",
  stripText: "#1A0A12",
  background: "#0A1A5A",
},
```

The other looks work the same way: `grain-glow/versions.ts` (5 ramp stops),
`plexus/versions.ts` (node palette, link colour, background), `hex-mosaic/versions.ts`
(tile dark/light, flash colour).

## Banding check

Run on frames decoded **from the encoded 1080p mp4s**, not from the preview:

```bash
ffmpeg -i out/previews/GrainGlow_Violet.mp4 -vf "select=eq(n\,300)" -frames:v 1 f300.png
python3 scripts/banding.py f300.png row 540 0 1920 col 1500 0 1080
```

`scripts/banding.py` (Pillow + numpy) does two tests:

1. **Block test** – every 16×16 block gets a plane fit; a banded gradient leaves blocks that are
   flat runs of one code value (residual sd < 0.3 levels). Result: **0 % flat blocks** in all four
   frames checked (median residual sd: 1A 16.6, 1B 16.0 levels – the intended grain; 2A 5.3,
   4A 5.1 levels – the 2 % grain + dither).
2. **Profile test** – a grain-free profile (17 px box average) through smooth gradient /
   background areas, looking for flat-run | jump | flat-run staircases. Result: **0 band edges**;
   the profiles change by fractions of a level per pixel (e.g. plexus background 20.6 → 25.1 → 21.2,
   max slope 0.36 lvl/px; badge background max slope 0.41 lvl/px).

The detector was validated on a synthetic pair: an 8-bit gradient without dither is flagged by
both tests (100 % flat blocks, 10 band edges); the same gradient with ±1 LSB dither passes.

| Frame (from mp4) | Flat blocks | Band edges | Verdict |
|------------------|-------------|------------|---------|
| GrainGlow_Violet f300 | 0 / 8040 | 0 | smooth |
| GrainGlow_Sunset f300 | 0 / 8040 | 0 | smooth |
| PlexusSphere_BlueViolet f420 | 0 / 8040 | 0 | smooth |
| NeonBadge_MadeByHuman f200 | 0 / 7619 | 0 | smooth |

## Completion checklist

All checks were run on the final code; scripts are in `scripts/`.

- [x] 8 compositions, 3840×2160, 30 fps; lengths 600 / 450 / 240 / 600 frames.
- [x] Fonts shipped (Montserrat, Inter, OFL texts included), loaded behind `delayRender`.
- [x] Icons self-drawn (dove = SVG path data in `icons.ts`); no icon libraries, logos or brands.
- [x] 2D looks: no CSS keyframes/transitions; every value from `useCurrentFrame()`.
- [x] No `Math.random()`, `Date.now()`, R3F clock, `useState`-driven visuals or temporal effects.
- [x] **Step 1** file checks (`scripts/verify_mp4.sh`): all 8 previews 1920×1080, 30/1, h264,
      yuv420p, video only, durations 20.0 / 15.0 / 8.0 / 20.0 s.
- [x] **Step 2** loop check (`scripts/verify_loops.sh`, `{"loopCheck":true}` → 601 frames):
      frame 600 == frame 0 pixel for pixel for GrainGlow ×2 and NeonBadge ×2.
- [x] **Step 3** black check from the mp4: HexMosaic frames 0 and 230 are 0,0,0 everywhere
      (max 0); the four corners at frame 50 are 0,0,0.
- [x] **Step 4** determinism (`scripts/verify_determinism.sh`): the full composition rendered as
      a PNG sequence (two tabs, frames out of order) vs. the self-check frame rendered alone in a
      fresh process (frame 300; 120 for look 3): **byte-identical for all 8** (file SHA-256 equal).
- [x] **Step 5** banding: see above, no banding in 1A, 1B, 2A, 4A.
- [x] **Step 6** five evenly spaced frames per preview (`out/verify/sheets/`): blobs move,
      streaks + grain present; strand → column → sphere with links and edge strays; hex spreads,
      fills, clears from the centre, ends black, white flashes at both fronts; badge text readable,
      red strip + ring text present, camera swings, frame 299 shows the glitch smear, dove in 4B,
      `100%` in 4A; each pair differs only in the listed colours / texts.
- [x] 1080p PNG still per composition; two 6000×3375 PNG stills per composition.
- [x] `npm install && npx remotion studio` works from a clean copy of the zip.

## Project layout

```
remotion.config.ts         GL flag, codec, CRF, pixel format
src/Root.tsx               8 compositions from the version rows
src/lib/                   seeded RNG, loop phase, fonts, GL stage, post pipeline
src/looks/grain-glow/      look 1
src/looks/plexus/          look 2
src/looks/hex-mosaic/      look 3
src/looks/neon-badge/      look 4 (icons.ts holds the self-drawn dove path)
public/fonts/              Montserrat 700/800, Inter 500/600 (woff2) + OFL licences
scripts/                   render + verification scripts (bash + python3/Pillow/numpy)
```
