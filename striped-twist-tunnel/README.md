# Striped Twist Tunnel (Remotion · WebGL 2 shader)

An op-art tunnel of nested, twisted triangles covered in bold stripes. The stripes
crawl continuously around the folded walls, producing the hypnotic illusion of
rotating, shifting triangles. Rendered entirely in a **WebGL 2 fragment shader**:
each pixel's ray is intersected analytically with the ruled (bilinear) wall patches
between consecutive triangle rings.

Everything is procedural: there are no external image/video/font assets.

## Compositions (all 3840×2160 4K UHD, 30 fps, 270 frames = 9.000 s)

| ID | Description |
|----|-------------|
| `StripedTunnel-V1-4K` | Version 1 – matches the reference: navy-black ink on warm off-white paper, blue-grey depth tint, paper texture and grain. 1.5 s seamless loop (×6). |
| `StripedTunnel-V2-4K` | Version 2 – identical geometry and motion with an **alternative colour palette**: deep indigo ink on saffron, fading to magenta-rose in the depths. |

The reference clip is 270 frames at 29.97 fps (9.009 s); at exactly 30 fps the same
270 frames last 9.000 s (the closest whole-frame duration, < 1 frame difference).

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- On first render Remotion downloads its Chrome Headless Shell automatically.
- WebGL is rendered through ANGLE + SwiftShader (`--gl=swangle`, set in
  `remotion.config.ts`), so no GPU is needed. On a machine with a GPU you can pass
  `--gl=angle` for much faster renders.

## Commands

```console
npm ci                 # install exact dependency versions from package-lock.json
npm run dev            # open Remotion Studio to preview the 4K compositions
npm run render:v1      # out/StripedTunnel-V1-1080p.mp4  (4K comp downsampled, --scale=0.5)
npm run render:v2      # out/StripedTunnel-V2-1080p.mp4
npm run render:v1:4k   # optional: full 4K master of Version 1
npm run render:v2:4k   # optional: full 4K master of Version 2
```

Output: H.264, yuv420p, CRF 16, MP4 (configured in `remotion.config.ts`).

## Layout

```
remotion.config.ts            codec / GL / browser configuration
src/index.ts                  registerRoot
src/Root.tsx                  the two 4K compositions
src/tunnel/StripedTunnel.tsx  WebGL 2 setup, scene constants, per-frame uniforms
src/tunnel/shader.ts          ray / ruled-surface intersection + stripe shading
src/tunnel/palettes.ts        Version 1 and Version 2 colour palettes
```
