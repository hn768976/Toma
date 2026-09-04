# Oscilloscope Waveforms

Two looping measurement-display motion graphics, built with Remotion.

| Composition id          | Version                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `V1-ScopeMulticolour`   | Cyan / blue / white / red traces on dark navy (reference match)  |
| `V2-ScopeGreenPhosphor` | Single-hue green phosphor CRT                                    |

Both are defined at **3840 x 2160, 30 fps, 420 frames (14 s)** and loop seamlessly.

## Quick start

```bash
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are authored at full 4K, so a 4K render is just `--scale=1`:

```bash
npx remotion render V1-ScopeMulticolour out/V1_ScopeMulticolour.mp4 --scale=1 --crf=16
npx remotion render V2-ScopeGreenPhosphor out/V2_ScopeGreenPhosphor.mp4 --scale=1 --crf=16
```

(Also available as `npm run render:v1` / `npm run render:v2`.)

A 1080p preview is the same command at half scale:

```bash
npx remotion render V1-ScopeMulticolour out/V1_ScopeMulticolour.mp4 --scale=0.5 --crf=16
npx remotion render V2-ScopeGreenPhosphor out/V2_ScopeGreenPhosphor.mp4 --scale=0.5 --crf=16
```

Stills:

```bash
npx remotion still V1-ScopeMulticolour out/V1_ScopeMulticolour.png --frame=96 --scale=0.5
npx remotion still V2-ScopeGreenPhosphor out/V2_ScopeGreenPhosphor.png --frame=96 --scale=0.5
```

Codec, pixel format (`yuv420p`), Rec. 709 colour tagging, JPEG frame quality and
the muted (video-only) output are all set in `remotion.config.ts`, so none of
them need to be passed on the command line. `--crf=16` is deliberate: the
picture is a near-black field with soft glows, which is exactly the content
H.264 bands on at default quality.

Concurrency is intentionally left unset so Remotion picks a value for the
machine it runs on. On a small container, cap it: `--concurrency=3`.

## Verifying the loop

```bash
npm run verify
```

`scripts/verify-loop.mjs` regenerates every trace at frame 0 and at frame 420 —
the frame that would follow the last one — and asserts the SVG path data is
byte-identical, plus checks that every spatial period divides the loop distance.
It reads the same source the render does, so it catches a wavelength that drifts
by a fraction of a pixel per cycle, which no amount of eyeballing the encoded
file will.

## How the loop is built

Everything follows from one number: the display scrolls **16 design px per
frame**, so a 420-frame loop travels exactly **6720 px**.

- 16 px per frame halves to a whole 8 px at 1080p, so the grid never lands
  between pixels and the scroll cannot shimmer at either resolution.
- 6720 = 2^6 x 3 x 5 x 7, and every spatial period in the piece is one of its
  divisors: the 48 px grid, the 240 px major divisions, the 480 px label pitch,
  the two sine wavelengths (672 and 746.67 px — 10 and 9 whole cycles per loop,
  which is what makes them beat against each other exactly once), the 840 px
  square wave, and every noise octave.
- The noise traces are seeded value noise whose lattice index is taken modulo
  `LOOP_DISTANCE / step`, so they repeat exactly instead of drifting.
- The axis labels cycle through 14 values on a 480 px pitch — 6720 px, one full
  loop — so the number sequence wraps at the same instant the scroll does.
- The sweep line crosses twice per loop, entering and leaving fully off-frame.
- The main sine's amplitude modulation runs two whole cycles per loop.

Everything is a pure function of `useCurrentFrame()`: no `Math.random()` at
render time and no state carried between frames, because Remotion renders frames
out of order across threads.

## Source layout

```
src/
  constants.ts        timing, grid geometry, waveform periods (start here)
  signal.ts           seeded noise, sine/square path generation
  traces.ts           builds all five traces for a given frame (pure)
  theme.ts            the V1 and V2 palettes — the only difference between them
  Oscilloscope.tsx    the scene
  components/         Grid, AxisLabels, Traces (bloom), Sweep, Overlays
public/fonts/         Roboto Mono, self-hosted so renders never hit the network
```

## Notes on the treatment

- The grid is CSS gradients rather than SVG lines, and sits outside the bloom
  stack, so it stays crisp and dim while the traces glow.
- Trace cores are 3–7 design px rather than the 2–3 px in the brief. At 2 px the
  cyan sine reads as a hairline next to its own bloom and loses the reference's
  neon weight; the current widths match the reference's proportions.
- The horizontal grid is offset so a major division lands exactly on the main
  sine's zero line, and the square wave's midline sits three majors below it, so
  the left-hand voltage labels agree with the grid instead of floating near it.
- The optional barrel warp is **not** implemented. Doing it properly needs an
  SVG displacement filter over the whole frame, which visibly softens the grid
  hairlines and the axis labels — the one thing the brief says to protect.
