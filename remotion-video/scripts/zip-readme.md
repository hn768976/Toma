# Radial Audio Equalizer

A looping circular spectrum visualiser: a dense shimmering core with a ring of
spectrum-driven spikes, surrounded by concentric reactive rings of dots and
capsules, with large capsules streaming outward past the frame edges.

Two versions:

| Composition ID | Look |
| --- | --- |
| `V1-RadialEqualizerOrangeBlue` | Hot orange-red against cool blue, deep navy background |
| `V2-RadialEqualizerGoldMagenta` | Gold against hot magenta, deep purple-black background |

Both are **3840x2160, 30 fps, 360 frames (12s)** and loop seamlessly. There is
no audio track and no audio file is needed — the driving signal is synthetic
(see below).

## Setup

```bash
npm install
npx remotion studio
```

## Rendering

Full 4K, one command per composition:

```bash
npx remotion render V1-RadialEqualizerOrangeBlue out/V1_RadialEqualizerOrangeBlue.mp4 --scale=1 --crf=16
npx remotion render V2-RadialEqualizerGoldMagenta out/V2_RadialEqualizerGoldMagenta.mp4 --scale=1 --crf=16
```

1080p preview (same composition, half scale):

```bash
npx remotion render V1-RadialEqualizerOrangeBlue out/V1_RadialEqualizerOrangeBlue.mp4 --scale=0.5 --crf=18
```

A still on a beat peak (beats land on every frame divisible by 36):

```bash
npx remotion still V1-RadialEqualizerOrangeBlue out/V1_still.png --frame=108 --scale=0.5
```

## How it works

Everything is 2D in polar coordinates drawn to a single canvas — no 3D camera
and no camera move at all. Elements are placed by `(radius, angle)` and emit
outward, growing and brightening as their radius increases. Radial expansion
projects identically whether it is built in 3D or in polar 2D, and 2D keeps the
capsule edges crisp and the render fast.

### The driving signal

`spectrum.ts` generates 96 band values as a **pure function of the frame
number** — no state, no accumulation, because Remotion renders frames out of
order across threads. Each band sums three sinusoids whose frequencies are
integer cycles per loop. Band 0 sits at the top of the frame and moves slowly
with a large amplitude; bands toward the bottom flicker faster with smaller
amplitudes, and the profile is mirrored around the circle so there is no seam.

A global beat pulse fires every 36 frames (10 beats across the loop), lifting
all bands and expanding the whole assembly by 3% with an ease-out over 8
frames.

### Why it loops

Over 360 frames every element travels outward by exactly one ring spacing. For
the last frame to hand back to the first, the field must be *periodic in ring
index*: the element that ends up where its outward neighbour started has to be
indistinguishable from it. So one pattern of elements is generated and repeated
in every ring cell (`field.ts`), and positions are
`(ringIndex + u + frame / duration) mod RINGS` — recycling is arithmetic, never
stateful. Each family carries a small angular `twist` proportional to the ring
coordinate, which staggers the rings against each other without breaking that
periodicity. The outermost ring sits well beyond the frame corners, so elements
recycle off-screen.

Check it:

```bash
npm run verify-loop
```

This asserts that the element field, the spectrum and the beat envelope are all
identical at frame 0 and frame 360.

### Rendering notes

Compositing is additive throughout, with the brightest capsules clipping to
white. Radial blur is faked with three softness tiers of pre-blurred sprites
selected by radius, so near-centre elements are sharp and outer capsules are
soft and streaked. Sprites are baked once per colour bucket (48 buckets: two
hue families x 24 brightness steps) and blitted, rather than re-drawing rounded
paths per element. Fine grain at 2% is drawn last, over the vignette, where it
doubles as a dither against banding in the dark falloff.

## Layout

```
src/
  Root.tsx                     compositions
  radial-equalizer/
    constants.ts               dimensions, timing, radii (all as fractions of frame height)
    random.ts                  mulberry32 PRNG + easing helpers
    spectrum.ts                the synthetic spectrum and beat envelope
    field.ts                   the repeating element pattern
    records.ts                 per-frame element maths (DOM-free, so it is testable)
    palette.ts                 the two palettes, colour ramps and the hue sector field
    sprites.ts                 cached pre-tinted capsule/dot/glow sprites
    grain.ts                   looping noise tiles
    draw.ts                    the frame painter
    RadialEqualizer.tsx        the component
scripts/
  verify-loop.mjs              asserts the loop closes
```
