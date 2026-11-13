# Data Sphere Network Dive — 4K Remotion project

A sphere of data particles; the camera punches through it as it bursts into
motion-blurred streaks, drifts through a 3D network of nodes, plexus lines,
circuit traces and app/social icons, enters a lattice "data-centre" corridor and
dives into a glowing chip in a light-speed flash that cuts to black.

| Composition ID                       | Version | Camera                                                          | Size        | FPS | Duration             |
| ------------------------------------ | ------- | --------------------------------------------------------------- | ----------- | --- | -------------------- |
| `V1-Data-Sphere-Network-Dive`        | 1       | Matches the reference: straight dolly along the sphere/core axis | 3840 × 2160 | 30  | 402 frames / 13.4 s |
| `V2-Data-Sphere-Network-Corkscrew`   | 2       | Alternative camera: side orbit of the sphere, helical barrel-roll through the network, swoop up from below, spinning final dive | 3840 × 2160 | 30  | 402 frames / 13.4 s |

## Technology

* **Canvas 2D** driven by a small custom 3D engine (`src/engine/`):
  perspective camera with roll, Hermite-spline camera paths, per-element
  motion-blur streaks (shutter integration), depth-of-field bokeh, additive light,
  and a downsample-blur bloom pass.
* Icons are vector glyphs drawn with `Path2D` into cached sprites (`src/engine/sprites.ts`) —
  no external image assets.
* World content (≈9k sphere particles, 7.5k network particles, 4.2k icons, plexus
  links, circuit traces, lattice, ring, rays) is generated from a fixed seed
  (`src/scene/world.ts`), so every render is identical.
* Timeline / phase envelopes: `src/scene/timeline.ts`. Camera paths: `src/scene/cameraPaths.ts`.
  V2 differs from V1 **only** in its camera path.

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* ~2 GB free RAM per render worker

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # open Remotion Studio (preview / scrub)

# Delivery renders: 4K composition rendered at scale 0.5 -> 1920x1080 H.264 MP4
npm run render:v1
npm run render:v2

# Full native 4K (3840x2160) renders
npm run render:v1:4k
npm run render:v2:4k

npm run still:4k            # single 4K PNG frame (quick smoke test)
```

All outputs go to `out/`. Encoding settings (H.264, yuv420p, BT.709, CRF 18,
JPEG frame capture at q95) are in `remotion.config.ts`.

### Notes

* Remotion downloads its own Chrome Headless Shell on first render. In an offline
  / sandboxed environment point it at an existing build instead:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render:v1`.
* `--gl=angle` (GPU) can speed up canvas compositing on desktop machines.
