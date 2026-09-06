# Symbol Globe — "question"

A 4K rotating dot globe with a neon question mark held in front of it, built in
Remotion as a seamless 15-second loop. Everything is drawn on a single 2D
canvas; there is no 3D and no Three.js.

## Composition

| | |
|---|---|
| Composition id | `GlobeQuestion` |
| Resolution | 3840 × 2160 (4K UHD) |
| Duration | 450 frames |
| Frame rate | 30 fps |
| Length | 15.0 s |
| Loops | Yes — seamlessly |

The loop is exact, not approximate. The globe completes precisely one
revolution across the 450 frames, and every drift path and brightness pulse
runs a whole number of cycles over the same span. This was verified by
rendering frame 0 and frame 450 of the same 450-frame cycle at full 4K and
confirming the two PNGs are byte-identical.

## Getting started

```bash
npm install
npm run dev        # opens Remotion Studio
```

## Rendering

Final 4K render:

```bash
npx remotion render GlobeQuestion out/globe-question.mp4 --codec=h264 --crf=12 --concurrency=8
```

A faster 1080p preview:

```bash
npx remotion render GlobeQuestion out/globe-question-preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

`--concurrency` must not exceed the machine's CPU core count; Remotion will
refuse the render otherwise. Drop it to match your machine if 8 is too many.

## Map data

`public/land-110m.json` holds world land polygons at 1:110m scale, as TopoJSON.

- **Source:** [Natural Earth](https://www.naturalearthdata.com/), version 4.1.0,
  1:110m small-scale land vectors.
- **Status:** Natural Earth map data is released into the **public domain**. It
  carries no licensing restrictions and needs no attribution, though Natural
  Earth asks to be credited where practical.
- **Redistribution:** the file is the `land-110m.json` build from
  [world-atlas](https://github.com/topojson/world-atlas) v2.0.2, which converts
  the Natural Earth shapefiles to TopoJSON. That packaging is ISC-licensed
  (© 2013–2019 Michael Bostock); the underlying geometry remains public domain.

## How it is put together

```
src/
  Root.tsx              composition registration
  SymbolGlobe.tsx       assembles the layers and owns the loop
  variants.ts           palette, centre glyph, field set, lattice density
  config.ts             timing and geometry (no colours)
  stage/CanvasStage.tsx one canvas, many layer components
  components/           BackgroundWash, NetworkLines, GlyphField,
                        DotGlobe, CentreGlyph, PostFx
  lib/                  reusable pieces: ribbon, glyphPaths, neonStroke,
                        dotMapFromLand, bloom/grain/vignette passes,
                        seeded random helpers, colour helpers
```

`variants.ts` is the only file in the project containing a colour value or a
glyph choice. Everything downstream reads from it, so a new version of the piece
means a new entry there and nothing else.

### The globe

A d3-geo **orthographic** projection, which gives a true sphere with the far
hemisphere correctly clipped rather than folded back over the near one.

Land dots are sampled on an **angular** lat/lon grid whose longitude count
scales with cos(latitude). Sampling evenly in screen space instead would crowd
dots at the sphere's edge, which reads as a flat disc with a bright rim; a plain
uniform lat/lon grid would crowd them at the poles.

The land test runs against a rasterised equirectangular bitmap rather than the
polygons themselves, making it an array lookup per candidate point instead of a
point-in-polygon scan over ~130 rings. Because neither the sample grid nor the
land test depends on rotation, both are computed once. Per frame the only work
is projecting and culling.

Curvature is sold by foreshortening. For an orthographic projection the cosine
of a point's angle from the camera axis falls straight out of its screen radius,
so dots are scaled and faded by it with no extra trigonometry.

### The centre glyph

Drawn as a **stroked outline**, never filled, so the globe stays visible turning
through the middle of it. Canvas 2D cannot taper a stroke, so `lib/ribbon.ts`
expands a centreline into a closed variable-width contour, which is then stroked
in four additive passes — a wide atmospheric haze, a tighter glow, a bright mid
channel, and a thin near-white core.

### Determinism

Every frame is a pure function of the frame number. There is no
`requestAnimationFrame`, no `Date.now()`, no CSS animation and no component
state driving motion; the canvas is redrawn exactly once per React render.
All randomness goes through Remotion's seeded `random()` with stable string
seeds, never `Math.random()`. Frames can therefore be rendered out of order and
across processes and still come out identical.

## Contents

No audio, no text, no logos and no watermark.
