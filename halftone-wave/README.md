# Halftone Dot Wave

A coarse halftone dot grid mapped through a fixed shallow projection, folded
by a wave that travels along the sheet. Two colourways, 16s, seamless loop.

| Composition id            | Colourway                                   |
| ------------------------- | ------------------------------------------- |
| `V1-HalftoneWaveMagenta`  | magenta `#e026c0` → violet `#7a3ce8` → blue `#2a5fe8` |
| `V2-HalftoneWaveCyan`     | cyan `#22d3ee` → teal `#12a878` → deep green `#0a6a4a` |

Both are defined at **3840×2160, 30fps, 480 frames**.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

```bash
npx remotion render V1-HalftoneWaveMagenta out/V1_HalftoneWaveMagenta.mp4 --scale=1 --crf=16
npx remotion render V2-HalftoneWaveCyan    out/V2_HalftoneWaveCyan.mp4    --scale=1 --crf=16
```

A 1080p preview is the same composition at `--scale=0.5`, not a separate
composition, so the two resolutions can never drift apart:

```bash
npx remotion render V1-HalftoneWaveMagenta out/V1_HalftoneWaveMagenta.mp4 --scale=0.5 --crf=18
```

Stills:

```bash
npx remotion still V1-HalftoneWaveMagenta out/V1_HalftoneWaveMagenta.png --frame=240 --scale=0.5
```

## Packaging

```bash
npm run package   # -> out/halftone-wave-project.zip
```

## How it works

Everything lives in `src/halftone/`, and all of it is tuned from
`constants.ts` — geometry is authored at the 3840×2160 master size and scaled
by `width / 3840` at draw time.

- **`sheet.ts`** — the baked projection. The sheet is not raytraced: a
  120 × 68 grid is pushed through a fixed shallow projection where the row
  index alone drives horizontal spread, row spacing, dot scale and alpha,
  then the whole thing is rotated −19° so it sweeps from the lower left to
  the upper right and leaves the upper-left corner empty for a title.
  `heightAt()` is the travelling fold; `facingAt()` measures how squarely
  the folded surface faces the viewer, as the screen-space expansion of the
  row spacing.
- **`draw.ts`** — painting. Dot *diameter* is a fraction of the local column
  spacing set by `facingAt()`, from `DOT_MIN` (grid wide open) to `DOT_MAX`
  (near touching); that size modulation is the halftone effect. Compositing
  is additive on black, which means alpha-blending a colour at opacity `a`
  is the same as adding `colour × a` — so dots sharing a (colour bucket,
  intensity level) pair share a `fillStyle` and are filled as one batched
  path rather than one `fill()` per dot.
- **`color.ts`** — the two palettes, sampled into a 48-entry ramp indexed by
  position along the sheet's length.
- **`grain.ts`** — 16 pre-generated noise tiles, cycled. The pure-black field
  bands around the glow once encoded; ~1.5% grain dithers those steps away.
- **`random.ts`** — the only source of randomness. `Math.random()` is never
  called at render time.

### Looping

The loop is exact by construction, not by crossfade. Every animated quantity
is a function of `tN = frame / durationInFrames`:

- both travelling waves subtract `tN` exactly once, so the fold advances by
  exactly one wavelength over the 480 frames;
- each breathing term in `BREATH_TERMS` uses a whole number of `cycles`;
- the background glow pulse is one cycle;
- the grain cycles 16 tiles, and 480 / 16 = 30 whole cycles.

So frame 480 is pixel-identical to frame 0.

### Moiré

A regular dot grid at 4K beats against the pixel grid. Two things guard
against it: `SPREAD_HALF_FAR` is chosen so the base column spacing lands on
whole pixels at both 4K (40px) and 1080p (20px), and every dot carries a
deterministic positional jitter of ±2.5% of the local spacing
(`JITTER`, seeded by `JITTER_SEED`).

### Bloom

The bloom is a downscaled copy of the dot layer, blurred and masked in CSS to
the densest region only. Keep it mild — heavy bloom fuses the dots and
destroys the halftone.
