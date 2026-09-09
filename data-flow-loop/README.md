# Data Flow Loop — 4K abstract background

A seamless 20-second 3840×2160 loop: a deep-space field of filament strands
bundled into fibre-optic waists, scrolling glyph rows, and a shallow-focus lens.
Built with Remotion + three.js. Three colourways, identical in every respect but
palette.

Everything is driven by `useCurrentFrame()`. There is no `Date.now()` and no
`Math.random()` in the render path — the whole field is generated once from a
seeded mulberry32 PRNG, so any frame renders identically on any machine, in any
order, on every run.

---

## Quick start

```bash
npm install
npm run dev          # Remotion Studio
```

## Compositions

| id | size | frames |
|---|---|---|
| `v1-cyan-copper` | 3840×2160 | 600 |
| `v2-teal-magenta` | 3840×2160 | 600 |
| `v3-violet-gold` | 3840×2160 | 600 |
| `v1-cyan-copper-1080` / `v2-…-1080` / `v3-…-1080` | 1920×1080 | 600 |
| `loop-check` | 3840×2160 | 601 |

All are 30 fps. The `-1080` variants exist only to preview cheaply: every size
in the scene (line widths, glyph sizes, DOF blur radii, chromatic aberration) is
authored in master pixels and scaled by `height / 2160`, so a native 1080p
render is pixel-equivalent to the 4K master downscaled — and about four times
faster. `loop-check` is the same scene one frame longer, so frame 600 can be
rendered and diffed against frame 0.

---

## Exact 4K render commands

Run these locally. H.264 in an MP4 container, yuv420p, CRF 16.

```bash
npx remotion render v1-cyan-copper  out/v1-cyan-copper-4k.mp4
npx remotion render v2-teal-magenta out/v2-teal-magenta-4k.mp4
npx remotion render v3-violet-gold  out/v3-violet-gold-4k.mp4
```

or `npm run render:4k:all`.

Codec, pixel format, CRF and concurrency come from `remotion.config.ts`, so the
bare commands above are complete. To be fully explicit:

```bash
npx remotion render v1-cyan-copper out/v1-cyan-copper-4k.mp4 \
  --codec=h264 --pixel-format=yuv420p --crf=16 --gl=swangle --concurrency=4
```

4K stills at frame 150 (the stock-image grabs):

```bash
npx remotion still v1-cyan-copper  out/v1-cyan-copper-frame150.png  --frame=150 --image-format=png
npx remotion still v2-teal-magenta out/v2-teal-magenta-frame150.png --frame=150 --image-format=png
npx remotion still v3-violet-gold  out/v3-violet-gold-frame150.png  --frame=150 --image-format=png
```

or `npm run still:4k:all`.

### Rendering notes

- **Software GL.** `remotion.config.ts` sets `swangle` (SwiftShader via ANGLE),
  which is what works headlessly on a machine with no GPU. On a desktop with a
  real GPU, `--gl=angle` is considerably faster.
- **Concurrency** is set to 4. Each worker holds its own WebGL context and a set
  of 4K render targets — budget roughly 400 MB of RAM per worker at 3840×2160.
- **Custom Chrome.** Set `REMOTION_BROWSER=/path/to/chrome` to use an existing
  Chromium instead of letting Remotion download its own headless shell.

## Verifying the loop

```bash
npm run verify:loop
```

Renders frame 0 and frame 600 of `loop-check` and diffs them pixel by pixel.
It currently reports a **max channel difference of 0/255** — the frames are
byte-identical, film grain included.

That holds because every animated quantity closes on the loop:

- the camera trucks along −X by exactly `TILE_WIDTH`, and the field is a tile of
  that width repeated three times, so the view at frame 600 is the view at 0;
- the dolly, Y bob and roll are all `sin`/`cos` of `2π · frame/600 · integer`;
- strand undulation is `sin(2π(k·t + φ))` with integer `k`;
- glyph rows scroll an integer number of tile widths and wrap on the tile;
- glyph brightness pulses use integer cycle counts;
- the grain hash is seeded with `frame mod 600`.

---

## How it is put together

```
src/
  config.ts              SceneConfig type + the three palette presets
  lib/prng.ts            mulberry32 + periodic/interpolation helpers
  lib/field.ts           the whole field: chains, pinch nodes, strands, glyph rows
  gl/renderer.ts         scene construction and the per-frame render pipeline
  gl/passes.ts           fullscreen-quad pass runner, gaussian blur, thresholding
  gl/shaders.ts          glyph vertex/fragment shaders and the final grade
  scene/DataFlowScene.tsx  binds useCurrentFrame() to the renderer
  Root.tsx               composition registry
tools/verify-loop.mjs    frame 0 vs frame 600 diff
```

Everything is props-driven from a single `SceneConfig` object (`src/config.ts`):
palette (cool array, warm array, hot accents, background), strand count, node
count, camera speed and framing, bloom strength, grain, exposure. The three
registered colourways are the same base config with different palettes.

### Filament strands

900 individual curves, each a `CatmullRomCurve3` through 11 control points
sampled to 56 segments, tubed as `LineSegments2` / `LineMaterial` at 0.65–1.4 px
line width, additive, `depthWrite: false`, opacity 0.12–0.45.

Strands are merged per (depth bucket, width bin) into ~20 `LineSegments2`
batches rather than 900 separate objects, with per-strand opacity baked into the
vertex colours. Undulation happens in the vertex shader from static per-segment
attributes — the geometry is uploaded once and never touched again.

**Bundling.** Eight pinch nodes are distributed along three smooth,
tile-periodic chains at different heights and depths. A strand that belongs to a
bundle orbits its chain's axis at a radius that the nodes' gaussian falloff
squeezes from a wide fan down to a tight waist and back — the hourglass
silhouette. About 38% of strands stay free and read as the ambient field.

A note on what did *not* work, in case it comes up again: pulling every strand
toward the node *position* (rather than compressing its offset from the axis)
empties the space around each node and leaves a dark vertical void with a spike
in the middle. Compressing the radius is what produces a bundle.

~82% of strands take the cool palette, ~18% the warm accent, and the warm ones
are allocated to the strands deepest inside the bundles so the waists flare.

### Data rows

17 rows of glyphs spread across Z. Six shapes — filled dot, short dash, small
square, hollow square, ring, thin bar — drawn from a single instanced quad with
the shape resolved in the fragment shader, sized 2–16 master pixels. Gaps within
a row are heavy-tailed and renormalised so each row is exactly one tile long.
Rows scroll along X at a rate set by their depth, and roughly 1 glyph in 25 is a
hot pixel in white, teal or amber.

Glyphs that would land under a pixel are grown to a one-pixel footprint and
dimmed by the same factor, so their energy — and therefore the look — survives
at any render size. Strand line widths use the same trick.

### Depth of field

Five depth buckets, assigned by distance from the focus plane, each rendered to
its own layer and gaussian-blurred at 0 / 3 / 8 / 18 / 34 px (master pixels,
scaled to the render height), then composited most-defocused first and sharpest
last. Because the buckets key on distance from focus, that ordering is
back-to-front for everything but the shallow near band; every layer is additive
with no depth writes, so the order is presentational rather than load-bearing.
Each blurred layer is downsampled by successive halvings before blurring, which
is what makes this affordable at 4K.

### Grade

Additive bloom off the bright glyphs (threshold 0.62, strength 1.2, three
octaves for a wide radius), radial chromatic aberration of ~0.6 px, a soft
highlight rolloff so the bundle cores glow instead of clipping, heavy vignette,
2% film grain and a final dither so the background gradient does not band at 4K.
The background — near-black navy with a soft radial glow left of centre — is
generated analytically in the final shader.

## Tuning

Almost everything worth changing is in `src/config.ts`. The two least obvious
knobs:

- `strandGain` / `glyphGain` — additive trims. 900 overlapping additive strands
  will clip to white without them; they are what keeps the cores coloured.
- `camera.focusZ` with `DOF_BANDS` — moves the focus plane and sets how quickly
  focus falls off either side of it.

`cameraTravel` must stay equal to `TILE_WIDTH` or the loop stops being seamless.
