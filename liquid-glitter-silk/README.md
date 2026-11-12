# Liquid Glitter Silk — Remotion project (4K)

Abstract iridescent "liquid silk" with flowing satin folds and glitter flakes,
recreated procedurally from the reference clip as a **WebGL2 fragment shader**
inside Remotion.

| Composition ID                    | Version | Description                                                  |
| --------------------------------- | ------- | ------------------------------------------------------------ |
| `LiquidGlitterSilk-V1-Reference`  | V1      | Matches the reference: acid-lime sheet, magenta → violet folds |
| `LiquidGlitterSilk-V2-AquaGold`   | V2      | Alternative **colour palette**: aqua/teal sheet, molten gold → coral folds (same motion) |

* Resolution: **3840 × 2160 (4K UHD)** compositions
* Frame rate: **30 fps**, 240 frames = **8.000 s** (reference: 240 frames @ 29.97 fps)
* Codec: H.264 (yuv420p, CRF 16) — set in `remotion.config.ts`

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* Internet access on first render (Remotion downloads Chrome Headless Shell),
  **or** an existing Chrome / Chrome Headless Shell (see below).

## Commands

```bash
npm install                 # install dependencies (uses package-lock.json)
npm run dev                 # open Remotion Studio preview

npm run render:v1           # V1 -> out/LiquidGlitterSilk-V1-Reference-1080p.mp4 (4K comp rendered at 1080p)
npm run render:v2           # V2 -> out/LiquidGlitterSilk-V2-AquaGold-1080p.mp4
npm run render:v1:4k        # V1 at full 3840x2160
npm run render:v2:4k        # V2 at full 3840x2160
npm run still:v1            # single 4K PNG of frame 60
```

The 1080p deliverables are rendered from the 4K compositions with `--scale=0.5`
(the shader always draws at 4K, then the frame is downsampled — free supersampling).

### GPU / browser notes

* `remotion.config.ts` uses the `swangle` GL backend (ANGLE on SwiftShader), which
  works on any machine, including servers without a GPU. On a machine with a GPU
  add `--gl=angle` to any render command for a large speed-up.
* To use a pre-installed Chrome instead of letting Remotion download one:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render:v1`

## Source layout

```
src/
  index.ts               registerRoot
  Root.tsx               the two 4K compositions (V1 / V2)
  LiquidGlitterSilk.tsx  per-frame camera (rotate / push-in / pan) + uniforms
  palettes.ts            V1 lime/magenta and V2 aqua/gold palettes
  gl/ShaderCanvas.tsx    WebGL2 canvas, deterministic synchronous draw per frame
  gl/shader.ts           GLSL: domain-warped fold field, iridescent shading,
                         specular sheen, glitter flakes, fake depth of field
```

No external image/video/audio assets are needed — everything is procedural.
The videos are silent (the reference has no audio track).
