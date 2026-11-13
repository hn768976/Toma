# Water Droplets Hydrating Cracked Skin

Glassy water spheres fall in slow motion onto dry, cracked skin, sink in and are absorbed. The cracks close around every drop until the surface is smooth, then the camera pulls back to reveal the edge of the skin and the cell layer underneath.

Two 4K UHD compositions (3840x2160, 30 fps, 251 frames = 8.3667 s), built with
[Remotion](https://www.remotion.dev) and rendered entirely with **WebGL 2 fragment shaders**
(no footage, images or 3D model files - everything is procedural).

| Composition id | What it is |
| --- | --- |
| `SkinHydration-V1` | Version 1 - matches the reference clip (look, timing, camera) |
| `SkinHydration-V2` | Version 2 - alternative colour palette: deep skin tone, golden-amber oil droplets, warm cocoa studio (camera and animation identical to V1) |

## Requirements

- Node.js 20.19+, 22.13+ or 24+
- npm
- No GPU required (software WebGL is used automatically on Linux). A GPU makes rendering much faster.

## Install

```console
npm ci
```

## Preview (Remotion Studio)

```console
npm run dev
```

## Render

Final 1080p deliverables (H.264 MP4, 1920x1080, 30 fps) - the 4K compositions rendered at half scale:

```console
npm run render:v1
npm run render:v2
```

or both with `npm run render`. The same commands written out:

```console
npx remotion render SkinHydration-V1 "out/Version 1 - Water Droplets Hydrating Cracked Skin - 1080p.mp4" --scale=0.5
npx remotion render SkinHydration-V2 "out/Version 2 - Water Droplets Hydrating Cracked Skin - Golden Palette - 1080p.mp4" --scale=0.5
```

Native 4K masters (3840x2160):

```console
npm run render:v1:4k
npm run render:v2:4k
```

A single 4K still: `npm run still:4k`.

Codec (H.264), pixel format (yuv420p), colour space (BT.709), CRF, PNG intermediate
frames and "no audio track" are set in `remotion.config.ts`, so the plain
`npx remotion render <composition-id> <output>` works too.

### Render notes

- **OpenGL backend:** on Linux the config selects `swangle` (software ANGLE), which works on any
  machine, server or container. On macOS / Windows it selects `angle` (GPU). Override with `--gl=...`
  (for example `--gl=angle` or `--gl=vulkan` on a Linux workstation with a GPU).
- **Speed:** with a GPU a frame takes a fraction of a second. On CPU-only machines (software GL)
  expect roughly 2-3 s per 1080p frame and 8-10 s per 4K frame on 4 cores. Software GL already uses
  every core, so add `--concurrency=1` there if frames time out.
- **Extra anti-aliasing (optional):** `--props='{"supersample":2}'` shades 4 samples per pixel.
- The first frame takes a few seconds longer: the shaders are compiled and the procedural crack /
  skin-relief maps are baked into textures once per browser tab.

## How it works

- `src/gl/renderer.ts` - small WebGL 2 multi-pass renderer: HDR scene pass, depth of field,
  bloom, tone mapping, FXAA and film grain.
- `src/gl/bake.ts` - one-time bake of the tileable procedural maps (crack distance field,
  skin micro-relief normal map).
- `src/gl/ShaderCanvas.tsx` - frame-accurate canvas for Remotion (every frame is a pure function
  of the frame number; `--scale` controls the backing-store resolution).
- `src/shaders/scene.ts` - the scene shader: ray-marched skin height field, analytic ellipsoid drops with real refraction, procedural cell layer.
- `src/scene/timeline.ts` - all animation: keyframed camera and per-frame uniforms.
- `src/scene/palettes.ts` - colours and post-processing settings.
- `src/Root.tsx` - registers the two compositions.

## License note

Remotion is free for individuals and small teams; some companies need a license -
see https://www.remotion.dev/docs/license.
