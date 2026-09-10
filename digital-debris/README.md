# Digital Debris Field

Two seamless-looping abstract backgrounds: a dark volume full of scattered line
fragments, dashes, coloured bars and circuit-like traces at many faked depths,
with heavy depth of field and a slow lateral drift.

They are texture, not subject — built to sit under titles and lower thirds, so
nothing in frame draws the eye to a particular point.

| Composition                | Register              |
| -------------------------- | --------------------- |
| `V1-DigitalDebrisTeal`     | Teal / cyan           |
| `V2-DigitalDebrisViolet`   | Deep violet / magenta |

Both are 3840×2160, 30fps, 600 frames (20s), and loop exactly: frame 600 is
frame 0.

## Rendering

Install once:

```bash
npm install
```

**4K masters** (the delivery command):

```bash
npx remotion render V1-DigitalDebrisTeal out/V1_DigitalDebrisTeal.mp4 --scale=1 --crf=15
npx remotion render V2-DigitalDebrisViolet out/V2_DigitalDebrisViolet.mp4 --scale=1 --crf=15
```

**1080p previews** — the compositions stay at 4K; `--scale=0.5` renders them at
1920×1080. This is what ships in `out/`:

```bash
npm run render:v1
npm run render:v2
npm run still:v1
npm run still:v2
```

`remotion.config.ts` pins H.264 / `yuv420p` and raises the per-frame timeout,
because the first frame of a render builds every element sprite.

Open the studio with `npm run dev`.

## How it is built

A single 2D canvas with a depth model — no 3D engine. There is no occlusion and
no perspective convergence to justify a scene graph, and canvas keeps the sharp
fragments crisp.

**Elements** (`src/lib/elements.ts`) are generated once, at module level, from a
seeded PRNG: 1200 fragments mixing short dashes (40%), circuit traces with one
or two right-angle bends (20%), thicker accent-coloured bars (15%), fine points
(20%) and corner brackets (5%). Each carries its depth bucket, geometry, colour,
path parameters and phase. Per frame only positions and brightness change; there
is no `Math.random()` at render time and no state between frames.

**Depth** (`src/lib/depth.ts`) is 8 buckets, composited back to front. The bucket
drives size (near elements are several times larger), blur (heavy smears up
close, a sharp band through the middle, softening again far away), the
brightness envelope (mid-depth brightest, near dim and semi-transparent, far
faint) and drift speed. That last one is what actually creates the depth: near
layers sway several times farther per cycle than far ones, and the parallax
reads as volume without a camera.

Every size and blur radius is a fraction of the frame height from
`useVideoConfig()`. Rendering the 4K composition at `--scale=0.5` and rendering a
native 1920×1080 composition give the same image to within a mean luminance
difference of ~1.5/255, which is resampling, not scaling error.

**Sprites** (`src/lib/sprites.ts`) bake each element's blur — and, for the sharp
mid band and the accents only, its bloom — into a small cached canvas, once per
palette and frame height. A frame is then just `drawImage` calls under `lighter`
compositing, instead of a canvas filter per element per frame. The near blurred
layers get no bloom on purpose: if they glowed, the depth would read inverted.

**Motion** is a sum of sines whose periods all divide 600, so every path closes
exactly on the loop point. Each bucket gets a large lateral sway plus its second
harmonic — which makes the movement asymmetric in time, so it reads as drift
rather than as a pendulum — and each element adds two smaller wobbles of its
own. Flicker and pulse are keyed on `frame mod 600` with periods that divide it.
Nothing rotates, zooms or travels forward.

**Background** (`src/lib/background.ts`) is a deep radial gradient falling to
near-black at the corners, two very soft off-frame light shafts, and large-scale
mottling so the field is never a clean gradient. A moderate vignette and ~2%
grain go over the top; the grain is not optional — the dark gradient posterises
into visible bands once H.264 gets hold of it. Check the encoded file for that,
not the preview.

## Layout

```
src/
  index.ts             entry point
  Root.tsx             the two compositions
  DigitalDebris.tsx    per-frame draw, in useLayoutEffect keyed on useCurrentFrame()
  lib/
    random.ts          seeded PRNG and sampling helpers
    palette.ts         the two colour registers
    depth.ts           the depth model: size, blur, brightness, speed
    elements.ts        element generation
    sprites.ts         per-element sprite cache with baked blur and bloom
    background.ts      gradient, light shafts, mottling, vignette, grain
```
