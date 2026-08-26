# Network Map

A 4K "network map" animation built with Remotion: a dotted land map with arcing
connection paths that draw on, pulse, carry travelling dots, fade and redraw on
a seamless 20-second loop. Two variants of the same component — the map flat on,
and the same map laid back in 3D.

## Compositions

| Composition id     | Resolution  | Duration            | FPS | View                        |
| ------------------ | ----------- | ------------------- | --- | --------------------------- |
| `NetworkMapGlobal` | 3840 × 2160 | 600 frames / 20.0 s | 30  | flat on                     |
| `NetworkMapTilted` | 3840 × 2160 | 600 frames / 20.0 s | 30  | laid back 45°, in 3D        |

Both cover lat −60…78, lon −170…180 at a 14 px dot pitch with 7 px dots — 6,973
land dots — and draw the same six routes over twelve distinct cities, one colour
per arc, three running left-to-right and three right-to-left. Arc lengths are
graded from 2405 px down to 1109 px.

`NetworkMapTilted` is that scene seen from about 45°, as though the map plane
were laid back on a table: the top edge tips away from the viewer and the bottom
edge comes toward it, so the far edge draws down and narrows while the near edge
lifts and spreads. It also carries a slow push-in and a cooler blue background,
so the two read as separate pieces. The scene itself is otherwise identical —
same dots, same routes, same arc colours, same seed, same timing.

## Render

```bash
npm install

# Half-scale previews
npx remotion render NetworkMapGlobal out/network-global-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render NetworkMapTilted out/network-tilted-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

# Full 4K
npx remotion render NetworkMapGlobal out/network-global.mp4 --codec=h264 --crf=12
npx remotion render NetworkMapTilted out/network-tilted.mp4 --codec=h264 --crf=12
```

`--concurrency` cannot exceed the machine's core count; lower it if Remotion
rejects 8.

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
the only geographic inputs, so pointing the generator at a tighter box with a
finer pitch is all a regional variant would need — no code would differ. The map
is static, so it is rasterised once into an offscreen canvas and blitted every
frame.

**The arcs** are quadratic beziers whose control point sits above the midpoint
at twice the intended apex height. Apex height scales with endpoint distance,
then is capped at whatever headroom the map's top edge leaves, so a long route
near the top flattens rather than arcing out of the map. The draw-on is a canvas
line dash the length of the whole path with the offset easing to zero on
`Easing.out(Easing.cubic)`.

Four properties of the arc set are invariants enforced at build time in
`lib/arcs.ts`, not conventions to be maintained by hand:

- **Nothing leaves the map.** Every curve stays inside the map box inset by
  `curveMargin`: the apex is capped as above, and an exact bezier bounding-box
  check shrinks the control point toward the chord if anything still escapes.
- **No line ends on the edge of the map.** Endpoints must sit at least
  `endpointMargin` inside the box, and one that does not is rejected rather than
  quietly clamped onto the boundary — clamping would produce the very thing the
  margin exists to prevent. The margin is larger than `curveMargin` on purpose:
  a long route's apex needs room for a graceful bow and only has to avoid
  running along the boundary, whereas an endpoint has to terminate clear of it.
- **No two arcs meet at a point.** Every endpoint in a variant's route list must
  be unique; a reused one throws.
- **No stub arcs.** Any route shorter than the variant's `minArcLength` throws.
- **No two arcs share a colour.** Each arc takes its own entry from
  `ARC_PALETTE`, which caps a variant at as many arcs as there are colours.

A route's `from` → `to` order is its direction of travel: the draw-on starts at
`from`, the travelling dots ride toward `to`, and `to` is the endpoint whose
pulse fires on completion. Reversing a route in the config is all it takes to
flip the direction it draws.

Routes are also kept away from vertical. The bow always points straight up, so a
near-vertical chord curls into a hook instead of reading as a route.

**The tilt** is presentation only. The dot map, the arcs and the bounds they are
clamped to are all still generated flat, in the same coordinates; `NetworkMap`
then wraps the dot, arc and pulse layers in a CSS `perspective` + `rotateX`,
which the browser renders with correct perspective at full resolution — the dots
foreshorten into ellipses rather than being resampled. The background wash stays
flat so it still fills the frame behind the plane, and the vignette and grain
stay flat because they belong to the camera rather than to the scene. The
untilted variant gets no wrapper at all: an identity transform would still
isolate the layers into their own stacking context and change how they
composite.

The `scale` in the tilt config is set so the near edge does not run off the
sides of the frame, at maximum zoom. Tilting a 2.5:1 map by 45° projects to
roughly 3.5:1, which cannot fill a 16:9 frame and stay whole; the current value
keeps the entire map in frame at the cost of some empty space above and below.

The push-in eases in over the first half of the loop and back out over the
second — `1 + zoom * (1 - cos(2πt)) / 2`. Both the value and its rate of change
are zero at frame 0 and frame 600, so it closes the loop; a one-way zoom could
not.

**The loop closes** because every periodic quantity divides 600: arc cycles are
600 or 300 frames, travelling-dot laps are 150, 200 or 300, and the camera
drift, background wash and tilt push-in all run on closed paths parameterised by
`frame / 600`.
The grain is seeded on `frame % 600`. `lib/arcs.ts` asserts the divisibility at
module load. For both compositions, frames 0 and 600 render byte-identical.

All motion is derived from `useCurrentFrame()`, all randomness from Remotion's
`random()` with stable string seeds. There is no `Date.now()`, no
`requestAnimationFrame`, no CSS animation and no component state driving motion.

## Map data

`public/land-50m.json` is derived from the [Natural Earth](https://www.naturalearthdata.com/)
50m physical vectors (`ne_50m_land`, `ne_50m_lakes`), which are public domain.
Run `node scripts/prepare-land.mjs` to rebuild it from source.
