# Glowing Iris Ring

A looping, 2D motion graphic built in [Remotion](https://remotion.dev): a ring of
fibrous filaments streaming outward from an irregular black pupil, on pure black.
Three colourways, each with the pupil dilation folded in.

| Composition id       | Look                                              |
| -------------------- | ------------------------------------------------- |
| `V1-IrisRingCyan`    | Cyan/blue with magenta undertones (reference match) |
| `V2-IrisRingGold`    | Amber/gold with crimson undertones — a solar iris   |
| `V3-IrisRingViolet`  | Violet/magenta dominant with cyan undertones        |

Each composition is **3840×2160, 30 fps, 300 frames (10s), seamlessly looping**.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering

Full 4K, one command per composition:

```bash
npx remotion render V1-IrisRingCyan   out/V1_IrisRingCyan.mp4   --scale=1 --crf=16
npx remotion render V2-IrisRingGold   out/V2_IrisRingGold.mp4   --scale=1 --crf=16
npx remotion render V3-IrisRingViolet out/V3_IrisRingViolet.mp4 --scale=1 --crf=16
```

1080p preview (identical framing — the composition is unchanged, only the
capture scale differs):

```bash
npx remotion render V1-IrisRingCyan out/V1_IrisRingCyan.mp4 --scale=0.5 --crf=16
```

A still, at whichever scale you need:

```bash
npx remotion still V1-IrisRingCyan out/V1_IrisRingCyan.png --frame=150 --scale=0.5
```

Frame 150 sits at peak pupil dilation.

Codec (`h264`), pixel format (`yuv420p`) and the PNG frame format are set in
`remotion.config.ts`, so they do not need to be passed on the command line.

### If Chromium cannot be downloaded

Remotion fetches its own Chromium on first render. On a machine without network
access to `remotion.media`, point it at a local build instead:

```bash
npx remotion render V1-IrisRingCyan out/v1.mp4 --scale=1 --crf=16 \
  --browser-executable=/path/to/chrome
```

`remotion.config.ts` selects the `swiftshader` renderer. It is a pure software
rasteriser, so results are identical with or without a GPU — and on a headless
machine it is **dramatically** faster than `swangle`, which was measured at
~48 s/frame here versus ~3 s.

## How it is built

Everything is a function of angle and radius, drawn to a single 2D canvas with
additive compositing (`globalCompositeOperation = 'lighter'`). There is no 3D
camera and no camera move.

```
src/
  Root.tsx            three Compositions, one per colourway
  iris/
    IrisRing.tsx      the component; paints in useLayoutEffect keyed on the frame
    draw.ts           the whole render: filaments, rim, spikes, membrane, bloom, grain
    field.ts          composition constants, seeded strand identities, per-frame motion
    palette.ts        the three colour ramps and their undertones
    noise.ts          4D value noise, sampled so every field loops exactly
    batcher.ts        groups additive dots by quantised colour before filling
    random.ts         mulberry32
```

Structure, inner to outer: a hard-edged, noise-perturbed black pupil; a hot inner
rim broken into a few uneven arcs; the filament field itself (3600 strands, each
a chain of additive dots, curved and tapering, clustered into bundles, with
staggered start radii); a darker gap; a striated outer shell standing off the
field; and a handful of low-alpha spikes punching past the edge.

### Matching the reference

The layout and colour were fitted to measurements of the reference clip rather
than by eye. Numbers below are fractions of frame height, measured on a radial
luminance profile about the brightness centroid:

| | reference | this build |
| --- | --- | --- |
| centre | 0.505-0.513 | 0.507 |
| pupil diameter | 0.374-0.378 | 0.378 |
| 25%-of-peak radius | 0.313-0.317 | 0.333 |
| faint outer extent | 0.393-0.463 | 0.425 |
| peak radial-mean luminance | 119-123 | 113 |
| mean colour at r=0.22 | rgb(17,118,182) | rgb(23,121,180) |
| mean colour at r=0.32 | rgb(33,18,98) | rgb(38,24,101) |

Two findings shaped the tuning, and are worth keeping in mind before changing
gains:

- **The washed-out look was additive clipping, not the colour ramp.** In the
  bright band the reference is 94-96% lit with 0.02% near-white pixels; an
  earlier build was 66% lit with 3.4% near-white — a sparse field of blown-out
  strands separated by black. The fix was structural: many more, dimmer strands
  (1400 -> 3600) at a lower gain, plus staggered start radii, since 3600 strands
  at full width overlap the pupil circumference several times over and clip
  every channel to white. Raising or lowering a gain alone cannot fix it.
- **The ring is far larger than a first reading of the brief suggests.** The
  reference nearly fills the frame height (outer diameter ~0.85*H, not 0.62*H),
  sits on the optical centre rather than above it, and its pupil is ~0.46 of the
  outer radius. Spikes and shell are held inside 0.476*H so nothing touches the
  boundary; the rendered frames leave ~82px of margin top and bottom at 1080p.

### Things worth knowing before editing

- **Everything must loop.** Noise is sampled as
  `noise(θ, r, cos(2πt), sin(2πt))` with `t = frame / durationInFrames`, so the
  temporal argument traces a closed circle. Per-strand shimmer uses integer
  cycle counts per loop. Pupil dilation completes exactly one eased cycle.
- **No `Math.random()` at render time, and no state between frames.** Remotion
  renders frames out of order across worker threads, so every strand property is
  derived from its index through a seeded `mulberry32`. Anything else pops.
- **All sizes are fractions of frame height** (via `useVideoConfig()`), so the
  1080p preview and the 4K render are proportionally identical.
- **Colour buckets matter.** `DotBatcher` groups ~700k dots per frame by
  quantised colour so the canvas takes one `fillStyle` assignment and one
  `fill()` per bucket. Quantisation is on a square-root curve — a linear one
  rounds the many very dim dots to zero and hollows the field out.
- **Bloom is sourced selectively**, from the inner rim and the hottest filament
  peaks only, blurred in a 1/5-scale buffer and composited back. Blooming
  everything smears the fibrous texture into a glowing donut, which is the one
  thing this piece cannot afford.
- **The grain is not decoration.** Large pure-black areas next to a bright object
  band badly in H.264; the ~1.5% noise floor dithers them. Judge it on the
  encoded file, not in the Studio preview.
