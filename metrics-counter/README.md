# Social Metrics Counter

Two versions of an oversized-type metrics counter on an angled, shallow-focus
gridded plane. Compositions are defined at **3840×2160, 30 fps, 600 frames
(20s)**. Not a loop — the counters run up from zero and the clip ends near their
peak, still climbing.

| Composition ID            | Look                                            |
| ------------------------- | ----------------------------------------------- |
| `V1-MetricsCounterLight`  | Near-black type on warm white gridded paper      |
| `V2-MetricsCounterDark`   | White type on near-black, dim grid, glow + grain |

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

Both compositions are authored at 4K, so a full-resolution render is just
`--scale=1`:

```bash
npx remotion render V1-MetricsCounterLight out/V1_MetricsCounterLight.mp4 --scale=1 --crf=16
npx remotion render V2-MetricsCounterDark  out/V2_MetricsCounterDark.mp4  --scale=1 --crf=16
```

Stills (frame 550, where the numbers are high):

```bash
npx remotion still V1-MetricsCounterLight out/V1_MetricsCounterLight.png --frame=550 --scale=1
npx remotion still V2-MetricsCounterDark  out/V2_MetricsCounterDark.png  --frame=550 --scale=1
```

A 1080p preview is the same render at half scale:

```bash
npx remotion render V1-MetricsCounterLight out/V1_MetricsCounterLight.mp4 --scale=0.5 --crf=18
```

The same commands are wired up as `npm run render:v1`, `render:v2`, `still:v1`,
`still:v2`.

Codec, pixel format (`yuv420p`) and CRF defaults live in `remotion.config.ts`,
along with `setMuted` — both compositions are silent, and without it Remotion
attaches a silent AAC track. Video frames go through PNG rather than JPEG
intermediates: the MJPEG pipe is full-range and would tag the output
`yuvj420p`, and it costs nothing here because the render is bound by Chrome
rasterising the blur stack.

## How it is built

- **`src/Plane.tsx`** — the sheet. Real DOM text under one `perspective`
  container, rotated 12° around X and −8° around Z; nothing is rasterised to
  canvas, so the glyph edges stay clean at 4K. The plane deliberately overfills
  the frame, so the type is cropped on all four sides.
- **`src/FocusStack.tsx`** — the depth of field. Six horizontal slices, each
  re-rendering the whole plane at one blur radius and masked so it paints over
  everything below its start, cross-fading in. The blur is applied before the
  mask, so slice edges carry genuinely blurred neighbouring content. A single
  gradient blur reads as a filter; discrete overlapping slices read as optics.
  The sharp band sits over the *Likes* line and stays put — the plane drifts
  under it.
- **`src/counters.ts`** — the numbers. Pure functions of the frame (Remotion
  renders frames out of order across threads, so no state and no accumulation).
  An exponential ease-out plus a small linear term, which is what keeps all three
  still moving at frame 600. Thousands separators are grouped by hand rather
  than via `toLocaleString`, so the output cannot depend on Chrome's ICU data.
- **`src/layout.ts`** — every dimension as a fraction of composition width or
  height, blur radii included. That is what lets the 1080p preview and the 4K
  render be the same image at two resolutions.
- **`src/Grain.tsx`** — a pre-generated signed noise tile composited normally,
  so the grain amplitude stays roughly constant across the frame instead of
  collapsing on the near-black field the way an `overlay` blend does.

## Fonts

Inter Black is embedded at `public/fonts/Inter-Black.woff2` (SIL Open Font
License 1.1) rather than pulled from a CDN or left to a system fallback — a
substituted face changes the metrics and the layout is built around glyph widths
at nearly 300px. It carries true tabular figures (`tnum`), without which the
layout jitters every frame as digit widths change.

## Tuning

Most of the look is in `src/layout.ts` and `src/theme.ts`:

- `SLICES` / `FEATHER` — where the plane is sharp and how hard it falls off.
- `FONT_SIZE`, `TEXT_OFFSET_X/Y` — type scale and how far it runs off the edges.
- `METRICS` in `src/counters.ts` — targets and the shape of the climb.
- `LIGHT` / `DARK` in `src/theme.ts` — colour, grain, glow, vignette.
