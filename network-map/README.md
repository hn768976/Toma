# Network Map

A 4K "network map" animation built with Remotion: a dotted land map with arcing
connection paths that draw on, pulse, carry travelling dots, fade and redraw on
a seamless 20-second loop.

## Compositions

| Composition id     | Resolution  | Duration            | FPS |
| ------------------ | ----------- | ------------------- | --- |
| `NetworkMapGlobal` | 3840 × 2160 | 600 frames / 20.0 s | 30  |

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
at twice the intended apex height. Apex height scales with endpoint distance and
is clamped per variant, so long routes arc high and short hops stay shallow. The
draw-on is a canvas line dash the length of the whole path with the offset
easing to zero on `Easing.out(Easing.cubic)`.

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
