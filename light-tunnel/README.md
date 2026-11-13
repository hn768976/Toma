# Light Tunnel — 4K Remotion project

A sci-fi tunnel of light: a glowing main ring, a segmented iris around a dark core,
flickering radial light rays, rings flying toward the camera, twinkling sparkles
and volumetric haze.

| Composition ID | Version | Description |
| --- | --- | --- |
| `LightTunnel-V1-Match` | Version 1 | Matches the reference's electric-blue / cyan look. |
| `LightTunnel-V2-SolarGold` | Version 2 | Alternative **colour palette**: solar gold / ember (amber cores, orange glow, crimson haze). The motion and structure are the same. |

* **Resolution:** 3840 × 2160 (4K UHD). Both compositions are authored at 4K.
* **Frame rate:** 30 fps
* **Duration:** 864 frames = 28.8 s, exactly the reference length.
* **Technology:** a single WebGL 2 fragment shader (GLSL ES 3.00) on a fullscreen
  triangle. It is fully procedural and each frame is a pure function of time, so
  frames render independently and in parallel. The canvas backing store follows
  the render scale. At 1080p output it uses 2-tap supersampling. At native 4K it
  uses one sample per pixel.
* **Assets:** none. Everything is generated in the shader.

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* npm
* WebGL 2 in headless Chrome. `remotion.config.ts` sets `--gl=swangle`
  (SwiftShader via ANGLE + Vulkan), so it renders on machines without a GPU.

## Commands

```bash
npm install                      # install dependencies
npm run dev                      # open Remotion Studio (preview both compositions)

# Native 4K renders (H.264 MP4, 3840x2160, 30 fps)
npm run render:v1:4k
npm run render:v2:4k

# 1080p deliverables rendered from the 4K compositions (--scale=0.5)
npm run render:v1:1080p
npm run render:v2:1080p
```

Or use the CLI directly:

```bash
npx remotion render LightTunnel-V1-Match out/v1-4k.mp4
npx remotion render LightTunnel-V2-SolarGold out/v2-1080p.mp4 --scale=0.5
```

Renders go to `out/`. `remotion.config.ts` sets the H.264 codec, yuv420p, CRF 16,
JPEG frames at quality 95 and the `swangle` GL backend.

### Headless / GPU-less machines

If Remotion can't download its own Chrome Headless Shell, point it at a local one:

```bash
REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render:v1:1080p
```

## Source layout

```
src/
  index.ts               registerRoot
  Root.tsx               the two 4K compositions
  tunnel/
    LightTunnel.tsx      React component: WebGL 2 setup + per-frame draw
    shader.ts            vertex + fragment shader source
    palettes.ts          Electric Blue (V1) and Solar Gold (V2)
```
