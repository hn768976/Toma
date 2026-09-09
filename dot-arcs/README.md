# Concentric Dot Arcs

A macro field of coloured dots arranged along concentric curved arcs, with an
extreme shallow depth of field: huge soft bokeh in the foreground, a sharp band
through the middle, softening again into the distance. Reads as a fingerprint
macro, which is worth knowing for keywording — it sells into biometrics and
identity as well as generic data and technology.

Three colourways, one build:

| Composition id | Colourway |
| --- | --- |
| `V1-DotArcsBlueMagenta` | Blue / cyan / magenta on deep navy, cyan glow upper right |
| `V2-DotArcsGold` | Gold / amber / orange on deep brown, amber glow upper right |
| `V3-DotArcsMono` | White / silver / grey on near-black, cool white glow upper right |

Each composition is **3840×2160, 30 fps, 300 frames (10 s), seamless loop**.

## Render

```bash
npm install
npx remotion studio          # preview

# 4K masters
npx remotion render V1-DotArcsBlueMagenta out/V1_DotArcsBlueMagenta.mp4 --scale=1 --crf=15
npx remotion render V2-DotArcsGold        out/V2_DotArcsGold.mp4        --scale=1 --crf=15
npx remotion render V3-DotArcsMono        out/V3_DotArcsMono.mp4        --scale=1 --crf=15

# 1080p previews
npx remotion render V1-DotArcsBlueMagenta out/V1_DotArcsBlueMagenta.mp4 --scale=0.5 --crf=15

# stills
npx remotion still V1-DotArcsBlueMagenta out/V1_DotArcsBlueMagenta.png --frame=90 --scale=1
```

`remotion.config.ts` already pins h264 / yuv420p / crf 15 and overwrite-on-render,
so `--crf=15` above is belt and braces.

If Chromium is not on the machine, Remotion downloads its own headless shell on
first render. On a machine where that download is blocked, point it at a local
Chrome instead:

```bash
REMOTION_BROWSER=/path/to/chrome npx remotion render ...
```

## How it works

Everything is drawn to a single 2-D canvas in polar coordinates around a centre
that sits off-frame beyond the upper right. There is no 3-D camera and no
occlusion — depth is carried entirely by dot size, blur, brightness and opacity
varying with the arc index.

- **`src/layout.ts`** — the whole arc and dot layout, generated once at module
  scope from a seeded PRNG (mulberry32). Per frame, only rotation and shimmer
  change. All geometry is expressed in *frame-height units* (1.0 == the height
  of the composition), so every size and blur radius scales with resolution and
  the 1080p preview is a true downscale of the 4K master.
- **`src/sprites.ts`** — cached soft-disc sprites, one per (depth bucket ×
  colour), 8 × 6 = 48 batches. A defocus disc is rasterised analytically with a
  broad flat body and a soft rim, which is truer bokeh than blurring a small
  dot — and much cheaper than a per-dot filter. The falloff is dithered, because
  large soft circles of near-flat colour are their own banding risk.
- **`src/DotArcs.tsx`** — the per-frame draw, in `useLayoutEffect` keyed on
  `useCurrentFrame()` so each frame is fully painted before capture. Buckets are
  composited back to front, so the near bokeh lands over the sharp band at low
  opacity and the sharp band reads through it. No `Math.random()` at render
  time and no state between frames — Remotion renders frames out of order across
  threads.

### Why the loop is exact

Dots travel along their arcs, so a dot that has moved must land on a dot that
looks identical, or the loop jumps. Three things have to line up:

1. Each arc advances a whole number of dot spacings over the 300 frames. The
   sweep angle is quantised to `2π / blocks`, and the ring holds exactly
   `blocks × period` dots — if the ring were not a whole number of periods there
   would be a seam where the dot index wraps.
2. Every per-dot attribute — angular and radial jitter, size, colour, brightness,
   ridge gaps, shimmer phase — repeats with that same period, so after the loop
   dot *k* sits where dot *k+m* sat and carries identical everything.
3. The loop phase is taken modulo the duration, so the trig lands on exactly the
   same values rather than merely equal ones to within floating-point drift.

Verified: rendering frame 300 of a 301-frame build produces a file
byte-identical to frame 0.

### Tuning

Most of the look lives in a handful of constants at the top of `src/layout.ts`:
`CENTER_X` / `CENTER_Y` (where the arcs curve around), `R_MIN` / `R_MAX` and
`N_ARCS` (how many ridges cross the frame), `FOCUS_R` (which ridge is sharp —
the focus plane is derived from it, so the sharp band stays put when the ridge
spacing changes), `DOT_SPACING`, `SWEEP` (how far the field travels per loop),
and the `blurRadiusAt` / `brightnessAt` / `opacityAt` depth ramps.

Palettes are in `src/palettes.ts`. The geometry is shared by all three versions;
only the colour assignment is resolved per palette.
