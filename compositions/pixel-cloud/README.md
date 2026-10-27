# Composition 2 — PixelCloud (4K)

A glowing cloud icon made of rounded pixel tiles on a tilted circuit board.
PCB-style traces draw on with travelling highlights, HUD labels fade in,
and floating particles turn into bokeh. Depth of field, bloom and an animated
noise field across the tiles. Built with **Remotion 4 + three.js (WebGL 2,
custom GLSL shaders)**.

| Composition     | Size        | FPS | Frames | Duration | Variant |
| --------------- | ----------- | --- | ------ | -------- | ------- |
| `PixelCloud-V1` | 3840 × 2160 | 30  | 360    | 12.000 s | Matches the reference: locked-off camera, cloud left of centre, shallow depth of field |
| `PixelCloud-V2` | 3840 × 2160 | 30  | 360    | 12.000 s | Alternative **camera movement**: a slow orbiting dolly that arcs from the right side of the board to a front-left angle while pushing in, with focus following the cloud. Same palette and animation. |

The reference clip is 360 frames at 29.97 fps (12.012 s). At exactly 30 fps
the same 360 frames last 12.000 s, the closest whole-frame match.

## Requirements

- Node.js 20.19+ or 22.13+ (tested with Node 22)
- About 2 GB of free RAM per render tab. No GPU needed; WebGL runs on
  SwiftShader (`--gl=swangle`, set in `remotion.config.ts`). On a machine with a GPU
  you can pass `--gl=angle` for faster renders.

## Commands

```console
npm ci                 # install the exact locked dependencies
npm run dev            # open Remotion Studio to preview
npm run render:v1      # 1920x1080 H.264 MP4 of V1  -> out/PixelCloud-V1_1080p.mp4
npm run render:v2      # 1920x1080 H.264 MP4 of V2  -> out/PixelCloud-V2_1080p.mp4
npm run render:v1:4k   # full 3840x2160 master of V1
npm run render:v2:4k   # full 3840x2160 master of V2
npm run still          # single 4K PNG frame for a quick check
npm run lint           # eslint + TypeScript type-check
```

The 1080p deliverables come from the 4K compositions rendered with `--scale=0.5`.
The WebGL drawing buffer stays 3840 × 2160, so each 1080p frame is a
supersampled downscale of the 4K frame.

## Structure

```
src/
  Root.tsx                     composition registry (4K, 30 fps, 360 frames)
  three/ThreeStage.tsx         hosts a raw three.js renderer inside Remotion (frame-accurate, deterministic)
  three/random.ts              seeded PRNG and easing helpers
  pixel-cloud/PixelCloud.tsx   composition component
  pixel-cloud/scene.ts         board, tiles, traces, labels, particles, camera paths, post-processing
  pixel-cloud/cloud-shape.ts   signed-distance cloud silhouette
  pixel-cloud/DofPass.ts       depth-based variable-radius depth-of-field pass
  pixel-cloud/glsl.ts          simplex noise + dither GLSL
```

There are no external media assets: everything is generated procedurally.
Every frame is a pure function of the frame number (seeded randomness, no
timers), so renders are reproducible and can run in parallel tabs.
