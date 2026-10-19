# Paper & Watercolour — hand-drawn backgrounds (Remotion, 30 fps)

Eight 4K motion backgrounds and sixteen 6K stills, all built in code:
watercolour from **p5.brush**, sketchy line work from **Rough.js**, the world map
from **d3-geo** + Natural Earth. Flat 2D artwork only; the camera drifts at most.

| Clip (output file) | Remotion id | Length |
|---|---|---|
| `WatercolourBloom_Pastel.mp4` | `WatercolourBloom-Pastel` | 20 s loop |
| `WatercolourBloom_Sunset.mp4` | `WatercolourBloom-Sunset` | 20 s loop |
| `InkReveal_Indigo.mp4` | `InkReveal-Indigo` | 12 s story |
| `InkReveal_Sepia.mp4` | `InkReveal-Sepia` | 12 s story |
| `SketchyDrift_KidsBright.mp4` | `SketchyDrift-KidsBright` | 20 s loop |
| `SketchyDrift_Muted.mp4` | `SketchyDrift-Muted` | 20 s loop |
| `HatchedMap_Antique.mp4` | `HatchedMap-Antique` | 20 s loop |
| `Chalkboard_Green.mp4` | `Chalkboard-Green` | 20 s loop |

Remotion composition ids may not contain `_`, so ids use `-` and the output
files keep the requested `_` names. All compositions are 3840×2160 @ 30 fps.
Stills are `S1-…` to `S8-…` (6000×3375), two colourways each.

## Setup

```bash
npm ci            # exact versions pinned in package.json / package-lock.json
npm run studio    # preview in Remotion Studio
```

WebGL2 is required (every clip is a WebGL shader). **Use `--gl=angle`** on a
machine with a GPU, which is much faster. `--gl=swangle` (SwiftShader, CPU) also
works on a machine without a GPU and is what the timings below were measured with.

## Render the 4K masters

Each command renders one clip as H.264, yuv420p, CRF 16:

```bash
npx remotion render WatercolourBloom-Pastel  out/WatercolourBloom_Pastel.mp4  --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render WatercolourBloom-Sunset  out/WatercolourBloom_Sunset.mp4  --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render InkReveal-Indigo         out/InkReveal_Indigo.mp4         --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render InkReveal-Sepia          out/InkReveal_Sepia.mp4          --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render SketchyDrift-KidsBright  out/SketchyDrift_KidsBright.mp4  --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render SketchyDrift-Muted       out/SketchyDrift_Muted.mp4       --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render HatchedMap-Antique       out/HatchedMap_Antique.mp4       --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render Chalkboard-Green         out/Chalkboard_Green.mp4         --gl=angle --crf=16 --pixel-format=yuv420p
```

Or render all eight through the same pipeline used for the previews: lossless
PNG frames, then ffmpeg, plus the loop and determinism checks.

```bash
GL=angle node scripts/render-previews.mjs --scale=1 --concurrency=2 --out=renders-4k
```

720p previews, as delivered (`--scale=0.3333333333333333`, which gives 1280×720):

```bash
GL=swangle node scripts/render-previews.mjs          # -> renders/*.mp4 + results.json
python3 scripts/verify.py                            # ffprobe, loops, banding, contact sheets
```

## Render the 6K stills

```bash
# all 16 stills at 6000x3375 (batch)
GL=angle node scripts/render-stills.mjs --scale=1 --out=stills-6k

# or one at a time
npx remotion still S7-WorldMap-Antique out/S7-WorldMap-Antique.png --gl=angle

# 1280x720 review set + StillsSheet.png
GL=swangle node scripts/render-stills.mjs
```

## How it works

**Paint once, animate cheaply.** `scripts/paint-layers.mjs` renders the
`Paint-*` stills, one p5 instance each (instance mode, WEBGL, `noLoop()`,
seeded with `brush.seed()` / `randomSeed()` / `noiseSeed()`). It saves each
watercolour layer once as a grayscale PNG in `public/layers/`: eight bloom
sprites, the edge wash, splatters, corner washes, stripes and the sea wash.
They are painted in neutral pigment, so white means bare paper. The clips
animate these layers with a WebGL2 shader (`src/lib/compositor.ts`):

* reveal masks that spread like wet paint (noise-edged growth from seed
  points or from the frame edges), with pigment collecting at the moving edge;
* wet paint sampled from a blurred mip level, crisping as it dries
  (`textureLod`), plus "hard-line" edge darkening and granulation;
* slow drift and scale, opacity breathing, and a flow distortion sampled on a
  *time circle* so every loop closes exactly;
* colour applied as Beer–Lambert optical density
  (`paper × exp(−density × OD)`), so a colourway is only a tint.

Rough.js line work is cheap, so it is redrawn live every frame into a 2D canvas
(seed `base + floor(frame / 5)`, wrapped to the loop). The shader then composites
it as ink, graphite or chalk, catching on the paper or board tooth.

**Paper** is baked once per mount in a shader pass: cold-press tooth, fibres
and blotches. The final pass adds about 1.5 % grain (a hash of pixel and wrapped
frame) and a ±1/255 triangular blue-noise dither. The blue noise is a 64² tile
made by void-and-cluster from a fixed seed. Scenes are composited in linear
light into **RGBA16F** targets.

**Determinism.** Every value comes from `useCurrentFrame()`. There is no
`Math.random()`, `Date.now()` or `useState` driving visuals. Seeds come from
composition ids (`mulberry32`, FNV-1a). Each frame is redrawn from scratch.
Layers, map data and the baked paper load once behind `delayRender`.

## Add a colourway (one data row)

Colourways live in `src/palettes.ts`. To add one:

* **a new bloom clip:** append a row to `BLOOM_COLOURWAYS`, e.g.
  `{ name: "Ocean", paper: "#F3EBDD", pigments: ["#7FB3D5", "#A3C4BC", "#5D8AA8", "#C5D8E8"] }`.
  `Root.tsx` registers `WatercolourBloom-Ocean` automatically. The same goes for
  `SKETCH_COLOURWAYS` → `SketchyDrift-<name>`.
* **ink, map, board, pencil or stripe colourways:** add the row, then reference
  its name in `Root.tsx` (clips) or `src/stills/Stills.tsx` (stills, in the
  `colourways` list).

No layer needs repainting: paint is neutral and tinted in the shader.

## Repaint the watercolour layers

```bash
GL=swangle npm run paint                 # all layers
GL=swangle npm run paint edge-wash       # one layer
```

## Render times

Measured in a 4-core cloud container with **no GPU** (`--gl=swangle`, i.e.
SwiftShader on the CPU), Remotion 4.0.515, PNG frames then ffmpeg. A
GPU machine with `--gl=angle` will be much faster for the shader work. The
Rough.js / Canvas2D work (sketches, map, chalk) is CPU-bound either way.

**720p previews** (`--scale=1/3`, 4 tabs in parallel):

| Clip | Frames | Wall time | Wall / frame | Per frame in one tab (median) |
|---|---:|---:|---:|---:|
| WatercolourBloom_Pastel | 601 | 510 s | 0.85 s | 3.3 s |
| WatercolourBloom_Sunset | 601 | 560 s | 0.93 s | 3.2 s |
| InkReveal_Indigo | 360 | 75 s | 0.21 s | 0.73 s |
| InkReveal_Sepia | 360 | 76 s | 0.21 s | 0.74 s |
| SketchyDrift_KidsBright | 601 | 259 s | 0.43 s | 1.7 s |
| SketchyDrift_Muted | 601 | 242 s | 0.40 s | 1.6 s |
| HatchedMap_Antique | 601 | 907 s | 1.5 s | 5.8 s |
| Chalkboard_Green | 601 | 1315 s | 2.2 s | 8.7 s |

**One 4K frame** (3840×2160, one tab, steady state after the first frame;
the first frame also bakes the paper and uploads layers, ~13–20 s):

| Clip | 4K frame |
|---|---:|
| WatercolourBloom_Pastel (paint-once layers + shader) | **8.2 s** |
| WatercolourBloom_Pastel, p5.brush repainting live every frame | **71 s** (8.6× slower) |
| InkReveal_Indigo | 1.8 s |
| Chalkboard_Green | 9.5 s |

**4K estimates on the same CPU-only box** (600 frames, one tab, so an
upper bound): Bloom ≈ 80 min per clip, Ink Reveal ≈ 11 min, Chalkboard ≈
95 min. Sketchy Drift ≈ 35 min and Map ≈ 90 min are extrapolated from the
720p ratio, not measured. All eight ≈ 9 h CPU-only. With `--gl=angle` on a
desktop GPU, expect the watercolour clips to be several times faster.

Painting the layers once (`npm run paint`, CPU WebGL) took 35 s per bloom
sprite and 85–240 s per 4K layer, about 25 min in total.

## Licences

| Component | Licence |
|---|---|
| p5.js 2.2.3 | LGPL-2.1 |
| p5.brush 2.2.3 | MIT |
| Rough.js 4.6.6 | MIT |
| d3-geo 3.1.1 | ISC |
| Remotion 4.0.515 | Remotion License (free for individuals and small companies; larger companies need a company licence: https://remotion.dev/license) |
| React | MIT |
| Natural Earth 1:50m land | Public domain (`public/data/`) |
