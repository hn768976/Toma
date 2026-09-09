# Analogue TV Static

Full-frame analogue television snow, built in Remotion. Two versions, both
**3840×2160, 30 fps, 300 frames (10 s), seamlessly looping**.

| Composition id | Output | What it is |
| --- | --- | --- |
| `V1-TVStaticMono` | `V1_TVStaticMono.mp4` | Monochrome dead-channel snow — the classic look |
| `V2-TVStaticColour` | `V2_TVStaticColour.mp4` | The same structure with colour noise — a detuned colour set |

These are **backgrounds, not overlays**. Every pixel is lit; there is no black
area to key or screen-blend against. Use them full frame.

## Commands

```console
npm install
npx remotion studio
```

### Render at 4K

```console
npx remotion render V1-TVStaticMono   out/V1_TVStaticMono.mp4   --scale=1 --crf=11 --muted
npx remotion render V2-TVStaticColour out/V2_TVStaticColour.mp4 --scale=1 --crf=11 --muted
```

### Render a 1080p preview

```console
npx remotion render V1-TVStaticMono   out/V1_TVStaticMono.mp4   --scale=0.5 --crf=11 --muted
npx remotion render V2-TVStaticColour out/V2_TVStaticColour.mp4 --scale=0.5 --crf=11 --muted
```

### Stills

```console
npx remotion still V1-TVStaticMono   out/V1_TVStaticMono.png   --frame=96 --scale=0.5
npx remotion still V2-TVStaticColour out/V2_TVStaticColour.png --frame=96 --scale=0.5
```

The same commands are wired up as `npm run render:mono:4k`, `render:colour:4k`,
`render:mono:1080` and `render:colour:1080`.

## Bitrate

Per-pixel noise that re-randomises every frame is the worst case there is for
inter-frame compression — worse than a sparse overlay plate, because there is
no black area to compress cheaply. Every frame is effectively a keyframe's
worth of new information.

**Render at CRF 10–12** (`--crf=11` above; the project's `remotion.config.ts`
already defaults to 11). Then **check the encoded file at full size**: if the
speckle smears into grey blocks or crawls in patches, lower the CRF further.

Expect a large file — for this subject that is correct and unavoidable. For
scale, the supplied 1080p previews land around 365–420 Mbit/s, roughly 460 MB
and 520 MB for ten seconds. A 4K render at the same CRF will be several times
that again. If a delivery target caps the file size, raise the CRF rather than
capping the bitrate: a bitrate ceiling makes the encoder abandon the speckle in
the busiest frames, which is exactly where it is most visible.

`--muted` keeps a silent audio track out of a plate that has no audio.

Frames are captured as PNG (`Config.setVideoImageFormat("png")`) rather than
JPEG, because JPEG's chroma subsampling and DCT visibly soften pixel-scale
speckle before the video encoder ever sees it.

## Resolution and grain — read before rendering at 4K

The noise is generated at the true output pixel size, never generated small and
scaled up. Remotion implements `--scale` with the browser's device scale
factor, so the canvas is sized from `devicePixelRatio`: `--scale=0.5` fills a
1920×1080 canvas, `--scale=1` fills a 3840×2160 one.

The consequence is deliberate and worth knowing: **the 4K render looks
finer-grained than the 1080p preview.** Analogue speckle is a pixel-scale
phenomenon — one noise sample per output pixel — so four times the pixels means
four times as many, smaller specks. Both are correct; they are not the same
image at two sizes. If you want the 4K file to have the coarser grain of the
1080p preview, render at `--scale=0.5` and upscale with a nearest-neighbour
filter, rather than changing the composition.

Everything that is *not* pixel-scale — streak run lengths, the chromatic
offset, the chroma block size, the scanline pitch — is sized relative to
`REFERENCE_WIDTH` (1920) in `src/constants.ts`, so those features read the same
at both resolutions.

## How it is built

`src/render-frame.ts` writes pixels straight into an `ImageData` buffer, one
scanline at a time. Nothing is drawn with per-pixel `fillRect` calls, and there
is no geometry and no camera.

Four layers, in the order they are applied:

1. **Base speckle** (`src/hash.ts`) — high-frequency per-pixel noise, stretched
   past the ends of the range so a good fraction of pixels land on the floor or
   the ceiling. It re-randomises every frame; that flicker is the effect.
2. **Drifting tonal masses** (`src/mass-field.ts`) — large, soft light and dark
   regions moving slowly through the frame. They bias the speckle *before* the
   contrast stretch, so they modulate the density of dark and light pixels
   rather than washing a flat level over them. This is the layer that makes the
   frame read as a signal failing to resolve rather than a flat grey fizz, and
   it is the one most implementations leave out.
3. **Horizontal streak bands** (`src/streaks.ts`) — runs of pixels smeared
   sideways into dashes and broken lines, in bands that appear, persist for a
   few frames and vanish. The smear is a horizontal *copy* of the base noise,
   sampled at an offset and quantised into runs — never a blur, which would
   read as digital softening instead of a signal smearing along the scanline.
4. **Chromatic fringing, scanlines and a roll bar** — a 1–2 px channel offset
   tinted pink or cyan and strongest at the streak bands; a ~6% horizontal
   darkening at 540 lines across the frame; and a wide band of slightly raised
   density drifting down the frame, wrapping twice per loop.

V2 keeps V1's luminance exactly — same speckle, same masses, same crunch — and
adds a zero-mean colour-difference layer on top, cut to 60% saturation. The
chroma is sampled in short horizontal blocks rather than per pixel, which is
both truer to analogue colour (chroma carries far less bandwidth than
luminance) and the reason the colour survives being viewed small; per-pixel RGB
noise averages back to grey at any distance and would give V2 the same
thumbnail as V1.

Nothing anywhere in the frame reaches pure black or pure white: the speckle is
clamped to `#0a0a0c … #f2f2f4`, and blue sits two points higher at both ends,
which is where the field's faint coolness comes from.

## Looping and determinism

Every pixel is a pure function of `(x, y, frame % durationInFrames)`, seeded
through an integer hash — no `Math.random()`, no state carried between frames.
Remotion renders frames out of order across threads, and this is what makes
that safe.

The tonal masses ride on 3D value noise whose lattice is periodic on the time
axis, and wander on a sine that completes exactly one turn over the loop. The
streak bands are scheduled on `frame mod 300`, and the roll bar wraps a whole
number of times.

The result is that **frame 300 is bit-identical to frame 0**, so the loop needs
no cross-fade. If you change `DURATION_IN_FRAMES` in `src/constants.ts`, the
loop stays exact — every periodicity is derived from it.

## Layout

```
src/
  index.ts          registerRoot
  Root.tsx          the two compositions
  constants.ts      size, fps, duration, reference width
  TVStatic.tsx      canvas element, sizing and delayRender handling
  render-frame.ts   the pixel loop: levels, fringing, scanlines, roll bar
  mass-field.ts     drifting tonal masses
  streaks.ts        horizontal streak band schedule
  hash.ts           integer hash and periodic 3D value noise
```

Tuning constants sit at the top of `render-frame.ts`. `SPECKLE_CONTRAST` sets
the crunch, `MASS_GAIN` the strength of the drifting masses, and `CHROMA_AMP`
with `COLOUR_SATURATION` the colour in V2.

## Notes

- No text, no watermark, no logo.
- No bloom, no vignette, no added grain — it is all noise already.
- A 4K render is roughly four times the per-frame cost of the 1080p preview.
