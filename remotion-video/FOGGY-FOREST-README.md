# Foggy Forest at Night — Remotion project

Three versions of a locked, seamlessly looping 30-second shot: bare trees
receding into thick fog, with a pale light glowing from deep in the woods.

| Composition id | Look |
|---|---|
| `V1-FoggyForestTeal` | Teal night fog (reference match) |
| `V2-FoggyForestAmber` | Warm amber dawn, with the sun low in the mist |
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
2. The distant light. It is painted into a low-resolution buffer and blurred
   before it reaches the frame, rather than composited as a gradient: a
   gradient, however many stops it has, still resolves to a shape with a
   findable edge, and blurring dissolves that edge so the light reads as
   diffusing through the fog rather than lying on top of it. V1 and V3 have no
   visible source; V2 has a sun disc, still soft-edged because a sun seen
   through this much fog has no hard limb.
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

The whole forest is **one tree**, drawn around 40 times per frame.

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

### Composition

The reference is a stand of **tall slender trunks running the full height of
frame**, branches only near the top, receding into fog. Two things get there
from a single stocky silhouette:

- **Vertical stretch.** Each instance is drawn taller than its natural aspect
  (roughly 2.6-4.4x, further back is more), which turns a stump into a forest
  trunk. Height is unchanged; only width is divided.
- **Height and base by depth.** Near trees are 2-3x the frame height with their
  bases low, so only trunk is in shot and the crown is far above it. Distant
  tiers are shorter with bases nearer the horizon, so their crowns come down
  into the top of frame and form the canopy.

### Spacing

Trees are placed left to right, and the step to the next trunk is a multiple of
the two **trunks'** widths — not their crowns'. The tracer measures trunk width
from the artwork (`data-trunk-w`) on a band above the root flare. Crowns
interlace overhead in a real stand; trunks are what keep their distance. Spacing
by a bare fraction of the frame, as this did before, puts a small tree and a
large one the same distance apart, so the large pair grow through each other
while the small pair sit in a void.

Each tier is generated far wider than the frame, then slid so a clearing frames
the light. Only gaps that already fall near the light are candidates — taking
the widest gap anywhere in a run several frame widths long meant sliding
everything by more than a frame, which emptied most of the shot.

### Matching the reference's tone

Palette and falloff were set by measuring the reference frame rather than by
eye — `mean luminance and a luma histogram over the whole frame, plus point
samples`. Three things came out of that and would not have come out of
guessing: the fog carries far more light than it looks like it does (mid-field
41,61,62 against the 3,7,8 we had); it is greyer than it looks, running about
0.67 red-to-green where ours was 0.55; and the vignette is **elliptical**,
scaled to the frame, so it blacks the corners and top while leaving a luminous
band across the middle. A circular vignette either crushes the sides or leaves
the top bright.

### Variation from one asset

Scale, horizontal flip, ±3° rotation, and the irregular spacing above. The near
tier also varies **how much of the tree** each instance shows, from the base up.

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
