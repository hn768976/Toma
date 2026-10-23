# Composition 2 — Neon Wave Flow (Remotion · Three.js / WebGL 2 shaders)

A shallow-focus flight along a glowing blue light track, with bouncing and
looping wave filaments rising from it, recreated procedurally from a
20.02 s reference clip.

| Composition ID                | Version | Camera                                                          |
| ----------------------------- | ------- | --------------------------------------------------------------- |
| `NeonWaveFlow-V1-LowTracking` | V1      | Matches the reference: low, tilted tracking shot along the track |
| `NeonWaveFlow-V2-CraneSweep`  | V2      | Alternative camera move: over-the-top crane/orbit to the far side |

- Master resolution: **3840×2160 (4K UHD)**, 30 fps, 601 frames (20.033 s;
  the reference is 20.02 s — 601 frames is the nearest exact 30 fps length).
- Built with `@remotion/three` + React Three Fiber and a custom GLSL
  `ShaderMaterial` (`src/neon/ribbonMaterial.ts`): each filament segment is
  drawn as an analytically blurred gaussian line whose width grows with the
  depth-of-field circle of confusion, giving the soft bokeh streaks.
- No image or video assets; everything is procedural and deterministic.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- Remotion downloads its own Chrome Headless Shell on first render. WebGL is
  rendered through ANGLE (`remotion.config.ts`), which falls back to
  SwiftShader on machines without a GPU.

## Commands

```console
npm install
npm run dev            # Remotion Studio preview
npm run render:v1      # out/Composition2_V1_LowTracking_1080p.mp4  (4K comp, scaled 0.5 → 1080p)
npm run render:v2      # out/Composition2_V2_CraneSweep_1080p.mp4
npm run render:v1:4k   # full 4K master render
npm run render:v2:4k
npm run lint
```

Encoding defaults (H.264, CRF 18, yuv420p, BT.709, PNG intermediates) are
set in `remotion.config.ts`.

## Source layout

- `src/Root.tsx` — the two 4K compositions
- `src/neon/NeonWaveFlow.tsx` — scene: camera rig, backdrop, filaments
- `src/neon/cameraRigs.ts` — V1 low tracking and V2 crane sweep camera paths
- `src/neon/lines.ts` — track strands, light pads, wave arcs and springs
- `src/neon/Ribbons.tsx` — single-draw-call segment geometry, rebuilt per frame
- `src/neon/ribbonMaterial.ts` — gaussian line + depth-of-field shader
- `src/neon/Background.tsx` — gradient backdrop shader
