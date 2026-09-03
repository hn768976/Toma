# Binary World Map

A 4K "binary world map": the continents are not filled with colour, they are
filled with ones and zeroes. The digit grid is clipped to the land geometry, so
every coastline is defined purely by where the text stops. Straight near-white
sightlines cross the frame, white nodes sit on their intersections, invented
technical callouts annotate them, and the whole composition drifts slowly
forward across fifteen seconds.

## Composition

| | |
|---|---|
| Composition id | `BinaryWorldMap` |
| Resolution | **3840 x 2160 (4K UHD)** |
| Duration | 450 frames |
| Frame rate | 30 fps |
| Length | 15.0 seconds |
| Loop | **No.** This is a one-shot piece — the push-in progresses for the whole duration and does not reset, so frames 0 and 450 differ by design. Do not loop it. |
| Props | `variant`: `"blue"` (default), `"amber"`, `"jade"` |

## Install and run

```bash
npm install
npm run dev          # Remotion Studio
```

## Render

4K, the delivery render:

```bash
npx remotion render BinaryWorldMap out/binary-map.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

1080p preview (half scale):

```bash
npx remotion render BinaryWorldMap out/binary-map-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

Lower `--concurrency` to the number of CPU cores available if Remotion rejects
the value.

## Map data

`public/land-110m.json` is Natural Earth 1:110m land, packaged as TopoJSON by
[world-atlas](https://github.com/topojson/world-atlas). Natural Earth is in the
**public domain**; no attribution, permission or licence fee is required. See
<https://www.naturalearthdata.com/about/terms-of-use/>.

Antarctica is dropped at load time (`CONFIG.map.southLimit`): polygons lying
entirely south of -55 degrees are filtered out.

## Fonts

Share Tech Mono. The family name and CDN URL come from
`@remotion/google-fonts`; a byte-identical copy of the same woff2 is shipped in
`public/fonts/` and is used automatically if the CDN is unreachable, so the
project renders offline. Loading is gated with `delayRender()` /
`continueRender()`.

## Layout

```
src/
  Root.tsx                 composition registration
  BinaryMap.tsx            the composition: layer stack, push-in, finish
  config.ts                every tunable — digit metrics, counts, push-in, finish
  theme.ts                 every colour, per variant. No hex literals elsewhere.
  fonts.ts                 monospace loading, render-gated
  components/
    BinaryLandFill.tsx     land glow + digit field + bloom
    ConnectionLayer.tsx    straight sightlines and travelling highlights
    ContourLayer.tsx       drifting grey background curves
    NodeMarker.tsx         one node: core, halo, pulse, flash
    CalloutLabel.tsx       one callout: leader line, text block, big number
    StarField.tsx          sparse background points
    OverlayLayer.tsx       SVG host for the nodes and callouts
  scene/geometry.ts        seeded generation of lines, nodes, contours, callouts
  lib/                     subject-agnostic, reusable pieces (see below)
```

`src/lib/` is vendored so this project is standalone:

| Module | What it is |
|---|---|
| `TextFillMask.tsx` | Fills an arbitrary shape with a dense character field clipped to it, rerolling a trickle of characters over time. The core of the piece. |
| `mask-field.ts` | Rasterised shape mask with an O(1) point-in-shape test. |
| `glyph-atlas.ts` | Offscreen sprite sheet of a character set, one row per colour. |
| `natural-earth.ts` | Natural Earth TopoJSON loader, render-gated, Antarctica filter. |
| `projection.ts` | d3-geo equirectangular pinned by explicit centre and scale. |
| `catmull-rom.ts` | Smooth spline through control points, open or closed. |
| `seeded.ts` | Seeded random helpers over Remotion's `random()`. |
| `color.ts` | Hex mixing and alpha. |
| `use-canvas.ts` | Canvas ref that draws once per React render. |
| `BloomLayer.tsx` | Additive bloom of a source canvas, blurred at 1/4 scale. |
| `FilmGrain.tsx` | Frame-cycled noise tiles as a repeated background. |
| `Vignette.tsx` | Radial edge darkening. |

## Determinism

Every frame is a pure function of `useCurrentFrame()`. There is no `Date.now()`,
no `requestAnimationFrame`, no CSS animation and no state driving motion, and
all randomness goes through Remotion's `random()` with stable string seeds — so
the digit field and the node positions are identical on every render and frames
may be rendered out of order across workers.

`<TextFillMask>` keeps a persistent buffer and, when asked for the frame
immediately after the last one it drew, repairs only the handful of cells that
changed. Any other frame triggers a full redraw that reconstructs the same
state by replaying the reroll stream from zero, so the fast path is a cache and
never a source of truth.

No audio, no watermark, no real place names and no coordinates that resolve to
any real location.
