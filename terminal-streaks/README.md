# Retro Terminal Streaks

Two 20-second seamless loops of old BBS/terminal text screens smeared into
horizontal streaks by a failing display. Mastered at **3840×2160, 30fps, 600
frames**; the deliverable previews are rendered at 1080p with `--scale=0.5`.

| Composition id             | Look                                                    |
| -------------------------- | ------------------------------------------------------- |
| `V1-TerminalStreaksColour` | Hue cycling red → violet → cyan/teal, 3 cycles per loop |
| `V2-TerminalStreaksAmber`  | Warm amber phosphor, one hue, no cycling                |

## Setup

```console
npm install
npx remotion studio
```

## Render

4K masters (this is what the project is set up for):

```console
npx remotion render V1-TerminalStreaksColour out/V1_TerminalStreaksColour.mp4 --scale=1 --crf=16
npx remotion render V2-TerminalStreaksAmber  out/V2_TerminalStreaksAmber.mp4  --scale=1 --crf=16
```

1080p previews (half scale, same framing and same blur in relative terms):

```console
npx remotion render V1-TerminalStreaksColour out/V1_TerminalStreaksColour.mp4 --scale=0.5 --crf=18
npx remotion render V2-TerminalStreaksAmber  out/V2_TerminalStreaksAmber.mp4  --scale=0.5 --crf=18
```

Stills:

```console
npx remotion still V1-TerminalStreaksColour out/V1_still.png --frame=400 --scale=0.5
npx remotion still V2-TerminalStreaksAmber  out/V2_still.png --frame=400 --scale=0.5
```

`npm run render:v1` / `npm run render:v2` are shortcuts for the 4K commands.

`remotion.config.ts` sets PNG frames: the piece is all fine grain and thin
glyph strokes, and a JPEG intermediate both softens them and makes ffmpeg tag
the result full-range (`yuvj420p`) instead of `yuv420p`.

## How it works

Everything is drawn to offscreen canvases and composited; no DOM text is
blurred, and nothing is rendered in 3D.

- `src/streaks/content.ts` — the text page, generated once at module load from
  a seeded PRNG. Invented BBS filler: file areas, message headers, quoted
  replies, block dumps, index listings, status lines.
- `src/streaks/page.ts` — offscreen surfaces that only depend on the frame
  size: the text page (drawn in greyscale, with the first screen repeated after
  the last row so the vertical wrap never splits a blit), the grain tiles, and
  the baked scanline + vignette overlay.
- `src/streaks/motion.ts` — geometry, row bands, jitter, per-band blur, focus
  pulses, glitch bursts, scroll and trail weights.
- `src/streaks/render.ts` — the per-frame pipeline: trail → horizontal downscale
  chain → per-band directional blur → bloom → tint → composite.
- `src/streaks/palette.ts` — the two colour ramps.

### The loop

`durationInFrames` is 600 and every value is a pure function of
`(row or band, frame mod 600)`:

- the scroll advances exactly 120 rows — the full content period — over the loop;
- every oscillator is a sine with an integer number of cycles per loop;
- glitch bursts and focus pulses are placed with a wrapped distance, so they
  cross the seam correctly;
- **the trail is reconstructed, never accumulated.** Each frame composites the
  last 10 frames' worth of horizontal jitter, reading those frames with wrapped
  frame numbers. Nothing is carried between renders, so Remotion can render
  frames out of order across threads, and the accumulation is already settled at
  frame 0.

Frame 0 and frame 600 render byte-identical.

### Resolution independence

Every size, offset and blur radius is a fraction of `useVideoConfig()`'s width
or height, and the canvas is always allocated at composition resolution, so a
`--scale=0.5` preview is an exact downscale of the 4K render rather than a
different-looking image.

### Performance note

The directional blur is built from a handful of shifted copies of the frame —
heavily smeared bands are blurred in an 8×-narrower buffer — rather than from
`ctx.filter = "blur()"`. On a software rasteriser the filter path costs seconds
per band; this costs milliseconds and has the right shape, blurring only
horizontally so the vertical scroll stays crisp.

## Fonts

JetBrains Mono is bundled in `public/fonts/` and loaded with `delayRender()`
before any frame is drawn — a substituted font would change the glyph advance
and break the integer-row scroll. See `NOTICE.md`.
