# US Map · Cardboard Boxes · Particle Rain · AI Eye (Remotion, 30 fps, 4K)

Four looks, six compositions, one Remotion project. Everything is built in code: no
stock footage, no logos, no MCP servers.

| Composition id | Look | Engine | Length | Notes |
|---|---|---|---|---|
| `USMap-WhiteAssemble` | US Map Assemble, white | three.js via `@remotion/three` | 450 frames (15 s story) | states drop in NW→SE, long hold |
| `USMap-GraphiteAssemble` | US Map Assemble, graphite | three.js via `@remotion/three` | 450 frames (15 s story) | dark map, cool rim light, blue edges |
| `CardboardBoxes-Kraft` | Cardboard Boxes | three.js `InstancedMesh` + PCF soft shadows + SSAO + DoF + bloom | 600 frames (20 s loop) | |
| `ParticleRainStage-Teal` | Particle Rain Stage, teal | PixiJS 8 (WebGL2) | 600 frames (20 s loop) | 55,000 rain streaks + ~17,200 sparkles and glints |
| `ParticleRainStage-Gold` | Particle Rain Stage, gold | PixiJS 8 (WebGL2) | 600 frames (20 s loop) | |
| `AIEye-Blue` | AI Eye | full-screen fragment shader (`@remotion/three`) + Canvas-2D text texture | 600 frames (20 s loop) | |

All compositions are defined at **3840×2160, 30 fps**. One data row per version lives in
`src/versions.ts`.

## Quick start

```bash
npm install
npx remotion studio
```

`npm install && npx remotion studio` was tested from a clean copy of this folder.

## Rendering at 4K

The renderer needs WebGL2. Remotion launches Chromium with **`--gl=angle`**; this is set in
`remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`). On a machine with a GPU,
ANGLE uses it. On a GPU-less machine ANGLE falls back to SwiftShader, which works but is
slow. You can also pass `--gl=angle` on the command line.

```bash
npx remotion render src/index.ts USMap-WhiteAssemble     out/USMap_WhiteAssemble.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts USMap-GraphiteAssemble  out/USMap_GraphiteAssemble.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts CardboardBoxes-Kraft    out/CardboardBoxes_Kraft.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts ParticleRainStage-Teal  out/ParticleRainStage_Teal.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts ParticleRainStage-Gold  out/ParticleRainStage_Gold.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts AIEye-Blue              out/AIEye_Blue.mp4              --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

720p previews: add `--scale=0.3333333333333333` (this gives exactly 1280×720).

If the heavy scenes time out on slow GL, lower `--concurrency`. The delay-render timeout is
already raised to 300 s in `remotion.config.ts`.

### 6K stills (6000×3375)

`6000 / 3840 = 1.5625`:

```bash
npx remotion still src/index.ts USMap-WhiteAssemble out/USMap_White_6K.png --frame=420 --scale=1.5625 --gl=angle
npx remotion still src/index.ts CardboardBoxes-Kraft out/Boxes_6K.png       --frame=300 --scale=1.5625 --gl=angle
# same pattern for the other ids
```

## Measured render times

Measured in this build environment: a 4-core cloud container with **no GPU**, so WebGL ran
on SwiftShader (CPU). A GPU machine will be much faster, especially for the boxes and the
4K frames.

Method: 60-frame PNG sequences at 720p (`--scale=0.3333333333333333`, `--concurrency=1`).
Per-frame time is (T(60 frames) − T(1 frame)) / 59, which removes browser start-up, bundle
load and shader compilation.

| Composition | 720p per frame (measured) | 4K per frame (estimate, same machine) | 4K full render (estimate, 1 tab) |
|---|---|---|---|
| `USMap-WhiteAssemble` | **1.91 s** | ~12 s | ~90 min |
| `USMap-GraphiteAssemble` | **1.92 s** | ~12 s | ~90 min |
| `CardboardBoxes-Kraft` | **3.86 s** | **~25 s (measured)** | ~4.2 h |
| `ParticleRainStage-Teal` | **0.58 s** | **~1.6 s (measured)** | ~16 min |
| `ParticleRainStage-Gold` | **0.59 s** | ~1.6 s | ~16 min |
| `AIEye-Blue` | **0.28 s** | ~1.5 s | ~15 min |

The two real 4K frames (frame 300, `--scale=1`) were each run twice:

- **Cardboard Boxes:** 35.6 s and 43.9 s per `remotion still` call. Subtracting the ~10 s
  fixed start-up measured with a 720p still gives **~25 s for the 4K frame**. That frame
  covers 13,500 instanced boxes (900 per tile × 15 tiles), an 8192-texel PCF soft shadow
  map, MSAA ×4, SSAO, DoF and bloom.
- **Particle Rain (teal):** 5.8 s and 5.9 s per call. Subtracting ~4.3 s start-up gives
  **~1.6 s for the 4K frame** with ~72,000 sprites. The particle update runs on the CPU and
  doesn't grow with resolution.

The 4K estimates for the other compositions scale the 720p figures by the measured ratio:
×6.5 for the GPU-fill-bound three.js scenes and ×2.8 for Pixi. On a desktop GPU every
composition should render well under 1 s per frame at 4K. Run several tabs at once
(`--concurrency`) to divide the wall-clock times above.

## Determinism

Remotion renders frames out of order across several tabs, so every pixel is a pure
function of `useCurrentFrame()`:

- All randomness comes from `mulberry32`, seeded at module level: state drop order, box
  layout and settling, decals, rain bands, particle phases, word columns and noise tiles.
  There is no `Math.random()` in the project.
- There is no `Date.now()`, no `useState` driving visuals, and no values carried between
  frames.
- `@remotion/three`: R3F's `useFrame` is used only as the "draw now" callback (priority 1,
  so the hand-written pipeline owns the render). Its clock and delta are never read.
- There is no TAA. SSAO uses a fixed 16-sample kernel with a fixed 4×4 rotation pattern.
  DoF uses a fixed 32-tap golden-angle gather. Bloom is a fixed blur. All are single-frame
  passes.
- Grain and dither in the three.js looks come from an integer PCG hash of
  (pixel, `frame % period`). The Pixi look uses a seeded 128×128 noise tile offset by
  `frame % 600`.
- Map data, fonts, texture atlases and the eye's text texture are built once. Fonts are
  awaited with `delayRender`/`continueRender`, and PixiJS init is held with
  `delayRender`.
- Loops are periodic by construction (whole cycles; the camera travels exactly one 40-unit
  tile). Motion additionally uses `frame % 600`, so frame 600 is bit-identical to frame 0.

Self-check: frame 300 rendered alone from a cold start is byte-identical to frame 300 from
a 4-tab sequence render, for all six compositions. See the checklist below.

### Verification props

These are not needed for normal renders:

- `--props='{"loopCheck":true}'` gives the loop compositions 601 frames, so frame 600 can be
  rendered and compared with frame 0.
- `--props='{"loopCheck":true,"noWrap":true}'` also disables the `% 600` fold for motion. This
  proves the motion itself is periodic, not just wrapped.

## Banding

- The three.js looks (map, boxes, eye) render into half-float targets. The final pass adds
  ±1/255 triangular dither, plus grain of about 1.5% from a fixed hash.
- The rain's background gradient, light shafts and pool glow are computed in float in one
  shader, with ±1/255 dither from the seeded noise tile. A final full-frame filter adds
  about 2% grain plus another ±1/255 dither, with the tile offset by `frame % 600`.

Checked on PNG stills **and** after an H.264 round-trip (libx264, CRF 16, yuv420p). Pixel
values were read along lines through each gradient. Rows and columns were averaged over a
20–40 px band, then smoothed over 15 px to remove grain.

| Area | Range (8-bit) | Max step after smoothing, PNG / H.264 | Longest flat run on a 1-px line, PNG / H.264 |
|---|---|---|---|
| Rain background (top→pool) | 16 → 33 | 0.24 / 0.26 per px | 3 / 5 px |
| Rain pool glow (row through pool) | 24 → 68 | (sparkle particles dominate) | 3 / 11 px |
| Rain fall-off below the pool | 51 → 7 | 3.4 per px (steep but smooth) | 2 / 6 px |
| White map sweep (row / column) | 247 → 251 | 0.09 / 0.09 per px | 7 / 11 px |
| Graphite background (row / column) | 21 → 24 | 0.09 / 0.09 per px | 6 / 21 px |

No staircase steps appear in any profile. Flat runs stay short because the grain and dither
break up the 8-bit levels, even after H.264. The boxes frame is filled edge to edge with
boxes and has no open haze gradient that could band, so there was nothing there to read. If
a 4K H.264 export still bands on a particular display, raise the grain constant in the final
pass (`grainDither(..., 0.015)`; up to 0.03).

## Completion checklist

| Check | Result |
|---|---|
| Stills: 1280×720 PNG from `--scale=0.3333333333333333` | ✅ exactly 1280×720 |
| Loop: frame 600 = frame 0, pixel for pixel (601-frame `loopCheck`) | ✅ identical for boxes, rain teal, rain gold, eye |
| Loop without the `%600` fold (`noWrap`) | ✅ rain: identical. Eye: max diff 1/255 on 0.06% of px (float). Boxes: max 12/255, mean 0.02, 2% of px (shadow-texel rounding) |
| Determinism: frame 300 cold vs frame 300 from a 4-tab sequence render | ✅ byte-identical PNG for all 6 |
| Banding (PNG + H.264 CRF 16 round-trip) | ✅ smooth, see table above |
| Contact sheets (5 frames each) | ✅ maps: empty → NW→SE drop → full map with seams, Great Lakes gaps, soft shadow → long hold; 1B dark with blue edges. Boxes: kraft sea, tape, labels, pictograms, forward motion, soft near boxes. Rain: bands, pool, twinkles, dark corners, gold. Eye: scrolling columns warped around the eye, moving pupil |
| Motion (60-frame 720p sequences, step-through + frame-difference stats) | ✅ no flicker spikes (frame-to-frame difference within ±20% of its mean), no popping or shadow flicker, no text crawl |
| No logos, brands, carrier names or real data | ✅ invented barcodes and numbers, generic pictograms, OFL fonts |
| `npm install && npx remotion studio` from a clean copy | ✅ |

## Adding a colourway

Add a row to the matching array in `src/versions.ts` with a new `id` and palette. `Root.tsx`
registers a composition for every row automatically. For example, a "Crimson" rain:

```ts
{
  id: "ParticleRainStage-Crimson",
  palette: {
    rainA: "#D84A5A", rainB: "#FFC0C8", poolCore: "#FF9AA8", poolGlow: "#B02A40",
    sparkleA: "#FFFFFF", sparkleB: "#FFD0D8", bgTop: "#12020A", bgMid: "#3A0A1A",
  },
},
```

The palette fields for each look are typed in that look's pipeline file:

- `MapPalette` in `src/usmap/mapPipeline.ts`
- `BoxesPalette` in `src/boxes/boxesPipeline.ts`
- `RainPalette` in `src/rain/rainPipeline.ts`
- `EyePalette` in `src/eye/eyePipeline.ts`

## Project layout

```
src/
  Root.tsx, index.ts, versions.ts   compositions + one data row per version
  lib/                              seeded RNG, fonts, GLSL (hash/grain/dither), post passes, ThreeStage bridge, loop helpers
  usmap/                            us-atlas → d3-geo → Clipper inset → extrusion + chamfer; drop-in story; contact shadow
  boxes/                            seeded settled layout, kraft/decal canvas textures, instanced boxes, SSAO/DoF/bloom
  rain/                             PixiJS stage: float background shader, ParticleContainers, grain filter
  eye/                              Canvas-2D column texture + lens-warp/eye fragment shader
public/fonts/                       Inter + JetBrains Mono (OFL) with licence texts
```

## Where the build differs from the brief, and why

These changes came from the model checks and the side-by-side reference comparisons.

- **US Map bevel:** three.js `ExtrudeGeometry` bevels self-intersect on detailed coastlines
  and broke cap triangulation (Texas lost its top). The bevel is now a robust chamfer: a
  Clipper inset of each state, triangulated as a ring. Its size is 0.06% of map width,
  not 0.5%; at 0.5% the bevels read as a double outline on every border.
- **US Map seams:** the inset is 0.06% per side (the brief says 0.08%). Each state also
  carries a dark seam plate just under its top, clipped to the country interior. Seams read
  as single dark lines like the reference, and coastlines get no outline.
- **US Map islands:** specks smaller than 0.0025 units² are dropped (Channel Islands, Keys
  fragments, Isle Royale). The model check flagged them as wall-only hairlines.
- **US Map shadow:** a blurred height-from-below contact shadow (two radii) instead of a
  `PCFSoftShadowMap`. It is softer and fully stable, and it sharpens as states land.
- **Boxes camera:** 1.25 units above the pile top (the brief says 1.6), pitched 25° down
  (the brief says ~15°), with a 37° FOV. At 15° the frame was 20–30% sky, while the
  reference fills the frame with boxes.
- **Boxes settle:** 600 base boxes sit side by side on a jittered grid. The other 300 each
  try 16 seeded spots and settle into the lowest gap on a heightfield. Boxes landing high
  get flatter, which keeps 2–3 layers. Linear fog is fully opaque before the last tile row,
  so nothing pops in at the loop point.
- **Rain shafts and pool glow:** these are drawn in one float background shader, not as
  gradient sprites, which removes 8-bit sprite banding. A faint seeded "mist" grain scrolls
  down inside the shafts (24 whole tiles per loop). This matches the dense, misty look of
  the reference with the brief's 55,000 streaks. 380 larger star glints are scattered in
  front of the pool, as in the reference.
- **Rain top of frame:** the reference's rain is bright right up to the top edge, so the top
  centre is lit by the shafts. Only the top corners fall into blue-black.
- **AI Eye shape:** the eye is 32% of frame width × **25%** of frame height (the brief says
  14%). The reference eye is about 2:1, and at 14% it read as a squint in every comparison.
- **AI Eye warp:** a push-out displacement inside a diamond-shaped contour (0.8 × eye width
  to the side, beyond the frame vertically). Columns bend into the reference's
  chevron/diamond and outer columns stay straight. Data dots run along rays from the iris,
  as in the reference.
- **AI Eye columns:** kept at **18** as briefed. The reference has about 10 wider columns;
  see the report for this open difference.

## Licences and data

- **Map data:** [`us-atlas`](https://github.com/topojson/us-atlas) 3.0.1, ISC licence
  (© Michael Bostock). It is derived from the U.S. Census Bureau's cartographic boundary
  files, which are public domain (works of the U.S. federal government). Projected with
  `d3-geo` `geoAlbersUsa` (ISC). Lower 48 states plus DC only. Simplified with
  `topojson-simplify` (ISC); inset and boolean operations by `clipper-lib` (Boost Software
  Licence).
- **Fonts:** Inter and JetBrains Mono, both under the SIL Open Font License 1.1. The licence
  texts are in `public/fonts/`.
- **Box labels:** the barcodes (random bar widths), numbers and filler lines are invented.
  The handling marks (this way up, keep dry, fragile) are generic pictograms drawn in code.
  There are no brands, carriers or real data.
