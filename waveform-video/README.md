# Dynamic Audio Waveform Visualiser

A segmented-LED audio equaliser, rebuilt in [Remotion](https://remotion.dev) from
a 960×540 reference clip. Bottom-anchored bars made of stacked LED segments, on
black, looping seamlessly.

Two variants, four compositions — all **30 fps, 300 frames (10.000 s exactly)**:

| Composition         | Size      | Variant                                    |
| ------------------- | --------- | ------------------------------------------ |
| `WaveformBlue4K`    | 3840×2160 | Blue — 32 bars × 40 segments               |
| `WaveformBlue1080`  | 1920×1080 | Blue — 32 bars × 40 segments               |
| `WaveformWhite4K`   | 3840×2160 | White — 64 bars × 60 segments (finer grid) |
| `WaveformWhite1080` | 1920×1080 | White — 64 bars × 60 segments (finer grid) |

## Quick start

```bash
npm install
npm run dev          # Remotion Studio — scrub and tweak live
```

## Rendering

```bash
npm run render:blue4k     # out/waveform-blue-4k.mp4
npm run render:white4k    # out/waveform-white-4k.mp4
npm run render:blue1080   # out/waveform-blue-1080p.mp4
npm run render:white1080  # out/waveform-white-1080p.mp4
```

Or drive the CLI directly:

```bash
npx remotion render WaveformBlue4K out/blue-4k.mp4
```

Codec settings live in `remotion.config.ts`: H.264 in MP4, `yuv420p`, CRF 16,
PNG intermediate frames. PNG rather than JPEG matters here — the artwork is flat
colour on pure black, and JPEG chroma subsampling visibly softens the one-pixel
segment gaps.

4K renders are heavy. `--concurrency=N` and `--jpeg-quality` trade time for size
and quality; `--frames=0-29` renders a short slice for a quick look.

## How it works

Three files under `src/waveform/`:

**`noise.ts`** — bar heights. The reference does not scroll: neighbouring bars
are correlated and each bar drifts on its own, so the heights come from 2D value
noise sampled over (bar, time). Both axes of the lattice wrap, and the clip spans
exactly one revolution of the time axis, which is what makes the loop seamless
rather than cross-faded. Three octaves are summed, then the whole field is
normalised against its own extremes so any seed uses the full height range.

The octave weights were fitted to two statistics measured off the reference —
mean height step between neighbouring bars (1.30 segments) and mean step of one
bar between frames (0.11). A `skew` exponent counteracts value noise's tendency
to pile up around its midpoint, restoring the reference's mean bar height of
21.2 of 40 segments.

Spatial frequencies are expressed in screen widths, not bars, so the white
variant's denser grid resolves the _same_ hills more finely instead of shrinking
them. Both variants therefore show the same waveform in two styles.

**`theme.ts`** — palettes. The important property, measured off the reference, is
that the colour ramp is **absolute**: a segment's colour depends on how high it
sits on the canvas, not on how tall its own bar is. Two bars of different heights
share the same colour at the same row. Sampling the reference gives a ramp that
is linear per channel with two knees, where blue then green clip at 255:

```
R = 20 + 5.20 × row     G = min(255, 114 + 6.25 × row)     B = min(255, 231 + 5.00 × row)
```

The only per-bar colour is the peak cap — the topmost lit segment, blended
toward white, more so on taller bars.

**`Waveform.tsx`** — the renderer. Every dimension derives from the composition
size, so one set of props is pixel-proportional at 4K, 1080p, or the reference's
960×540; only `width`/`height` change. Each bar is one gradient rectangle painted
at full canvas height and clipped by the bar's height (this is what keeps the
ramp absolute), then a single full-bleed overlay of background-coloured stripes
slices every bar into segments at once — sharper and far cheaper than emitting a
div per segment.

## Tuning

Everything adjustable lives in the `defaultProps` in `src/Root.tsx`: `bars`,
`rows`, `barRatio` and `cellRatio` (bar/segment size as a fraction of their
pitch), `minFill`/`maxFill` (shortest and tallest bar), `skew`, and `seed` —
change the seed for a different waveform with identical character. Colours are in
`src/waveform/theme.ts`. All of it is live-editable in Remotion Studio.
