# Composition 1 — LED Light Wall (Remotion, WebGL 2 shader)

A procedural recreation of a twinkling LED stage light-wall: a 19 × 10 grid of
lamps (starburst core + fuzzy halo) over a violet→cyan gradient with drifting
haze and light rays from the top-right corner.

| Composition ID                 | Size       | FPS | Frames | Notes |
|--------------------------------|------------|-----|--------|-------|
| `LedWall-V1-Reference-4K`      | 3840×2160  | 30  | 300    | Version 1 — matches the reference (violet → cyan) |
| `LedWall-V2-SunsetPalette-4K`  | 3840×2160  | 30  | 300    | Version 2 — alternative colour palette (magenta → crimson → amber) |

Technology: a full-screen **WebGL 2 fragment shader** (`src/led/ledWallShader.ts`)
drawn by `src/gl/ShaderCanvas.tsx`. Per-lamp flicker/colour is computed on the
CPU each frame (`src/led/lampState.ts`) and passed in as a uniform array. All
animation is a pure function of the frame number, so renders are deterministic.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- No GPU required (renders with SwiftShader/ANGLE on CPU). On a GPU machine
  append `--gl=angle` to any render command for a large speed-up.

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # open Remotion Studio (preview / scrub)

npm run render:v1:4k        # Version 1, native 4K  -> out/LedWall-V1-Reference-4K.mp4
npm run render:v2:4k        # Version 2, native 4K  -> out/LedWall-V2-SunsetPalette-4K.mp4
npm run render:v1:1080p     # Version 1, 1080p delivery (4K comp rendered at --scale=0.5)
npm run render:v2:1080p     # Version 2, 1080p delivery
npm run render:all:1080p    # both 1080p deliveries
npm run test:render         # 6-frame smoke test (fast)
```

Output is H.264 MP4, yuv420p, CRF 14 (see `remotion.config.ts`).

## Timing

300 frames at exactly 30 fps = 10.000 s. (The reference clip is 300 frames at
29.97 fps = 10.010 s; 300.3 frames is not representable, so the frame count is
matched exactly and the duration is within 10 ms.)
