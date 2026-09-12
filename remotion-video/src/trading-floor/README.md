# Trading Floor

A 2×2 wall of trading-terminal windows — depth ladder, time & sales,
sector gauges, intraday curve, a candlestick chart and six columns of
tape — rebuilt as a Remotion composition from a reference clip.

- **30 fps, 509 frames (16.967 s)** — the reference is 16.96 s, and 509
  frames is the closest whole-frame match at 30 fps.
- **Two themes**: `dark` (matches the reference) and `light`.
- **Two resolutions**: 1080p deliverable and a 4K master.

## Compositions

| Composition ID              | Size      | Theme |
| --------------------------- | --------- | ----- |
| `TradingFloor-Dark-1080p`   | 1920×1080 | dark  |
| `TradingFloor-Light-1080p`  | 1920×1080 | light |
| `TradingFloor-Dark-4K`      | 3840×2160 | dark  |
| `TradingFloor-Light-4K`     | 3840×2160 | light |

## Rendering

```console
npx remotion render TradingFloor-Dark-4K out/trading-floor-dark-4k.mp4 \
  --codec=h264 --crf=15 --muted
```

Drop `--muted` only if you add an audio track; the piece has none, and
without the flag Remotion muxes a silent AAC stream that stretches the
container past the video duration.

4K renders are roughly 4× the work of 1080p. `--concurrency=N` and
`--scale` are the usual knobs if a machine is tight on memory.

## How it is put together

**One design space.** Every panel is laid out in a fixed 1920×1080
coordinate system (`constants.ts`). `components/Stage.tsx` applies a CSS
transform to fit that space to the composition size, so the 4K
compositions re-rasterise every glyph and vector at full density rather
than upscaling a 1080p frame — and the two resolutions cannot drift apart,
because they are the same layout code.

**Every frame is a pure function of the frame number.** There is no
`useState`, no `Math.random()` at render time and no wall-clock read.
`data/random.ts` supplies a seeded PRNG and a stateless hash noise; the
tape and the blotter are generated once per clip and sampled with a binary
search (`data/tape.ts`). Renders are therefore deterministic and safe to
distribute across machines.

**The tape starts full.** Print streams begin at negative frame numbers so
the columns are already populated at frame 0 — a tape that fills from
empty reads as a page load, not as a market.

**Arrivals are bursty, not metronomic.** Rows land 1–2 frames apart inside
a burst and then pause, which is what makes the columns feel alive instead
of looking like a marquee.

## Tuning

The composition takes props (editable live in the Remotion studio):

| Prop                 | Default | Effect                                     |
| -------------------- | ------- | ------------------------------------------ |
| `theme`              | —       | `dark` or `light`                          |
| `tapeRowsPerSecond`  | 10      | arrival rate in each of the six tape columns |
| `salesRowsPerSecond` | 7       | arrival rate in the time & sales blotter   |
| `screenTexture`      | `true`  | vignette, scanlines, bloom and bezel seams |

Colours live in `theme.ts` — both palettes are defined side by side, so a
brand recolour is one file.

## Data

Every symbol is invented (`data/symbols.ts`) and every price, volume and
gauge value is synthetic. Nothing here is market data.
