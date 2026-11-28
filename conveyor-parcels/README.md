# conveyor-parcels

Strapped cardboard parcels riding a roller conveyor through a warehouse: a long lens travelling
with the parcels, shallow depth of field, and a hard light zone that sweeps over them once per loop.

Built with Remotion, `@remotion/three` and React Three Fiber on WebGL 2. Everything is procedural:
there are no image, model or font assets to load.

| Composition | Size | Length | What it is |
|---|---|---|---|
| `V1-conveyor-parcels` | 3840x2160, 30 fps | 313 frames (10.43 s) | Matches the reference: warm tungsten light, kraft-brown cartons. |
| `V2-conveyor-parcels` | 3840x2160, 30 fps | 313 frames (10.43 s) | Same scene, cold "night shift" colour palette. |
| `LookDev` | 3840x2160 | 3 frames | The three look-development stills (start, light arriving, fully lit). |

Both versions loop seamlessly: the frame after the last equals frame 0.

## Install

```bash
npm ci
```

Node 20.19+, 22.13+ or 24+. Remotion downloads its own headless browser on the first render.

## Render

4K masters (the compositions' native size):

```bash
npx remotion render V1-conveyor-parcels out/01-V1-conveyor-parcels-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-conveyor-parcels out/02-V2-conveyor-parcels-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
```

(or `npm run render:v1` / `npm run render:v2`)

1080p, as delivered:

```bash
npx remotion render V1-conveyor-parcels out/01-V1-conveyor-parcels.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-conveyor-parcels out/02-V2-conveyor-parcels.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
```

One 4K still, to check an install:

```bash
npx remotion still V1-conveyor-parcels out/v1-frame.png --frame=156 --scale=1 --gl=angle
npx remotion still V2-conveyor-parcels out/v2-frame.png --frame=156 --scale=1 --gl=angle
```

Preview: `npm run dev`.

The drawing buffer follows `--scale`, so `--scale=0.5` renders 1920x1080 buffers and `--scale=1`
renders 3840x2160. Every blur radius, glow size and grain size is defined relative to frame height,
so the two look the same.

## Render time

__RENDER_TIME__

## What Version 2 changes, and why

Version 2 changes **only the colour palette**: cold blue-white light, pale grey cartons with orange
straps, blue-cyan distant lamps. The shot is defined by its locked framing and by the light that
travels over the parcels, so a palette change reads at a glance without touching the concept.
Geometry, camera, motion, timing and every look setting are shared with Version 1. The palettes
are `PALETTES.v1` and `PALETTES.v2` in `src/config.ts`; the only other difference is a slight cool
tint in the shadows (`GRADE_V2` in `src/look.ts`).

## Where to change things

| To change | Edit |
|---|---|
| Colours (cartons, straps, rollers, backdrop, lamps, light colours) for either version | `PALETTES` in `src/config.ts` |
| Camera (lens, height, tilt) | `CONFIG.camera` in `src/config.ts` |
| Speed of travel (rollers per loop) | `CONFIG.travel` |
| Length and timing of the light zone | `CONFIG.lightZone` |
| Parcels: sizes, positions, straps, label | `CONFIG.parcels` |
| Parcel vibration | `CONFIG.vibration` |
| Backdrop density, number of distant lamps, random seed | `CONFIG.backdrop` |
| Duration, frame rate, composition size | top of `src/config.ts` |
| Exposure, tone mapping, light levels and directions | `LIGHTS` and `LOOK` in `src/look.ts` |
| Haze, depth of field, bloom, grade, lens softness, grain | `LOOK` in `src/look.ts` |
| Roller highlights and glare | `LIGHTS.rollers` in `src/look.ts` |

## How it is built

- `src/world.ts` builds the scene once (seeded `mulberry32`, never `Math.random()`) and exposes
  `update(frame)`, a pure function of the frame number.
- `src/engine/Stage.tsx` hands React Three Fiber a renderer whose `render()` runs the post
  pipeline, so `<ThreeCanvas>` advancing once per Remotion frame renders the whole chain.
  There is no `useFrame`, no animation loop and no clock.
- `src/engine/pipeline.ts` is the image chain on half-float targets: depth haze, depth of field,
  bloom, lens softness and chromatic aberration, tone mapping, grade, film grain and a 1/255
  dither.
- `scripts/measure-look.py` (numpy + Pillow) measures a frame's look and compares it with a
  reference frame; `lookdev/` holds the side-by-side comparisons.

## Loop

The camera and parcels travel exactly 64 roller pitches in 313 frames, the backdrop repeats every
64 pitches, the light zone repeats every 64 pitches, and the vibration noise is sampled on a
circle. Frame 313 would therefore be identical to frame 0.
