# Composition 2 — Planet Sunrise (Remotion, WebGL 2 shader)

A procedural space scene: the night-side limb of a planet with a glowing cyan
atmosphere, a pulsing sun breaking over the horizon, anamorphic streak,
lens-flare ghosts, teal nebula, twinkling stars and drifting dust.

| Composition ID                    | Size       | FPS | Frames | Notes |
|-----------------------------------|------------|-----|--------|-------|
| `PlanetSunrise-V1-Reference-4K`   | 3840×2160  | 30  | 300    | Version 1 — matches the reference (locked-off camera) |
| `PlanetSunrise-V2-CameraMove-4K`  | 3840×2160  | 30  | 300    | Version 2 — alternative camera movement: slow push-in with a Dutch-roll drift and rise over the horizon; layers have parallax and the lens flare tracks the sun's on-screen position |

Technology: a full-screen **WebGL 2 fragment shader** (`src/planet/planetShader.ts`)
drawn by `src/gl/ShaderCanvas.tsx`. Camera (`src/planet/camera.ts`) and the sun
pulse (`src/planet/sunPulse.ts`, a 3-harmonic fit of the reference's measured
brightness) are evaluated per frame in JS and passed as uniforms. All animation
is a pure function of the frame number, so renders are deterministic.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- No GPU required (renders with SwiftShader/ANGLE on CPU). On a GPU machine
  append `--gl=angle` to any render command for a large speed-up.

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # open Remotion Studio (preview / scrub)

npm run render:v1:4k        # Version 1, native 4K  -> out/PlanetSunrise-V1-Reference-4K.mp4
npm run render:v2:4k        # Version 2, native 4K  -> out/PlanetSunrise-V2-CameraMove-4K.mp4
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
