# Christmas Bokeh

A seamless 4K Christmas bokeh loop, built in Remotion. Out-of-focus discs in
red, gold and cream with sparse green drift behind six-pointed snowflakes,
with twinkling sparks filling the gaps between them.

| | |
| --- | --- |
| Composition id | `ChristmasBokeh` |
| Resolution | 3840 × 2160 (4K UHD) |
| Duration | 240 frames — 8.0 seconds |
| Frame rate | 30 fps |
| Loops | Yes — frame 240 is pixel-identical to frame 0 |
| Audio | None |

## Render

4K, the delivery render:

```console
npx remotion render ChristmasBokeh out/christmas-bokeh.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

1080p preview, roughly four times faster:

```console
npx remotion render ChristmasBokeh out/christmas-bokeh-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--concurrency` cannot exceed the number of CPU cores on the rendering
machine; drop it to your core count if the render refuses to start.

Interactive preview:

```console
npm i
npm run dev
```

## What is in the frame

**Bokeh field** — roughly 90 discs from 30px to 260px across, filling the
frame at uneven density: seeded clusters weighted toward the edges keep the
middle of the frame open enough to hold copy. Each disc carries a radial
gradient that is brighter at about 80% of its radius than at its centre,
which is the rim a real out-of-focus point light has and the detail that
separates bokeh from soft circles. Larger discs are more blurred and more
transparent; smaller ones are sharper and brighter. Most composite with
`lighter`, so overlaps pool into brighter regions.

The colour weighting is red ~35%, gold ~25%, cream ~20%, white ~14%,
green ~6%. The sparse green is deliberate: red and gold with the occasional
green reads as Christmas, whereas an even red/green split reads as a clash.

**Snowflakes** — roughly 55 glyphs from 18px to 140px, each six primary arms
at 60° carrying two or three pairs of side branches at about 45°, around a
small hexagon or six-point star. Proportions vary between flakes but every
flake is exactly six-fold symmetric within itself. Larger flakes are nearer,
so they fall faster and are noticeably blurred; small distant ones are sharp.
Each turns slowly on its own axis, some clockwise and some counter, and wraps
to a new horizontal position above the top of the frame when it falls out of
the bottom.

**Sparks** — roughly 120 tiny points scattered among the discs, twinkling on
seeded sines, with a handful flashing brighter for a few frames.

**Finish** — additive bloom on the brightest bokeh and sparks, a ~20%
vignette, and fine grain at 4% alpha.

## How it is put together

```
src/christmas-bokeh/
  ChristmasBokeh.tsx   composition root, stacks the four layers
  BokehField.tsx       the disc field
  SnowLayer.tsx        the snowfall
  Snowflake.tsx        one flake
  SparkLayer.tsx       the twinkles
  GrainVignette.tsx    the finishing pass
  theme.ts             THEME — every colour in the piece
  config.ts            counts, size ranges, blur ranges, speeds, periods
  bokeh.ts             disc generation and sprite baking
  snow.ts              glyph construction, sprite baking, fall maths
  sparks.ts            spark generation and twinkle maths
  bloom.ts             the additive bloom pass
  ambient.ts           whole-composition drift
  rand.ts              seeded random helpers
  useLoopFrame.ts      current frame folded into [0, 240)
```

Everything is drawn to `<canvas>` through a ref, once per React render.
There is no `requestAnimationFrame`, no `Date.now()`, no CSS animation and
no component state: every value is a pure function of `useCurrentFrame()`
and Remotion's seeded `random()`, so `npx remotion render` is deterministic
even though it renders frames out of order across workers.

Colour lives only in `theme.ts`, keyed by the composition's `variant` prop.
Counts, size ranges, blur ranges, fall speed and every motion period live
only in `config.ts`.

### Why it loops

Every periodic quantity completes a whole number of cycles in 240 frames:
disc drift paths and brightness breathing, spark twinkle periods, flake
rotation, and each flake's fall, which is set to a whole number of
traversals so a flake is back at its start — and on the same wrap cycle —
at frame 240. The frame index is folded into `[0, 240)` before any of that
maths runs, because `sin(φ + 2πk)` and `sin(φ)` are not bit-identical in
floating point and the difference shows up as 1/255 antialiasing wobble.

Verified by temporarily registering the composition at 241 frames, rendering
stills at frame 0 and frame 240, and comparing them — they hash identically.

### Why it renders fast

Re-stroking six arms and eighteen branches per flake per frame at 4K, or
rebuilding 90 gradients and running 90 blur passes, is what makes a piece
like this slow. Instead every disc and every flake shape is baked once into
its own offscreen canvas — gradient, blur and glow included — inside a
`useMemo`. Flakes snap to a size bracket so a shape is stroked once per
shape-and-bracket pair and the 55 flakes share that smaller set. A frame is
then blits and transforms only. Bloom is computed in a quarter-resolution
buffer and scaled back up rather than blurring 3840 × 2160 directly.

## Other compositions in this project

`BluetoothExplainer`, `ParticleRingHalo` and `ParticleRingHalo4K` also live
here; run `npm run dev` to browse them.

## Remotion

[Fundamentals](https://www.remotion.dev/docs/the-fundamentals) ·
[Discord](https://discord.gg/6VzzNDwUwV) ·
[Issues](https://github.com/remotion-dev/remotion/issues/new). Note that for
some entities a company licence is needed;
[read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
