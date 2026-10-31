# Composition 1 — Global Network Map (Remotion + Three.js)

A tilted fly-over of a glowing blue relief map. The camera travels
North America → Caribbean → Atlantic → Africa / Europe → Middle East → India →
China → South-East Asia → Australia while comet-like arcs launch from hub cities,
leave dotted trails and flash on arrival. City lights twinkle, the coastline is
"extruded" with a bevel and soft shadow, and a tilt-shift depth of field blurs the
top and bottom of frame.

| Composition id | Description |
| --- | --- |
| `NetworkMap-V1-Reference` | Version 1 — matches the reference (electric blue on navy). |
| `NetworkMap-V2-AmberPalette` | Version 2 — same shot, alternative **amber / gold** colour palette. |

Both compositions are **3840 × 2160 (4K UHD), 30 fps, 900 frames = 30.000 s**.

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* npm
* (optional) Python 3 + numpy + Pillow — only to rebuild the textures (`scripts/build_assets.py`)

## Commands

```console
npm install                 # install dependencies
npm run dev                 # open Remotion Studio (preview / scrub the 4K compositions)

npm run render:v1           # 1080p H.264 MP4 of V1  -> out/Comp1_V1_Reference_1080p.mp4
npm run render:v2           # 1080p H.264 MP4 of V2  -> out/Comp1_V2_AmberPalette_1080p.mp4
npm run render:v1:4k        # full 4K H.264 MP4 of V1
npm run render:v2:4k        # full 4K H.264 MP4 of V2
npm run lint                # eslint + TypeScript
```

The 1080p deliverables are rendered with `--scale=0.5`: every pass of the scene
is still rendered at the full 4K composition size and only the final resample
targets 1920 × 1080, so the 1080p file is a supersampled 4K frame.

### GPU vs. no GPU

The scene is WebGL 2. `remotion.config.ts` uses the `angle` OpenGL renderer by
default (GPU). On a machine without a GPU (CI, containers) use software WebGL:

```console
REMOTION_GL=swangle npm run render:v1 -- --concurrency=3
```

Output settings (H.264, yuv420p, CRF 16, BT.709) are set in `remotion.config.ts`.

## Project layout

```
remotion.config.ts            render settings (codec, quality, GL backend)
src/Root.tsx                  the two 4K compositions
src/NetworkMap.tsx            React/Remotion wrapper: loads assets, renders a frame per time
src/engine/NetworkMapEngine.ts  Three.js scene: relief-map shader, city dots, arcs, heads
src/engine/arcs.ts            deterministic arc schedule + ribbon geometry/shaders
src/engine/camera.ts          camera keyframes (timed against the reference, 1 key/second)
src/engine/flatten.ts         GLSL that flattens the globe into a gently curved map
src/engine/post.ts            DOF (tilt-shift), bloom, vignette, grade, grain
src/engine/palettes.ts        V1 blue and V2 amber palettes
src/data/cities.ts            hub cities (lat/lon)
public/textures/land_8k.png   land mask + baked coastline bevel/shadow (8192×4096)
public/textures/relief_4k.png elevation + terrain normals (4096×2048)
public/data/lights.json       7 000 city-light points sampled from NASA night lights
scripts/build_assets.py       how the files above were generated
```

Every frame is a pure function of time (no simulation state), so frames can be
rendered in any order and in parallel. The WebGL canvas is kept off-DOM and each
frame is copied into a 2D canvas, which keeps headless capture fast.

## Asset credits

* Coastlines: Natural Earth 1:10m land (public domain) via `world-atlas@2`.
* Elevation / water mask: NASA Blue Marble derived maps (public domain), as
  published in the `turban/webgl-earth` examples.
* City lights: NASA Black Marble (public domain), as published in the three.js examples.
