# Composition 2 — Earth Network at Blue Hour (Remotion + Three.js)

A realistic Earth at blue hour — teal oceans, dark continents with warm sodium
city lights, drifting cloud cover and atmospheric haze — while a white data
network grows across it: nodes switch on as they come into view, links draw on
from existing nodes, and data pulses travel along finished links. The camera
drifts from the Caribbean across the Atlantic to Europe and North Africa.

| Composition id | Description |
| --- | --- |
| `EarthNetwork-V1-Reference` | Version 1 — matches the reference: steady tilted eastward drift. |
| `EarthNetwork-V2-OrbitalPullback` | Version 2 — alternative **camera movement**: starts low over the Caribbean, then rises in a banking orbital pull-back that ends on the whole Atlantic hemisphere with the planet's limb, atmosphere and stars. |

Both compositions are **3840 × 2160 (4K UHD), 30 fps, 900 frames = 30.000 s**.

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* npm
* (optional) Python 3 + numpy + Pillow — only to rebuild the textures (`scripts/build_assets.py`)

## Commands

```console
npm install                 # install dependencies
npm run dev                 # open Remotion Studio (preview / scrub the 4K compositions)

npm run render:v1           # 1080p H.264 MP4 of V1  -> out/Comp2_V1_Reference_1080p.mp4
npm run render:v2           # 1080p H.264 MP4 of V2  -> out/Comp2_V2_OrbitalPullback_1080p.mp4
npm run render:v1:4k        # full 4K H.264 MP4 of V1
npm run render:v2:4k        # full 4K H.264 MP4 of V2
npm run lint                # eslint + TypeScript
```

The 1080p deliverables are rendered with `--scale=0.5`: the scene is still
rendered at the full 4K composition size and only the final resample targets
1920 × 1080 (supersampled).

### GPU vs. no GPU

The scene is WebGL 2. `remotion.config.ts` uses the `angle` OpenGL renderer by
default (GPU). On a machine without a GPU use software WebGL:

```console
REMOTION_GL=swangle npm run render:v1 -- --concurrency=3
```

Output settings (H.264, yuv420p, CRF 16, BT.709) are set in `remotion.config.ts`.

## Project layout

```
remotion.config.ts           render settings (codec, quality, GL backend)
src/Root.tsx                 the two 4K compositions
src/EarthNetwork.tsx         React/Remotion wrapper + the two "looks" (V1 / V2)
src/engine/EarthEngine.ts    Three.js scene: Earth shader, clouds, lights, atmosphere, stars, network
src/engine/network.ts        deterministic network growth + link ribbon geometry/shaders
src/engine/camera.ts         V1 and V2 camera keyframes
src/engine/flatten.ts        GLSL: gently curved map (V1) or true sphere (V2)
src/engine/post.ts           DOF, bloom, vignette, grade, grain
src/data/cities.ts           network hub cities (lat/lon)
public/textures/*            day, night-lights, clouds (4096×2048) and land mask (8192×4096)
public/data/lights.json      city-light sparkle points
scripts/build_assets.py      how the textures were prepared
```

Every frame is a pure function of time, so frames render in any order and in
parallel. The WebGL canvas is kept off-DOM and each frame is copied into a 2D
canvas, which keeps headless capture fast.

## Asset credits

* Day colour (Blue Marble), city lights (Black Marble) and cloud cover: NASA
  imagery (public domain), as published in the `turban/webgl-earth` and three.js examples.
* Coastlines: Natural Earth 1:10m land (public domain) via `world-atlas@2`.
