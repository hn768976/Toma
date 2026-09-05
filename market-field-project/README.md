# Market Chart Field

A seamlessly looping 4K market-chart background: two glowing area charts
crossing over a faint continental map, with candlestick bokeh drifting through
the foreground. Built with [Remotion](https://remotion.dev).

Two colourways, same composition:

| Composition id           | Look                                             |
| ------------------------ | ------------------------------------------------ |
| `V1-MarketFieldViolet`   | Violet + pink. Abstract, editorial, reads as "markets" without claiming direction. |
| `V2-MarketFieldGreenRed` | Green + red. The conventional up/down finance palette. |

Both are 3840 x 2160, 30 fps, 600 frames (20s), and loop with no cross-fade.

## Setup

```bash
npm install
npx remotion studio
```

## Rendering

The compositions are defined at 4K, so a full-resolution master is just
`--scale=1`:

```bash
npx remotion render V1-MarketFieldViolet out/V1_MarketFieldViolet.mp4 --scale=1 --crf=16
npx remotion render V2-MarketFieldGreenRed out/V2_MarketFieldGreenRed.mp4 --scale=1 --crf=16
```

(`npm run render:v1` / `npm run render:v2` are the same two commands.)

H.264, `yuv420p` and CRF 16 come from `remotion.config.ts`; frames are captured
as PNG so the dark gradients do not take a second lossy pass on the way into
the encoder.

A 1080p preview is the same command with `--scale=0.5`:

```bash
npx remotion render V1-MarketFieldViolet out/V1_MarketFieldViolet.mp4 --scale=0.5 --crf=16
```

Stills:

```bash
npx remotion still V1-MarketFieldViolet out/V1_MarketFieldViolet.png --frame=300 --scale=0.5
```

**Check the encoded file, not the studio preview.** The fills are exactly the
kind of wide, dark, low-contrast gradient that bands in H.264, which is what
the grain layer exists to prevent.

## How the loop works

Everything that moves is a pure function of the frame, and every periodic term
completes a whole number of cycles over the 600-frame composition:

- **Series data.** Values are a function of `index mod CYCLE_LENGTH` (300).
  Over 600 frames the window scrolls by `SCROLL_POINTS_PER_LOOP` (300) points —
  a whole multiple of the cycle — so frame 600 samples exactly what frame 0 did.
  Nothing accumulates and nothing drifts.
- **Series shape.** The rising/falling envelopes are functions of *screen*
  position, not of data index. That is what lets a series read as "rising to
  the right" while still being periodic: the compositional shape stays put and
  the jagged data scrolls through it.
- **Bars.** Vertical travel wraps a whole number of times per loop; sway and
  flicker use whole-cycle sinusoids.
- **Shimmer and grain.** Whole-cycle sinusoids and a 12-variant grain cycle
  (600 / 12 = 50).

Because Remotion renders frames out of order and across threads, no part of the
animation may hold state between frames. Randomness comes from a seeded
mulberry32 / integer hash (`src/random.ts`) evaluated fresh for each frame.

## Layout

```
src/
  Root.tsx              compositions (both colourways)
  MarketField.tsx       layer stack, back to front
  config.ts             every tunable; sizes as fractions of the frame
  palettes.ts           V1 and V2 colour definitions
  series.ts             pure, periodic series generation
  random.ts             mulberry32 + integer hash
  color.ts              hex helpers
  components/
    Background.tsx      near-black field with a slight centre lift
    WorldMap.tsx        static continental silhouette
    ChartLayer.tsx      SVG areas, additive overlap, strokes and bloom
    FloatingBars.tsx    canvas bokeh candlesticks
    Vignette.tsx
    Grain.tsx           additive dither, ~2%
  map/
    land-paths.ts       generated map path data
scripts/
  build-map.mjs         regenerates land-paths.ts from Natural Earth
```

Sizes and stroke widths are fractions of the frame from `useVideoConfig()`, so
the 1080p preview is the same composition as the 4K master rather than an
approximation of it.

## Map data

`src/map/land-paths.ts` is generated from Natural Earth 1:110m land polygons,
which are **public domain** — no third-party map tile or stock map graphic is
embedded anywhere in this project. To regenerate it, download
`ne_110m_land.geojson` from
[natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) and run:

```bash
node scripts/build-map.mjs path/to/ne_110m_land.geojson
```

The script projects the polygons equirectangularly, simplifies them with
Ramer-Douglas-Peucker, drops Antarctica and anything too small to read, and
writes the result as SVG path strings.

## Notes

There are no numerals, axis labels, ticker symbols or dates anywhere in the
frame, and no watermark, logo or brand mark. The series are procedural noise —
they are not, and do not depict, real market data.
