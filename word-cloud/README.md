# Business Word Cloud Flythrough

Business keywords floating at many depths, drifting toward the camera. Two
versions off one build:

| Composition ID       | Look                       |
| -------------------- | -------------------------- |
| `V1-WordCloudDark`   | White on black (reference) |
| `V2-WordCloudLight`  | Dark on white (light mode) |

Both are defined at **3840x2160, 30fps, 300 frames (10s)** and loop seamlessly.

## Setup

```bash
npm install
npx remotion studio
```

## Render at 4K

```bash
npx remotion render V1-WordCloudDark out/V1_WordCloudDark.mp4 --scale=1 --crf=16
npx remotion render V2-WordCloudLight out/V2_WordCloudLight.mp4 --scale=1 --crf=16
```

Stills (any frame):

```bash
npx remotion still V1-WordCloudDark out/V1_WordCloudDark.png --frame=150 --scale=1
npx remotion still V2-WordCloudLight out/V2_WordCloudLight.png --frame=150 --scale=1
```

For a 1080p preview pass `--scale=0.5` instead. Every size in the project is
written as a fraction of the composition width, including the depth-of-field
blur radii, so a 0.5 preview is a true preview of the 4K render.

Codec is H.264 / `yuv420p` (set in `remotion.config.ts`); intermediate frames
are PNG, because the black field carries very low-amplitude grain that a JPEG
intermediate would smear.

## How it works

- **`src/words.ts`** - the vocabulary, in one exported constant. Swap it and
  the piece re-themes to another niche; nothing else references business
  language.
- **`src/field.ts`** - the field is generated once at module level from a
  seeded PRNG (never `Math.random()` at render time: Remotion renders frames
  out of order across threads). Depth is stratified so words arrive at a
  steady rate; x/y come from a shuffled, jittered 12x7 grid spread well beyond
  the frame, so words enter from the sides and the corners stay populated.
  Words are dealt round-robin from a reshuffled deck, so two instances of the
  same word are always at least a full deck apart in depth.
  This file also holds every per-frame curve - depth, opacity, weight, blur,
  glow, font size - each a pure function of the loop phase.
- **`src/WordCloud.tsx`** - projects the field and draws it. Words are real
  DOM text; nothing is rasterised.
- **`src/themes.ts`** - the two palettes, plus glow / grain / vignette flags.

### Projection

Words are projected by hand rather than by handing `translateZ` to a CSS
`perspective` container. The geometry is identical - camera at the origin,
focal length 1, scale = 1 / z - but a CSS 3D scale rasterises a glyph once and
stretches the texture, and at 4K the nearest words are magnified around 6x and
would arrive visibly soft. Projecting by hand lets us set an **absolute px
font-size per frame**, so every word is laid out and rasterised by the text
engine at its final size. Crisp type is the product.

### Loop

The camera advances exactly one layer-spacing cycle (`Z_CYCLE`) over the 300
frames, linearly - no easing - and the field recycles on the same period, so
frame 300 is frame 0 to floating-point precision. The lateral float is one sine
cycle per loop and the grain seed steps through 5 tiles (300 % 5 === 0).

Opacity is a pure function of depth. At the far plane words sit at ~15% in the
dimmest colour of the ramp, so a word recycling to the back is invisible
against the background; at the near plane the ramp takes them to zero over the
last sliver of depth, by which point they are several frame-widths wide. That
is what lets the field cycle forever without a visible pop.

### Type

Inter is self-hosted as a variable woff2 (`public/fonts`) and registered
through `delayRender`, so no frame is captured before it is ready - a
substituted grotesque would change the metrics and rebalance the layout. The
variable weight axis is what lets weight glide with depth (heavier as words
come forward) instead of stepping between static cuts.
