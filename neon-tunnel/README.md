# Neon Tunnel (Remotion · WebGL 2 shader)

A recreation of the reference clip "glowing neon rectangle in a wooden corridor"
(flickering neon rings, camera roll-in, glossy floor reflections). It is built as a
**WebGL 2 fragment shader**: the corridor, wood planks, neon rings and floor
reflections are ray-traced analytically per pixel, so every frame is resolution
independent and deterministic.

| Composition       | Size        | FPS | Frames | Duration | Look                                                                    |
| ----------------- | ----------- | --- | ------ | -------- | ----------------------------------------------------------------------- |
| `NeonTunnel-V1`   | 3840 × 2160 | 30  | 394    | 13.133 s | Matches the reference: warm sepia/amber neon, dark weathered wood       |
| `NeonTunnel-V2`   | 3840 × 2160 | 30  | 394    | 13.133 s | Alternative **colour palette**: electric magenta neon, violet-stained wood |

Both versions use exactly the same geometry, camera moves and flicker timing. Only the
palette changes.

> **Duration:** the reference is 13.12 s at 25 fps (328 frames). At 30 fps, 13.12 s
> would be 393.6 frames. Video can only hold whole frames, so the composition uses
> **394 frames (13.133 s)**, the closest possible length (+13 ms).

## Requirements

- Node.js 20.19+ or 22.13+ (see `engines` in `package.json`)
- Nothing else. Remotion downloads its own headless Chrome and ships its own ffmpeg.

## Install

```bash
npm ci          # or: npm install
```

## Preview

```bash
npm run dev     # opens Remotion Studio
```

## Render

```bash
# 4K masters + 1080p deliveries for both versions
npm run render
#   -> out/4k/NeonTunnel-V1_3840x2160.mp4      (4K master, H.264)
#   -> out/1080p/NeonTunnel-V1_1920x1080.mp4   (delivery, H.264, 30 fps)
#   -> same for NeonTunnel-V2

npm run render:v1        # only Version 1 (4K master + 1080p)
npm run render:v2        # only Version 2
npm run render:4k:v1     # 4K master only
```

You can also call the CLI directly:

```bash
npx remotion render NeonTunnel-V1 out/NeonTunnel-V1.mp4 --codec=h264
npx remotion render NeonTunnel-V1 out/NeonTunnel-V1_1080p.mp4 --scale=0.5   # quick 1080p
```

### Rendering notes

- `remotion.config.ts` sets the OpenGL renderer to **`swangle`** (ANGLE on SwiftShader).
  WebGL 2 then works in headless Chrome on any machine, with or without a GPU.
- To use an already installed Chrome or `chrome-headless-shell` instead of the one
  Remotion downloads (for example, offline), set:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render`
- Intermediate frames are PNG, so the dark gradients have no JPEG artefacts.

## Project structure

```
src/
  index.ts              registerRoot
  Root.tsx              the two 4K compositions
  tunnel/
    NeonTunnel.tsx      React component: WebGL 2 setup + per-frame uniforms
    shader.ts           GLSL ES 3.00 vertex/fragment shaders (corridor, wood, neon, reflections, grade)
    timeline.ts         flicker states, camera roll/dolly/zoom keyed to the reference (25 fps grid)
    palettes.ts         V1 (warm sepia) and V2 (magenta/violet) palettes
scripts/render.mjs      4K master -> 1080p delivery pipeline
remotion.config.ts      renderer settings
```

### How the timing matches the reference

The reference's lighting is a frame-accurate flicker sequence in four cycles. Each
cycle runs dark, then a rolled flash, then the rectangle, then the middle ring, then
the fully lit corridor, then steps back down to dark. Each cycle is dimmer than the
last. `timeline.ts` stores the light state for every reference frame (25 fps) and
samples it by time from the 30 fps composition. The camera roll, dolly and zoom
keyframes were measured from the reference frames.
