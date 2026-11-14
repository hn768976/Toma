# Warp Tunnel — Composition 2 (Remotion, 4K)

A hyperspace flight through a violet nebula tunnel: fibrous light streams
radiate from a dark vanishing point, cyan/white flares race past and star
streaks accelerate outward. Rendered entirely by a WebGL 2 fragment shader
inside Remotion — no image or video assets are required.

| Composition id               | Size        | FPS | Frames | Duration | Notes |
| ---------------------------- | ----------- | --- | ------ | -------- | ----- |
| `WarpTunnel-V1-Reference`    | 3840 × 2160 | 30  | 570    | 19.000 s | Matches the reference: straight-ahead flight, near-static vanishing point |
| `WarpTunnel-V2-BankingOrbit` | 3840 × 2160 | 30  | 570    | 19.000 s | Alternative **camera movement**: the vanishing point sweeps a figure-eight while the camera banks/rolls into each turn, with a speed surge through the bright section; same palette |

## Requirements

- Node.js 20.19+ or 22.13+ (see `package.json` → `engines`)
- A Chromium that supports WebGL 2. Remotion downloads Chrome Headless Shell
  automatically. Without a GPU, ANGLE falls back to SwiftShader (CPU), which
  works but is slower.

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # open Remotion Studio to preview both compositions

# 1080p H.264 deliverables (4K composition rendered at --scale=0.5)
npm run render:v1           # -> out/warp-tunnel-v1-1080p.mp4
npm run render:v2           # -> out/warp-tunnel-v2-1080p.mp4
npm run render:all          # both

# Full-resolution 4K UHD masters
npm run render:v1:4k        # -> out/warp-tunnel-v1-4k.mp4
npm run render:v2:4k        # -> out/warp-tunnel-v2-4k.mp4

npm run lint                # eslint + tsc
```

## Structure

```
src/
  index.ts            registerRoot
  Root.tsx            the two 4K compositions (V1 / V2)
  constants.ts        3840x2160, 30 fps, 570 frames
  WarpTunnel.tsx      component, camera paths and intensity envelopes
  keyframes.ts        eased keyframe sampling / speed integration helpers
  warpShader.ts       GLSL ES 3.0 fragment shader
  gl/ShaderCanvas.tsx deterministic, frame-driven WebGL 2 renderer
remotion.config.ts    h264, JPEG q95 frames, ANGLE GL renderer
```

## Notes

- Nebula density and flare intensity follow keyframed envelopes derived from
  the reference clip's per-second brightness (build-up to a bright flare
  peak at ~8 s, sparse star-field lull around 11–12 s, re-thickening toward
  the end).
- Stars are laid out on a polar (angle × log-radius) grid so they accelerate
  outward with perspective; they are masked out of the dark core.
- Animation depends only on the frame number, so renders are deterministic.
- `renderScale` (input prop) sets the shader's internal resolution relative
  to the composition; it defaults to `1` (native 4K).
