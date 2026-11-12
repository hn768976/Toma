# Topographic Network Pins — Remotion + Three.js (4K)

A low camera glides over a neon topographic contour map while location pins with
avatar badges rise from the terrain, far to near, with shallow depth of field.

| Composition ID | Version | Resolution | FPS | Frames | Duration |
|---|---|---|---|---|---|
| `TopoNetworkPins-V1-Reference` | V1 – matches the reference (violet contours, orange pins, plum night) | 3840×2160 | 30 | 480 | 16.000 s |
| `TopoNetworkPins-V2-AuroraPalette` | V2 – alternative colour palette (teal/emerald contours, magenta pins, deep-ocean night) | 3840×2160 | 30 | 480 | 16.000 s |

**Technology:** Three.js (WebGL 2) with custom GLSL shaders:
- contour map: fragment shader iso-lines of an fBm height field with analytic,
  screen-space anti-aliasing, distance haze and per-pixel defocus,
- pins: instanced, depth-sorted billboards; badges blur analytically (disc-kernel
  coverage + mip-biased avatar lookup) to produce the bokeh look, stems and their
  floor reflections are additive instanced quads,
- bloom + ACES grade via `src/lib/PostPipeline.ts`.

Avatar portraits are drawn procedurally with Canvas 2D (`src/Topo/avatars.ts`);
no external assets are required. Everything is seeded and deterministic.

## Requirements
- Node.js ≥ 20.19 (tested with Node 22)

## Commands
```bash
npm install
npm run dev                      # Remotion Studio

# 4K masters
npx remotion render TopoNetworkPins-V1-Reference out/v1-4k.mp4
npx remotion render TopoNetworkPins-V2-AuroraPalette out/v2-4k.mp4

# 1080p deliverables (from the 4K compositions)
npx remotion render TopoNetworkPins-V1-Reference out/v1-1080p.mp4 --scale=0.5
npx remotion render TopoNetworkPins-V2-AuroraPalette out/v2-1080p.mp4 --scale=0.5
```
`remotion.config.ts` sets H.264, CRF 16, yuv420p and the `swangle` OpenGL backend
(works without a GPU). Add `--gl=angle` on GPU machines for faster renders.

## Layout
```
src/Root.tsx               compositions (4K, 30 fps, 480 frames)
src/Topo/TopoNetwork.tsx   React wrapper
src/Topo/scene.ts          scene, palettes, camera path, pin timeline
src/Topo/avatars.ts        procedural avatar atlas
src/lib/ThreeStage.tsx     deterministic Three.js <-> Remotion bridge
src/lib/PostPipeline.ts    bloom + grade
```
