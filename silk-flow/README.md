# Silk Flow — Composition 1 (Remotion, 4K)

Soft, out-of-focus ribbons of light with prismatic fringes, thin light
filaments and a travelling white bloom. Rendered entirely by a WebGL 2
fragment shader inside Remotion — no image or video assets are required.

| Composition id          | Size        | FPS | Frames | Duration | Notes |
| ----------------------- | ----------- | --- | ------ | -------- | ----- |
| `SilkFlow-V1-Reference` | 3840 × 2160 | 30  | 600    | 20.000 s | Matches the reference: cobalt / cyan / white with pastel iridescence |
| `SilkFlow-V2-Sunset`    | 3840 × 2160 | 30  | 600    | 20.000 s | Alternative **colour palette**: plum / magenta / coral with a warm-gold bloom; identical motion |

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
npm run render:v1           # -> out/silk-flow-v1-1080p.mp4
npm run render:v2           # -> out/silk-flow-v2-1080p.mp4
npm run render:all          # both

# Full-resolution 4K UHD masters
npm run render:v1:4k        # -> out/silk-flow-v1-4k.mp4
npm run render:v2:4k        # -> out/silk-flow-v2-4k.mp4

npm run lint                # eslint + tsc
```

Equivalent raw CLI: `npx remotion render SilkFlow-V1-Reference out/v1.mp4 --scale=0.5 --codec=h264`.

## Structure

```
src/
  index.ts            registerRoot
  Root.tsx            the two 4K compositions and their palettes (V1 / V2)
  constants.ts        3840x2160, 30 fps, 600 frames
  SilkFlow.tsx        component + zod schema (palette is editable in Studio)
  silkShader.ts       GLSL ES 3.0 fragment shader
  gl/ShaderCanvas.tsx deterministic, frame-driven WebGL 2 renderer
remotion.config.ts    h264, JPEG q95 frames, ANGLE GL renderer
```

## Notes

- Animation depends only on the frame number (no wall-clock time or
  `Math.random`), so renders are deterministic and parallel-safe.
- All motion loops seamlessly over the 20 s duration (frame 600 == frame 0).
- The bloom's size and path are keyframed in `SilkFlow.tsx` from the
  reference clip's measured per-quadrant brightness (upper-right highlight →
  blown-out white wash at ~12–14 s → recedes).
- `renderScale` (input prop) sets the shader's internal resolution relative
  to the composition; it defaults to `1` (native 4K). Lower it only for fast
  previews, e.g. `--props='{"renderScale":0.25}'`.
