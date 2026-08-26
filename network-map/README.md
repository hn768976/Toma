# Network Map

A 4K "network map" animation built with Remotion: a dotted land map with arcing
connection paths that draw on, pulse, carry travelling dots, fade and redraw on
a seamless 20-second loop.

## Compositions

| Composition id     | Resolution  | Duration            | FPS |
| ------------------ | ----------- | ------------------- | --- |
| `NetworkMapGlobal` | 3840 × 2160 | 600 frames / 20.0 s | 30  |

`NetworkMapGlobal` draws six routes across twelve distinct cities, graded from
roughly 2400px down to 980px so no two arcs are the same size. Three of the six
are declared east-to-west, so half the network draws right to left.

## Render

```bash
npm install

# Half-scale preview
npx remotion render NetworkMapGlobal out/network-global-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

# Full 4K
npx remotion render NetworkMapGlobal out/network-global.mp4 --codec=h264 --crf=12
```

## Layout of the project

```
src/
  Root.tsx              composition registration
  NetworkMap.tsx        the component both variants share
  config.ts             per-variant viewport, dot pitch, endpoints, arc styling
  theme.ts              THEMES - the only place a colour literal exists
  components/           BackgroundWash, DotMap, ArcLayer, NodePulse, FilmFinish
  lib/                  projection, land mask, dot generator, arcs, timing
public/
  land-50m.json         Natural Earth 50m land + lake outlines (public domain)
scripts/
  prepare-land.mjs      regenerates public/land-50m.json from Natural Earth
```

## How it works

**The dot map** is generated at render time, not hand-drawn. `lib/land-mask.ts`
scanline-samples the Natural Earth outline against the variant's lat/lon
bounding box at the configured dot pitch, and `lib/dot-map.ts` turns the
resulting grid into one dot per land cell. The viewport box and the pitch are
the only geographic inputs, so a regional variant is the same generator pointed
at a tighter box. The map is static, so it is rasterised once into an offscreen
canvas and blitted every frame.

**The arcs** are quadratic beziers whose control point sits above the midpoint
at twice the intended apex height. Apex height scales with endpoint distance,
then is capped at whatever headroom the map's top edge leaves, so a long route
near the top flattens rather than arcing out of the map. The draw-on is a canvas
line dash the length of the whole path with the offset easing to zero on
`Easing.out(Easing.cubic)`.

Three properties of the arc set are invariants enforced at build time in
`lib/arcs.ts`, not conventions to be maintained by hand:

- **Nothing leaves the map.** Endpoints are clamped into the projected map box,
  the apex is capped as above, and an exact bezier bounding-box check shrinks
  the control point toward the chord if anything still escapes.
- **No two arcs meet at a point.** Every endpoint in a variant's route list must
  be unique; a reused one throws.
- **No stub arcs.** Any route shorter than the variant's `minArcLength` throws.

Each arc also takes its own colour from `ARC_PALETTE`, so no two arcs in a frame
share one - which caps a variant at as many arcs as there are palette entries.

A route's `from` -> `to` order is its direction of travel: the draw-on starts at
`from`, the travelling dots ride toward `to`, and `to` is the endpoint whose
pulse fires on completion. Reversing a route in the config is all it takes to
flip the direction it draws.

**The loop closes** because every periodic quantity divides 600: arc cycles are
600 or 300 frames, travelling-dot laps are 150, 200 or 300, and the camera drift
and background wash both run on closed paths parameterised by `frame / 600`.
The grain is seeded on `frame % 600`. `lib/arcs.ts` asserts the divisibility at
module load. Frames 0 and 600 render byte-identical.

All motion is derived from `useCurrentFrame()`, all randomness from Remotion's
`random()` with stable string seeds. There is no `Date.now()`, no
`requestAnimationFrame`, no CSS animation and no component state driving motion.

## Map data

`public/land-50m.json` is derived from the [Natural Earth](https://www.naturalearthdata.com/)
50m physical vectors (`ne_50m_land`, `ne_50m_lakes`), which are public domain.
Run `node scripts/prepare-land.mjs` to rebuild it from source.
