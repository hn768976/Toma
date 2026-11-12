# Holographic Prism Light Leaks (Remotion · WebGL 2 · 4K)

Blurred holographic / prismatic light-leak footage recreated procedurally with a
**WebGL 2 fragment shader**: dispersive rainbow ribbons, violet and warm glows,
soft shadow bands and white specular hot-spots drifting over a mauve base.

| Composition id | Version | Size | FPS | Frames | Duration |
|---|---|---|---|---|---|
| `HoloPrism-V1-Match-4K` | V1 – matches the reference (flat, hand-held macro drift) | 3840×2160 | 30 | 589 | 19.633 s |
| `HoloPrism-V2-LowAngleTracking-4K` | V2 – alternative **camera angle & movement**: low-angle perspective tracking shot gliding across the holographic sheet (crane-down, banking yaw & roll, depth haze) | 3840×2160 | 30 | 589 | 19.633 s |

> The reference is 19.640 s (491 frames @ 25 fps). 19.64 × 30 = 589.2, so 589 frames
> (19.633 s) is the closest whole-frame length at exactly 30 fps (Δ = 6.7 ms, < 1 frame).

## Requirements
* Node.js 20.19+ / 22.13+ / 24+
* No assets are required – everything is generated in the shader.

## Install
```bash
npm install
```

## Preview
```bash
npm run dev            # Remotion Studio
```

## Render
```bash
# Native 4K masters (H.264 MP4)
npm run render:v1:4k
npm run render:v2:4k

# 1080p delivery files rendered from the 4K compositions (what was delivered)
npm run render:delivery          # -> out/Version-1_..._1080p.mp4, out/Version-2_..._1080p.mp4
```
The delivery script renders the 4K composition with `--scale=0.5` and passes
`shaderScale: 0.5`, so the shader is evaluated at exactly 1920×1080 output pixels.

### GPU vs CPU
`remotion.config.ts` sets the OpenGL backend to **`swangle`** (SwiftShader), which
works on any machine including GPU-less servers. It is CPU-bound (≈4 s / 1080p
frame, ≈16 s / 4K frame on 4 cores). On a machine with a GPU append `--gl=angle`
to any render command for a large speed-up, e.g. `npx remotion render HoloPrism-V1-Match-4K out/v1.mp4 --gl=angle`.

## Project layout
```
src/index.ts              registerRoot
src/Root.tsx              the two 4K compositions
src/holo/constants.ts     fps / duration / 4K size
src/holo/shader.ts        GLSL ES 3.00 vertex + fragment shader (the look)
src/holo/HoloPrism.tsx    WebGL 2 canvas component + per-version camera
remotion.config.ts        codec, pixel format, GL backend, browser fallback
render-delivery.sh        1080p delivery renders
```
