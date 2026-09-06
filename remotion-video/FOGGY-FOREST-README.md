# Foggy Forest at Night — Remotion project

Three versions of a locked, seamlessly looping 30-second shot: bare trees
receding into thick fog, with a pale light glowing from deep in the woods.

| Composition id | Look |
|---|---|
| `V1-FoggyForestTeal` | Teal night fog (reference match) |
| `V2-FoggyForestAmber` | Warm amber dawn through mist |
| `V3-FoggyForestMono` | Neutral monochrome grey, for grading |

All three are defined at **3840×2160, 30 fps, 900 frames (30s)** and loop
seamlessly: every drift, sway, pulse and density cycle completes a whole number
of cycles over the 900 frames, so frame 900 is identical to frame 0.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are authored at 4K, so a full-resolution render is just
`--scale=1`:

```bash
npx remotion render V1-FoggyForestTeal  out/V1_FoggyForestTeal.mp4  --scale=1 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted
npx remotion render V2-FoggyForestAmber out/V2_FoggyForestAmber.mp4 --scale=1 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted
npx remotion render V3-FoggyForestMono  out/V3_FoggyForestMono.mp4  --scale=1 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted
```

The flags past `--scale` matter more than they look:

- `--image-format=png` keeps the frames out of a JPEG round-trip on the way
  into H.264. Remotion's default JPEG intermediates would mush the grain and
  block up the dark gradients — the two things this piece is made of.
- `--color-space=bt709` with `--pixel-format=yuv420p` tags limited range.
  Without it, JPEG frames yield full-range `yuvj420p`, which some players
  read as limited and show with crushed blacks.
- `--muted` drops the silent audio track Remotion adds by default.

Stills:

```bash
npx remotion still V1-FoggyForestTeal out/V1_FoggyForestTeal.png --frame=210 --scale=1
```

1080p previews are the same commands with `--scale=0.5`; `tools/render-all.sh`
renders all three previews and their stills in one go.

> Large soft gradients in a dark frame are the worst case for H.264 banding.
> The scene carries ~2.5% grain specifically to dither them apart — judge
> banding on the **encoded file**, never on the studio preview.

## How it is built

The shot is 2D. There is no camera and no parallax; depth comes entirely from
scale, tone, blur and how much fog sits in front of each tier.

Everything is composited back to front onto a single 2D canvas
(`src/foggy-forest/render.ts`):

1. Sky, lightest around the distant glow and falling off to the frame edges.
2. The distant light — a soft vertical column left of centre, no visible source.
3. Five tree tiers, far to near, each **followed by** the fog plane that sits in
   front of it. That interleaving is the whole illusion: distant trees are
   genuinely inside the fog rather than under a global overlay.
4. Ground band and the mist hugging it.
5. Bloom on the glow only, vignette, grain.

| File | Role |
|---|---|
| `src/foggy-forest/constants.ts` | Frame size, fps, duration, glow placement |
| `src/foggy-forest/palettes.ts` | The three colour schemes |
| `src/foggy-forest/prng.ts` | Seeded PRNG and the looping oscillator |
| `src/foggy-forest/assets.ts` | Loading and rasterising the traced tree |
| `src/foggy-forest/noise.ts` | Seamlessly tiling fog textures, grain tiles |
| `src/foggy-forest/forest.ts` | Depth tiers and seeded tree placement |
| `src/foggy-forest/render.ts` | The per-frame compositing pipeline |
| `src/foggy-forest/FoggyForest.tsx` | The Remotion component |

Nothing uses `Math.random()` at render time and no state is carried between
frames: every placement, scale, flip and sway phase comes from a seeded stream,
so any frame renders identically in isolation.

## The tree

The whole forest is **one tree**, drawn 55 times.

`public/trees/tree.svg` is a vector trace of the supplied silhouette
(`public/trees/tree-source.png`). Tracing rather than drawing the bitmap buys:

- **Real gaps.** Every enclosed space in the silhouette is a hole in the path
  (`fill-rule="evenodd"`), not white paint — so fog and the distant glow show
  *through* the tree instead of being blocked by it.
- **Sharpness at any scale.** The source is 233x462; a near-tier trunk is drawn
  at up to 1.9x the frame height, which is roughly nine times the source. Each
  tier rasterises the vector at the size it actually needs, so those trunks stay
  clean where the bitmap would be a blur.

### How the trace works

`tools/trace-svg.mjs`, in three steps that each matter for a source this small:

1. **Resample up first.** The art is composited onto white and resampled to
   ~2200px tall with smooth interpolation. Tracing at native size would bake the
   pixel staircase into the vector and show it as jagged edges once a trunk is
   drawn nine times larger. This invents no detail — it just lets the contour
   follow a smooth edge rather than a stair.
2. **Follow pixel cracks, not pixel centres.** The outline and every enclosed
   gap come out as separate, consistently wound loops. That is what makes the
   gaps read as holes.
3. **Round the contour, keep the corners.** After Douglas-Peucker simplification,
   vertices turning less than 72° become quadratic control points; sharper ones
   stay hard, so the edges smooth out but the branch tips stay pointed.

The tracer also measures where the trunk actually meets the ground — the
centroid of the ink at the foot of the silhouette — and writes it to the SVG as
`data-trunk-x`. For this tree that is 0.449, not 0.5. Every instance is stood on
that point; using the midpoint instead would lean the whole forest off the
ground line.

### Replacing it

```bash
node tools/trace-svg.mjs public/trees/tree-source.png public/trees/tree.svg
```

Drop any black silhouette in as `tree-source.png` and re-run. A white or a
transparent background both work — the tracer composites onto white first.

### Variation from one asset

Scale, horizontal flip, ±3° rotation, and irregular trunk spacing. The near tier
also varies **how much of the tree** each instance shows, from the base up.

A crop cuts the artwork on a straight line, so it is only ever applied where
that cut falls outside the frame: the near-tier crops trim the top only, and
those trees are tall enough that the cut is always above the frame. Trimming the
sides, or cropping a tier whose trees sit wholly in frame, would show the cut as
an unnatural straight edge across the silhouette.

## Tools

| Command | What it does |
|---|---|
| `node tools/check-neutral.mjs out/V3_FoggyForestMono.png` | Asserts the mono version is genuinely neutral (R=G=B) |
| `node tools/check-loop.mjs out/V1_FoggyForestTeal.mp4` | Asserts the wrap (last frame → first) is no more abrupt than an ordinary frame step |
| `./tools/render-all.sh` | Renders all three 1080p previews and stills |
| `npm run lint` | ESLint + `tsc` |
