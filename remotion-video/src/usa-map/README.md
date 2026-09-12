# North America Data Map

A 10-second (300 frame @ 30fps) motion graphic: North America rendered as a
dot-matrix landmass on a tilted ground plane, lit by city hotspots with
vertical light shafts, connected by a network of route arcs, drifting under a
slow push-in.

Ships in two colour grades, each at 1080p and 4K:

| Composition                   | Size      | Grade                                     |
| ----------------------------- | --------- | ----------------------------------------- |
| `NorthAmericaDataMapSignal`   | 1920x1080 | Signal Blue — blue land, amber hotspots   |
| `NorthAmericaDataMapCyan`     | 1920x1080 | Deep Cyan — teal land, deep-blue hotspots |
| `NorthAmericaDataMapSignal4K` | 3840x2160 | Signal Blue                               |
| `NorthAmericaDataMapCyan4K`   | 3840x2160 | Deep Cyan                                 |

The 4K compositions are not upscales. Every authored dimension is defined at 1x
(1080p) and multiplied by `resolutionScale`, so at 4K the coastlines, dot
lattice and arcs are re-rasterised at full resolution.

## Rendering

```console
npm run render:map            # 1080p, Signal Blue
npm run render:map:cyan       # 1080p, Deep Cyan
npm run render:map:4k         # 4K,    Signal Blue
npm run render:map:cyan:4k    # 4K,    Deep Cyan
```

## How it is built

**Geography is real.** Coastlines come from Natural Earth via `world-atlas`
(1:50m countries) and internal borders from `us-atlas` (1:10m US states).

**The data is baked at build time.** `scripts/build-geo-data.mjs` projects that
geography through a d3 Mercator into flat "map space", scanline-fills the
landmass on a lattice to produce ~20k dots, generates the route network, and
writes everything to `data/map-data.json`. Re-run it with:

```console
npm run build:geo
```

This keeps `d3-geo`/`topojson-client` as devDependencies — they never reach the
browser bundle — and keeps per-frame work free of point-in-polygon tests.

**The plane is projected, not CSS-transformed.** `camera.ts` lifts map space
onto a tilted 3D plane and projects it back. Because the camera orbits a point
on that plane, the transform collapses to:

```
depth = dist + wy * cos(pitch)
viewX = wx
viewY = wy * sin(pitch)
```

Doing this in JS rather than with a CSS 3D transform means every element shares
one coordinate system — which is what lets the city light shafts stand upright
in screen space while sitting exactly on their projected map position, and lets
dots, arcs and ping rings foreshorten correctly.

**Everything draws to one canvas.** `draw.ts` composites the layers additively
(`globalCompositeOperation = "lighter"`) so overlapping glows accumulate, then
applies bloom by blitting the frame to a quarter-size buffer and drawing it
back blurred. Land dots are blitted from six cached sprites — one per
brightness bucket — rather than built as 20k arc paths every frame.

## Tuning

Camera pose, framing and the look constants live in `constants.ts`; the two
palettes live in `themes.ts`. Both compositions read the same geometry, so a
change to `constants.ts` affects every variant.
