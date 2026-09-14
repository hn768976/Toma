# Market Arrow — two financial motion graphics

Two 30 fps compositions built to match a pair of reference stock plates,
each registered at **3840×2160 (4K, the authoring master)** and at
**1920×1080 (the delivery cut)**.

| Version | Composition (4K) | Composition (1080p) | Length | Frames |
| --- | --- | --- | --- | --- |
| **V1 — Downturn** | `MarketDownturn4K` | `MarketDownturn1080` | 10.0 s | 300 |
| **V2 — Rally** | `MarketRally4K` | `MarketRally1080` | 12.0 s | 360 |

## Rendering

```console
npm run render:v1        # 1080p H.264 -> out/market-downturn-v1_1080p.mp4
npm run render:v2        # 1080p H.264 -> out/market-rally-v2_1080p.mp4
npm run render:v1:4k     # 4K   H.264 -> out/market-downturn-v1_4k.mp4
npm run render:v2:4k     # 4K   H.264 -> out/market-rally-v2_4k.mp4
```

`--image-format=png --crf=17` is used throughout: these are dark,
gradient-heavy plates and the default JPEG intermediate bands visibly in
the background falloff. `--muted` keeps the container video-only — these
are silent graphics, and without it Remotion writes a silent AAC track
that makes the container run slightly longer than the video.

## How the two resolutions stay in sync

Everything under this folder is authored in **stage units** — a fixed
1920×1080 design space defined in `constants.ts`. `<Stage>` applies a
single uniform `scale()` to map that space onto the composition's real
resolution, so the 4K composition is a pixel-exact 2× blow-up of the
1080p one. There is one layout, one set of keyframes, and no chance of
the two drifting apart.

The only prop either scene takes is `resolutionScale` (2 for 4K, 1 for
1080p). To add, say, a 1440p cut, register a third `<Composition>` at
2560×1440 with `resolutionScale: 4 / 3` — nothing else changes.

## What each version does

**V1 — Downturn.** A finite 96-rung ruler scrolls upward past a plunging
arrow while the readout falls from -1,000 to about -79,000, at the
reference's near-constant ~8,000/second. The grid is a tilted 3D backdrop
that de-rotates and settles; the ruler and arrow are a screen-aligned
overlay easing out of a slight push-in, so they read as an interface over
the plane rather than painted onto it. Colour is driven by one severity
ramp shared by the arrow gradient and the numbers — numbers lower in
frame and later in time read hotter, which is what turns the whole plate
from cyan through pink to molten red. The ruler's tail (with its
terminating arrowhead) is timed to glide into the lower third on the very
last frame.

**V2 — Rally.** A quasi-log "ladder" (10, 20, 50, 75 … 5.000, drawn at
even spacing regardless of the arithmetic gaps, as the reference does)
with a climbing arrow and a glowing tick chart over a world map. The
camera pulls back and pans up simultaneously — the ladder compresses from
~300 px per rung to 185 px while the frame climbs from rung 1.8 to rung
9.3 — so the chart keeps outrunning the scale it is drawn against. The
backdrop map drifts at half camera speed for parallax and fades up only
once the pull-back is wide enough for it to read as a globe.

## Determinism

Both the V1 ticker values and the V2 chart shape are precomputed once at
module scope from a seeded PRNG (`series.ts`). Remotion renders frames
out of order across workers, so anything derived from `Math.random()`
per frame would flicker between frames.

## Files

| File | Role |
| --- | --- |
| `constants.ts` | Timing, geometry, palettes. Start here to re-time or re-skin. |
| `series.ts` | The deterministic ticker values and trend-line shape. |
| `palette.ts` | Colour-ramp sampling and the two number formatters. |
| `Stage.tsx` | Stage-unit scaling, the depth-of-field trick, vignette. |
| `Grid.tsx` | Tiled grid, optionally laid back in 3D. |
| `MarketArrow.tsx` | The hero arrow, shared by both versions. |
| `DownturnRuler.tsx` / `DownturnScene.tsx` | V1. |
| `RallyLadder.tsx` / `TrendLine.tsx` / `WorldMap.tsx` / `RallyScene.tsx` | V2. |
