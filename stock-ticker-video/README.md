# Stock Ticker Chart — intraday sweep (Remotion)

Three versions of a financial-terminal intraday chart: a jagged price series
drawn behind a vertical playhead that scrubs left to right while the change,
percentage and session clock track it.

All three compositions are **defined at 3840×2160, 30 fps, 450 frames (15s)**
and are **4K-render-ready**. They are not loops — the playhead reaches the
right edge at frame 420 and the completed chart holds to frame 450.

| Composition id | Version |
|---|---|
| `V1-TickerDeclineDark` | Red decline, dark theme |
| `V2-TickerRallyDark` | Green rally, dark theme |
| `V3-TickerDeclineLight` | Red decline, light theme |

## Setup

```bash
npm install
npx remotion studio
```

## Render at 4K

```bash
npx remotion render V1-TickerDeclineDark out/V1_TickerDeclineDark.mp4 --scale=1 --crf=16
npx remotion render V2-TickerRallyDark   out/V2_TickerRallyDark.mp4   --scale=1 --crf=16
npx remotion render V3-TickerDeclineLight out/V3_TickerDeclineLight.mp4 --scale=1 --crf=16
```

Add `--muted --pixel-format=yuv420p --color-space=bt709` for a broadcast-safe
file with no silent audio track — that is how the 1080p previews were made:

```bash
npx remotion render V1-TickerDeclineDark out/V1_TickerDeclineDark.mp4 \
  --scale=0.5 --codec=h264 --crf=18 --pixel-format=yuv420p --muted --color-space=bt709
```

Stills (frame 440, chart complete):

```bash
npx remotion still V1-TickerDeclineDark out/V1_TickerDeclineDark.png --frame=440 --scale=1
```

`--scale` multiplies the 4K composition: `1` renders 3840×2160, `0.5` renders
1920×1080. Every size in the project is a fraction of the frame and every blur
radius is scaled by `unit = width / 3840`, so the two resolutions are the same
image at different sizes.

## Branding

Nothing here refers to a real listed company. The issuer is invented —
ticker `NVX`, "Novaris Systems, Inc." — set in plain type with no logo mark,
and both live in `src/ticker/constants.ts` so they can be swapped in one place.
The session is dated to a future year for the same reason. The price data is
generated from a seeded random walk in `src/ticker/series.ts`; no market data
is used.

## How it is put together

- `src/ticker/series.ts` — seeded random walk with a configured drift and
  scripted shocks. Deterministic, so a given seed always yields the same
  session.
- `src/ticker/geometry.ts` — the single source of truth for the layout, the
  price scale, and the playhead. `playheadAt()` returns both the playhead's
  position and the interpolated series value under it, so the floating readout
  can never disagree with the line beneath it.
- `src/ticker/Chart.tsx` — the series as an SVG `<path>`. The lit portion is
  revealed with `stroke-dasharray` set to the cumulative polyline length at the
  playhead, so the reveal lands exactly under it rather than approximately; the
  gradient fill is clipped to the same x.
- `src/ticker/ScreenOptics.tsx` — the ~8°/2° screen rotation and the shallow
  focus, faked with four stacked copies at increasing blur masked back toward
  the sharp upper-left corner.
- `src/ticker/themes.ts` — the palettes and the per-version data configs.

Fonts are self-hosted in `public/fonts` (Inter, latin subset, SIL Open Font
License) and loaded through `delayRender()`, so a render never waits on the
network. Numbers are set with true tabular figures (`tnum`) so the readout does
not jitter as digits change.
