# mars-dome

A glass-domed Mars base: central tower and hub, arch ribs, stay cables to outer masts, habitats,
trees and path lamps, with hazy red cliffs behind. The camera sits just outside the glass.

Built with Remotion, `@remotion/three` and React Three Fiber on WebGL 2. Everything is procedural:
there are no image, model or font assets to load.

| Composition | Size | Length | What it is |
|---|---|---|---|
| `V1-mars-dome` | 3840x2160, 30 fps | 311 frames (10.37 s) | Matches the reference: a slow hand-held style drift. |
| `V2-mars-dome` | 3840x2160, 30 fps | 311 frames (10.37 s) | Same scene, different camera movement: an orbital sweep with a push-in. |
| `LookDev` | 3840x2160 | 3 frames | The three look-development stills. |

Both versions loop seamlessly: the frame after the last equals frame 0.

## Install

```bash
npm ci
```

Node 20.19+, 22.13+ or 24+. Remotion downloads its own headless browser on the first render.

## Render

4K masters (the compositions' native size):

```bash
npx remotion render V1-mars-dome out/03-V1-mars-dome-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-mars-dome out/04-V2-mars-dome-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
```

(or `npm run render:v1` / `npm run render:v2`)

1080p, as delivered:

```bash
npx remotion render V1-mars-dome out/03-V1-mars-dome.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-mars-dome out/04-V2-mars-dome.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
```

One 4K still, to check an install:

```bash
npx remotion still V1-mars-dome out/v1-frame.png --frame=155 --scale=1 --gl=angle
npx remotion still V2-mars-dome out/v2-frame.png --frame=155 --scale=1 --gl=angle
```

Preview: `npm run dev`.

The drawing buffer follows `--scale`, so `--scale=0.5` renders 1920x1080 buffers and `--scale=1`
renders 3840x2160. Every blur radius, glow size and grain size is defined relative to frame height,
so the two look the same.

## Render time

__RENDER_TIME__

## What Version 2 changes, and why

Version 2 changes **only the camera movement**. Version 1 holds one position and drifts by a few
tens of centimetres, as the reference does. Version 2 sweeps 18 degrees either side of that
position around the tower, pushing in 12 m and rising 3 m at the middle of the loop. Mars's colour
is the subject of the shot, so the palette is the wrong thing to change; a larger move instead
shows off the parallax between the glass, the ribs, the buildings and the cliffs. The move is
built from whole cycles of the loop, so it also closes seamlessly.

One prop follows from that: the slim out-of-focus pole in front of the lens belongs to Version 1's
fixed camera position, so it is left out of Version 2, where the travelling camera would flick
past it in a few frames.

Everything else (scene, light, haze, look) is shared. The two moves are `CONFIG.sway` and
`CONFIG.orbit` in `src/config.ts`.

## Where to change things

| To change | Edit |
|---|---|
| Colours of surfaces, terrain, lights, haze | `PALETTE` in `src/config.ts` |
| Camera position, lens, tilt | `CONFIG.camera` |
| Version 1 drift (harmonics of the loop) | `CONFIG.sway` |
| Version 2 sweep angle, push-in, rise | `CONFIG.orbit` |
| Dome size, hub, arch directions, masts | `CONFIG.dome` |
| Buildings and planted plots | `CONFIG.buildings`, `CONFIG.plots` |
| Number of trees and lamps, random seeds | `CONFIG.trees`, `CONFIG.lamps` |
| Terrain size, resolution, seed | `CONFIG.terrain` |
| Duration, frame rate, composition size | top of `src/config.ts` |
| Exposure, tone mapping, sun, ambient, lamp brightness, glass | `LIGHTS` and `LOOK` in `src/look.ts` |
| Haze, depth of field, bloom, grade, grain | `LOOK` in `src/look.ts` |

## How it is built

- `src/world.ts` builds the scene once (seeded `mulberry32`, never `Math.random()`) and exposes
  `update(frame)`, a pure function of the frame number.
- `src/engine/Stage.tsx` hands React Three Fiber a renderer whose `render()` runs the post
  pipeline, so `<ThreeCanvas>` advancing once per Remotion frame renders the whole chain.
  There is no `useFrame`, no animation loop and no clock.
- `src/engine/pipeline.ts` is the image chain on half-float targets: depth haze, depth of field,
  bloom, tone mapping, grade, film grain and a 1/255 dither.
- `scripts/measure-look.py` (numpy + Pillow) measures a frame's look and compares it with a
  reference frame; `lookdev/` holds the side-by-side comparisons.
