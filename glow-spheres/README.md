# Glow Spheres – 4K Remotion composition

A swarm of glossy dark spheres and glowing striped spheres passes through a dark
space in two waves. A light core sits inside each wave and lights it up. Faint contour
lines, flakes, bloom and anamorphic horizontal lens streaks complete the look. It is
built with **Three.js** (WebGL 2) inside Remotion, using custom GLSL passes for the
streaks, background contours and film grade.

| Composition      | Size        | FPS | Frames | Duration | Description |
|------------------|-------------|-----|--------|----------|-------------|
| `GlowSpheres-V1` | 3840 × 2160 | 30  | 250    | 8.333 s  | Matches the reference: ultraviolet / magenta-violet palette, same light timing |
| `GlowSpheres-V2` | 3840 × 2160 | 30  | 250    | 8.333 s  | Alternative **colour palette**: electric cyan / teal, with identical animation and camera |

The reference clip is 250 frames at 29.97 fps (8.342 s). At exactly 30 fps the
closest possible length is 250 frames = 8.333 s, which is 0.008 s shorter (a quarter of a frame).
The light envelopes follow the reference's per-frame luminance curve:
- Wave 1 builds from about 0.3 s, peaks at 2.8–3.3 s and cuts out at 3.6 s.
- Wave 2 rises from the bottom at about 5.3 s, peaks at 6 s and fades out by 8.2 s.

## Requirements
- Node.js 20.19+ or 22.13+ (tested with Node 22.23 / npm 10.9)

## Commands
```bash
npm install          # install dependencies
npm run dev          # open Remotion Studio to preview the compositions

npm run render:v1    # -> out/GlowSpheres-V1_1080p.mp4  (4K comp rendered at --scale=0.5, H.264)
npm run render:v2    # -> out/GlowSpheres-V2_1080p.mp4
npm run render:v1:4k # -> out/GlowSpheres-V1_4K.mp4     (native 3840x2160)
npm run render:v2:4k # -> out/GlowSpheres-V2_4K.mp4
npm run lint         # eslint + TypeScript type-check
```

## Notes
- `remotion.config.ts` sets H.264, yuv420p and the `swangle` OpenGL backend
  (ANGLE + SwiftShader). That backend works on GPU-less machines. With a GPU you can
  add `--gl=angle` for much faster renders.
- The `pixelRatio` prop (default 1 = native 4K backing store) can be lowered to make
  previews faster, for example
  `--props='{"palette":"ultraviolet","seed":11,"pixelRatio":0.5}'`.
- Every frame is a pure function of the frame number, so renders are deterministic.

## Source layout
```
src/
  index.ts             registerRoot
  Root.tsx             the two 4K compositions
  GlowSpheres.tsx      composition component + zod schema
  lib/ThreeStage.tsx   vanilla Three.js <-> Remotion bridge (delayRender per frame)
  lib/random.ts        seeded PRNG + easing helpers
  spheres/palette.ts   reference (ultraviolet) and V2 (electric cyan) palettes
  spheres/timeline.ts  light envelopes + swarm paths (keyframes)
  spheres/textures.ts  procedural stripe textures
  spheres/post.ts      anamorphic streak pass + vignette/grain grade
  spheres/scene.ts     swarm, lights, background contours, bloom, per-frame update
```
