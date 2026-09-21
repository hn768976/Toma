# Blade Array

Ten seamless 20-second abstract loops: an array of thin vertical blades standing
side by side, glossy, with colour sweeping across them and a wave travelling
through the row. Remotion + three.js, WebGL2, 30fps, compositions defined at
3840x2160.

Three looks, ten colourways, one rig.

| # | Look | Compositions |
|---|------|--------------|
| 1 | Ribbed Panel | `RibbedPanel-BlueGreen`, `RibbedPanel-Rainbow`, `RibbedPanel-TealBanded`, `RibbedPanel-NavyGlow` |
| 2 | Wave Blades | `WaveBlades-BlueViolet`, `WaveBlades-Magenta`, `WaveBlades-Crimson` |
| 3 | Neon Dark | `NeonDark-Columns`, `NeonDark-Barrel`, `NeonDark-WaveBand` |

Look 1 is look 2 with the wave amplitude at zero and a shallower blade profile.
Look 3 is either of them with a different value curve on the environment
gradient, plus a static horizontal bow on `NeonDark-Columns` and
`NeonDark-Barrel`. One component, one code path, ten data rows.

---

## Quick start

```sh
npm install
npx remotion studio src/index.ts
```

---

## The one thing to keep in mind

**The colour comes from the lighting, not the material.** The blades are a
neutral near-white gloss (`#f2f2f4`). Every colour on screen is a coloured
environment gradient seen in them. Because each blade's cross-section is a
shallow arc, the reflection vector swings across its width and the gradient
spreads across it - which is why colour shifts *within* a single blade, and why
bands sweep smoothly across dozens of blades at once.

Give each blade its own colour instead and you get flat vertical stripes. That
is the standard failure on this look.

The gradient lives in `src/gradient.ts`, baked from stops into a two-row lookup
table; `src/shaders/blade.ts` samples it along the reflection vector.

---

## Render

Compositions are defined at 3840x2160. The previews in this delivery were
rendered at `--scale=0.5`, giving 1920x1080.

**1080p preview** (what is in `out/`):

```sh
npx remotion render src/index.ts <id> out/<name>.mp4 --scale=0.5 --crf=16
```

**4K**, one command per composition:

```sh
npx remotion render src/index.ts RibbedPanel-BlueGreen  out/RibbedPanel_BlueGreen.mp4  --scale=1 --crf=16
npx remotion render src/index.ts RibbedPanel-Rainbow    out/RibbedPanel_Rainbow.mp4    --scale=1 --crf=16
npx remotion render src/index.ts RibbedPanel-TealBanded out/RibbedPanel_TealBanded.mp4 --scale=1 --crf=16
npx remotion render src/index.ts RibbedPanel-NavyGlow   out/RibbedPanel_NavyGlow.mp4   --scale=1 --crf=16
npx remotion render src/index.ts WaveBlades-BlueViolet  out/WaveBlades_BlueViolet.mp4  --scale=1 --crf=16
npx remotion render src/index.ts WaveBlades-Magenta     out/WaveBlades_Magenta.mp4     --scale=1 --crf=16
npx remotion render src/index.ts WaveBlades-Crimson     out/WaveBlades_Crimson.mp4     --scale=1 --crf=16
npx remotion render src/index.ts NeonDark-Columns       out/NeonDark_Columns.mp4       --scale=1 --crf=16
npx remotion render src/index.ts NeonDark-Barrel        out/NeonDark_Barrel.mp4        --scale=1 --crf=16
npx remotion render src/index.ts NeonDark-WaveBand      out/NeonDark_WaveBand.mp4      --scale=1 --crf=16
```

Codec, pixel format, CRF and the absence of an audio track all come from
`remotion.config.ts`. The loops are silent by construction (`Config.setMuted`),
not silent-with-a-track - `ffprobe` must report no `codec_type=audio`.

### Chromium GL flag

`remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("swangle")`:
SwiftShader behind ANGLE, which is the only renderer that works in headless
Chromium without a GPU. **On a machine with a GPU, change it to `"angle"`** -
it is many times faster. From the CLI, `--gl=angle` overrides it.

`Config.setBrowserExecutable` points at a Playwright Chromium if one is present
at the hard-coded path; on a normal machine that path does not exist and
Remotion uses its own managed browser. Delete those lines if they are noise for
you.

### Measured render time

Measured on this delivery's machine: 4 vCPUs, **no GPU**, SwiftShader via ANGLE,
Remotion concurrency 4.

| | per frame | 600-frame loop | all ten |
|---|---|---|---|
| 1080p (`--scale=0.5`) | **~1.0 s** | ~10 min | ~1 h 45 m |
| 4K (`--scale=1`), estimated | ~3.5-4 s | ~35-40 min | ~6-7 h |

The 4K figure is an extrapolation: this is fragment-bound, so cost tracks pixel
count (4x), with the fixed per-frame browser and PNG cost unchanged. On any
machine with a real GPU and `--gl=angle`, expect an order of magnitude better.

If a render is much slower than this, the usual causes are: the blades are not
instanced (they should be one draw call), shadow casting is on (it must not be),
a depth-of-field pass has been added (there should not be one), or the
`EffectComposer` frame buffer has been switched back to `HalfFloatType` - on
software rasterisation that alone costs more than the entire rest of the frame.

---

## Stills

Every composition is a still source as well. `stillFrame` in each data row is
the frame used for the delivered 1080p PNG.

**One 1080p still per composition** (regenerates the PNGs in `out/`):

```sh
node scripts/preview-stills.mjs
```

**The 6000x3375 harvest** - four well-separated frames per composition, forty
images for ten renders:

```sh
node scripts/stills-export.mjs            # all ten, frames 30/180/330/480
```

or one at a time from the CLI (`6000 / 3840 = 1.5625`):

```sh
npx remotion still src/index.ts NeonDark-Columns out/stills-6k/NeonDark_Columns_f180.png \
  --frame=180 --scale=1.5625 --image-format=png
```

PNG, no compression artifacts, dither intact.

---

## Adding a colourway

One data row. Copy the nearest entry in `src/compositions.ts`, change `id` and
`outName`, and add it to `ALL_COMPOSITIONS` - `Root.tsx` registers everything in
that array automatically.

The four things that make a colourway:

```ts
export const ribbedSunset: BladeArrayConfig = {
  ...base,                       // or ...waveBase / ...neonBase
  id: "RibbedPanel-Sunset",
  outName: "RibbedPanel_Sunset",
  stillFrame: 210,

  bladesPerFrame: 40,            // blade count (and so blade width)
  twistAmpDeg: 0,                // wave amplitude; 0 for look 1
  stops: [                       // gradient stops, positions wrap at 1
    s(0.0,  [0.02, 0.06, 0.30], 0.2),   // p, linear rgb, intensity
    s(0.45, [1.00, 0.45, 0.10], 2.1),   // intensity > 1 is HDR and will bloom
    s(0.8,  [0.60, 0.05, 0.35], 0.6),
  ],
};
```

Everything else has a sensible default in `base`. The knobs worth knowing:

- **`parallax`** - how much of the gradient swings across a *single blade*, as
  opposed to across the array. High (0.8-1.0) gives look 1's big hue sweep
  inside each blade; low (0.15-0.3) pins the large-scale structure to position,
  so narrow bright zones land on a narrow *column* of blades and read as lit
  columns. Never set it to 0: colour has to vary across a blade's width.
- **`azimZoom`** - how much of the gradient is visible at once.
- **`elevLo` / `elevHi` / `elevSym`** - vertical shaping. `elevSym: 1` folds it
  about the centre line, for a bright waist or an hourglass.
- **`shadeMix` / `shadePow`** - the bright-core-to-dark-edge ramp across each
  blade. Raise it to make blades read as separately lit objects.
- **`band`** - confines light to one horizontal band crossing as an S-curve
  (`NeonDark-WaveBand`).
- **`backdrop`** - brightness of the wall behind the array. 0 leaves the gaps
  genuinely black; look 2 uses a little so the gaps read as deep colour.

Keep `scrollN`, `twistF`, `elevFreq` and `band.freq` **integers** or the loop
will not close.

---

## Verification

### Everything that can be checked against the encoded file

```sh
node scripts/verify-output.mjs              # every mp4 in out/
node scripts/verify-output.mjs out/NeonDark_Columns.mp4
```

It probes the container, extracts frames 0/150/300/450/599 **from the encoded
mp4** and checks: resolution, frame rate, duration, codec, pixel format and the
absence of an audio track; that colour varies across the width of a single
blade; that the row runs past both side edges; that the colour has moved between
frames 0 and 300; and that no smooth ramp has stepped into plateaus. It also
prints blade pitch, how many seams are shared with frame 300 (look 1 keeps
nearly all of them, look 2 keeps few), hue count, and the near-black percentage
per frame.

The raw probe, if you want it by hand:

```sh
npx remotion ffprobe -v error \
  -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
  -show_entries format=duration -of default=noprint_wrappers=1 out/<file>.mp4
```

Expect exactly 1920x1080, `30/1`, 20.0 s, `h264`, `yuv420p`, and **no**
`codec_type=audio`.

### Loop closure and determinism

```sh
node scripts/verify-loop.mjs            # all ten; SCALE=0.25 for a fast pass
```

Everything periodic runs off `frame % 600`, independent of `durationInFrames`,
so the script simply asks for frame 600 and compares it to frame 0 - they must
be pixel-identical. It then renders frame 300 alone from a cold start and
compares it to frame 300 from a sequential run; those must be byte-identical
PNGs.

### Banding

This batch is almost entirely smooth colour gradient across a 4K frame, which is
the worst case for 8-bit H.264. `NeonDark-Columns` is the worst case in the
batch - large near-black fields beside fully saturated neon - and
`RibbedPanel-NavyGlow` is next. Get `NeonDark-Columns` passing and the rest
will follow.

Extract a PNG **from the encoded mp4**, not from the studio preview, and sample
a scanline through the smoothest region:

```sh
npx remotion ffmpeg -v error -ss 5 -i out/NeonDark_Columns.mp4 -frames:v 1 -y /tmp/check.png
```

On a blade array the smooth direction is *vertical* - a column runs up one blade
with no seams in it, while any horizontal window wide enough to judge a ramp
crosses several seams. Sample columns. Stepped plateaus are a failure; raise
`grain` toward 0.025, then lower CRF toward 14. Do not flatten the gradient to
hide it.

Three things defend against banding, and all three matter:

1. A gamma-encoded gradient LUT, so the dark end keeps its precision.
2. A +/- 1/255 dither in the blade shader, *before* the composer's 8-bit buffer.
   A dither applied downstream of that buffer cannot undo steps it has already
   made.
3. Dither and film grain again in `GradeEffect`, after bloom - bloom creates the
   smoothest ramps in the image.

---

## Determinism

Remotion renders frames out of order across multiple threads, so every value on
screen is a pure function of `useCurrentFrame()`.

- No `useFrame` clock, no `Date.now()`, no delta accumulation.
- No `Math.random()` at render time. `src/random.ts` seeds a `mulberry32` at
  module level and the per-blade width variation is drawn once, at build time.
- No mutable state between frames. Blade instance transforms are recomputed
  every frame from `frame`, never advanced from the previous frame's values.
- Grain and dither are hashes of `(pixel, frame % 600)`.

---

## Project layout

```
src/
  index.ts             registerRoot
  Root.tsx             registers one Composition per data row
  compositions.ts      the ten data rows
  types.ts             what a data row is, field by field
  constants.ts         format, world units, camera
  BladeArray.tsx       canvas, scene, post chain
  blade-geometry.ts    the blade cross-section and the instanced array
  gradient.ts          gradient stops -> two-row lookup table
  GradeEffect.ts       dither + film grain, after bloom
  random.ts            mulberry32
  shaders/blade.ts     blade vertex/fragment shaders, and the backdrop
scripts/
  render.mjs           render compositions to mp4
  preview-stills.mjs   one 1080p still each
  stills-export.mjs    the 6000x3375 harvest
  verify-loop.mjs      loop closure + determinism
  verify-output.mjs    container, per-look and banding checks on the mp4s
  png.mjs              small PNG reader the checks use
  ids.mjs              id -> output name, read from the data rows
```

---

## Completion checklist

- [ ] `npm install && npx remotion studio src/index.ts` works from a clean copy
- [ ] `ffprobe`: 1920x1080, 30/1, 20.0 s, h264, yuv420p, **no audio stream**
- [ ] `node scripts/verify-output.mjs` - container, per-look and banding checks
- [ ] `node scripts/verify-loop.mjs` - loop closure and determinism, all ten
- [ ] Banding: sample a column through the smoothest region of the encoded
      `NeonDark_Columns.mp4`, then `RibbedPanel_NavyGlow.mp4`
- [ ] Colour varies across the width of a single blade (crop one blade, sample
      left edge / centre / right edge - three different hues, not one)
- [ ] Colour bands sweep across many blades, not as per-blade steps
- [ ] Blades cropped top and bottom; the row runs past both side edges
- [ ] Colour has visibly moved between frames 0 and 300
- [ ] Look 1: blades static - overlay frames 0 and 300, only colour differs
- [ ] Look 2: visible widths vary across the frame; a horizontal crossing line
      that sits at a different height at frame 300; dark gaps through the row;
      the thin blade edge catches a bright line
- [ ] Look 3: most of the frame near-black; black regions genuinely black;
      unlit blades still present when the frame is brightened heavily
- [ ] `RibbedPanel-NavyGlow` and all of look 3 keep their copy space at every
      frame
