# Composition 1 — CodeStream (4K)

A slow push through a deep field of layered, translucent code panels, floating
data squares, outlines and crosses, with a bright horizon glow, built with
**Remotion 4 + three.js (WebGL 2)**.

| Composition      | Size        | FPS | Frames | Duration | Variant |
| ---------------- | ----------- | --- | ------ | -------- | ------- |
| `CodeStream-V1`  | 3840 × 2160 | 30  | 450    | 15.000 s | Matches the reference: indigo / ultramarine palette |
| `CodeStream-V2`  | 3840 × 2160 | 30  | 450    | 15.000 s | Alternative **color palette**: emerald / teal field with amber accents. Same camera, layout and timing. |

## Requirements

- Node.js 20.19+ or 22.13+ (tested with Node 22)
- About 2 GB of free RAM per render tab. No GPU needed; WebGL runs on
  SwiftShader (`--gl=swangle`, set in `remotion.config.ts`). On a machine with a GPU
  you can pass `--gl=angle` for faster renders.

## Commands

```console
npm ci                 # install the exact locked dependencies
npm run dev            # open Remotion Studio to preview
npm run render:v1      # 1920x1080 H.264 MP4 of V1  -> out/CodeStream-V1_1080p.mp4
npm run render:v2      # 1920x1080 H.264 MP4 of V2  -> out/CodeStream-V2_1080p.mp4
npm run render:v1:4k   # full 3840x2160 master of V1
npm run render:v2:4k   # full 3840x2160 master of V2
npm run still          # single 4K PNG frame for a quick check
npm run lint           # eslint + TypeScript type-check
```

The 1080p deliverables come from the 4K compositions rendered with `--scale=0.5`.
The WebGL drawing buffer stays 3840 × 2160, so each 1080p frame is a
supersampled downscale of the 4K frame. The codec (H.264, yuv420p), JPEG frame
quality and overwrite behaviour are set in `remotion.config.ts`.

## Structure

```
src/
  Root.tsx                    composition registry (4K, 30 fps, 450 frames)
  three/ThreeStage.tsx        hosts a raw three.js renderer inside Remotion (frame-accurate, deterministic)
  three/random.ts             seeded PRNG, easing and font helpers
  code-stream/CodeStream.tsx  composition component
  code-stream/scene.ts        scene, camera path, panels, sprites, bloom
  code-stream/textures.ts     procedural Canvas 2D code-panel and sprite textures
  code-stream/code-snippets.ts on-screen code text
  code-stream/palettes.ts     V1 / V2 palettes
public/fonts/                 Roboto (Apache 2.0), bundled locally
```

Every frame is a pure function of the frame number (seeded randomness, no
timers), so renders are reproducible and can run in parallel tabs.
