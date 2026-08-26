# Candlestick Macro — Remotion

A 4K macro shot of a candlestick chart on an off-axis screen, in two versions
that share one codebase: a **volatile bearish decline** and an **orderly bullish
advance**. Both are 744 frames at 30fps (24.8s) at 3840×2160, and both are
seamless loops.

## Compositions

| Composition id | Variant | Character |
| --- | --- | --- |
| `CandleMacroBear` | `bear` | Volatile, choppy decline — short runs, frequent reversals, long wicks, one capitulation, two failed rallies. Trend line above the price. |
| `CandleMacroBull` | `bull` | Orderly advance — long runs, calm bar-to-bar, clean bodies, one mid-tile consolidation, two brief sharp pullbacks. Trend line below the price. |

Both are registered in `src/Root.tsx` at `744` frames / `30` fps / `3840×2160`,
differing only by the `variant` prop.

## Render commands

```bash
# previews (half scale)
npx remotion render CandleMacroBear out/candle-bear-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render CandleMacroBull out/candle-bull-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

# full 4K masters
npx remotion render CandleMacroBear out/candle-bear.mp4 --codec=h264 --crf=12
npx remotion render CandleMacroBull out/candle-bull.mp4 --codec=h264 --crf=12
```

`--concurrency` must not exceed the machine's CPU core count; Remotion rejects a
higher value. Drop the flag to let Remotion pick.

Interactive preview: `npx remotion studio`.

## Verifying the loop

```bash
node scripts/verify-loop.mjs                  # both compositions
node scripts/verify-loop.mjs CandleMacroBear  # one
```

The script renders frame 0 and frame 744 at full 4K and compares the PNG bytes.
Remotion will not render frame 744 of a 744-frame composition, so the script
overrides the duration to 745 for the probe only — the registered compositions
are untouched. Both currently pass byte-identical.

## How it is built

```
src/
  theme.ts               THEMES — every colour in the project, and nothing else has a hex literal
  config.ts              per-variant knobs + chart, depth-of-field and finish geometry
  series.ts              seeded price-series construction and the forming-candle model
  paint.ts               camera matrix, depth-of-field field, three-buffer Painter
  draw.ts                focus-bucketed primitives (segmented lines, rects)
  tiling.ts              places the tiled series, applies the forming treatment
  scene.ts               the per-frame scene handed to each layer
  CandleMacro.tsx        canvas, buffer composite, bloom / vignette / grain
  layers/
    GridLayer.tsx        faint rules + the dashed price marker
    TrendLine.tsx        the low-contrast diagonal
    VolumeBars.tsx       bottom-third volume
    CandleSeries.tsx     the candles
    PriceLadder.tsx      the order-book column
scripts/verify-loop.mjs  frame 0 vs frame 744 byte comparison
```

**Determinism.** Every value comes from Remotion's `random()` with a stable
string seed; there is no `Math.random()`, `Date.now()`, `requestAnimationFrame`,
CSS animation or component state anywhere. All motion is a function of
`useCurrentFrame()`. The price series is built once in a `useMemo` and reused —
regenerating it per frame would make the chart strobe.

**Rendering.** Everything is drawn to a single `<canvas>` with a 3840×2160
backing store, via a ref. The five layers are real components; each registers a
draw op with an explicit z-index rather than relying on effect ordering, and the
parent runs them in order and composites.

**Depth of field.** A focal band runs through the chart's mid-left, falling off
toward the right edge, the top and the bottom, to a 30px maximum. It is
implemented with three offscreen buffers — sharp, mid, far — each blurred
exactly once at composite time; per-element blurring would be unusably slow at
4K. The mid and far buffers use reduced backing stores (0.5× and 0.34×), since
they are blurred to mush anyway. An element straddling two buckets is drawn into
both with complementary alpha, so a scrolling candle cross-fades its blur
instead of popping between levels. Bright elements are boosted before their
buffer is blurred, which is what makes them bloom into soft discs rather than
smeared rectangles.

**Camera.** Rotate, then shear so the right side compresses — strictly affine,
so parallel lines stay parallel. There is no perspective projection and no
camera move.

## Loop arithmetic, and the one place the brief is internally inconsistent

The composition tiles: it scrolls exactly one series width in 744 frames, which
means

```
framesPerCandle = 744 / seriesLength
```

Series length, scroll speed and loop length are therefore a single choice, not
three. The brief asks for ~600 candles, ~70 candles visible, one candle every
~10 frames, and a 744-frame loop; those cannot all hold at once:

- 600 candles tiling in 744 frames is 1.24 frames per candle — a scroll of
  ~42 px/frame at 4K, which strobes.
- One candle per 10 frames over 744 frames traverses 74 candles, which is too
  short to carry a capitulation, two failed rallies and runs of 18–40.

The reference clip settled it. Cross-correlating strips of consecutive frames
puts its scroll at ~312 px/s, i.e. ~10.4 px/frame at 4K. `SERIES_LEN = 150` with
a 52px pitch gives **10.48 px/frame** — within 1% of the reference — and 4.96
frames per candle, with ~70 candles across the frame. 150 candles is long enough
for the full requested narrative to be seen inside one loop.

The same tiling constraint forces the per-candle moves to sum to exactly zero,
so neither version can carry net drift across a loop. The bearish and bullish
readings are therefore carried by structure rather than by direction:

| | bear | bull |
| --- | --- | --- |
| run length | 18–40 candles | 35–75 candles |
| volatility | 1.05 | 0.68 (−35%) |
| wick frequency | 0.88 | 0.53 (−40%) |
| body size | 1.0 | 1.2 (+20%) |
| tilt | −9° | −6° |
| ladder flashes | ~3/s (2–4 band) | ~2/s (1–3 band) |
| dramatic beat | capitulation, 11 candles, much the steepest move in the series | consolidation, 30 small-bodied candles, at the tile's midpoint |
| green / red count | 52 / 48 | 61 / 39 |
| mean body, green vs red | 0.89 vs 1.77 — reds larger | 1.10 vs 0.82 — greens larger |
| trend line | above the price | below the price |

Green and red bodies are separated by a seeded **opening gap** — real candles
open away from the previous close, and a small gap lets the drawn bodies favour
one colour without disturbing the closing path that has to stay net-zero.

Because the loop must return to its start, each version spends part of the tile
retracing. In the bear that is a choppy, low-conviction grind off the
capitulation low; in the bull it is split across two orderly, low-volatility
give-back legs, which also keeps the price wandering through the middle of the
band rather than parking against the top for half the loop.

The palette is identical in both versions, by design: the bullish feel comes
from more green candles and larger green bodies, not from re-tinting the chart.

## Notes

- No axis labels, legends, logos, watermark or audio. `Config.setMuted(true)` in
  `remotion.config.ts` stops Remotion attaching a silent audio track.
- `remotion.config.ts` points Remotion at a locally installed Chromium if one is
  present; delete that block to let Remotion download its own.
