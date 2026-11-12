# Data Cube Assembly — Remotion + Three.js (4K)

A glowing voxel "data core" on a dark circuit-city. A module docks into the core,
the core ignites, and the camera pulls back as light streaks race along the grid.

| Composition ID | Version | Resolution | FPS | Frames | Duration |
|---|---|---|---|---|---|
| `DataCubeAssembly-V1-Reference` | V1 – matches the reference (close-up → fast pull-back to high wide shot) | 3840×2160 | 30 | 141 | 4.700 s |
| `DataCubeAssembly-V2-LowOrbitCrane` | V2 – alternative camera: low hero-angle orbit, then crane up to a near top-down orbit | 3840×2160 | 30 | 141 | 4.700 s |

**Technology:** Three.js (WebGL 2) rendered into a `<canvas>` per frame
(`src/lib/ThreeStage.tsx`), with a custom HDR post pipeline
(`src/lib/PostPipeline.ts`): depth-of-field gather pass, Unreal bloom, ACES grade.
All textures (circuit greebles, voxel faces, reflection environment) are generated
procedurally at runtime — there are no external assets to go missing. Everything is
seeded and a pure function of the frame number, so renders are deterministic.

## Requirements
- Node.js ≥ 20.19 (tested with Node 22)
- ~2 GB free RAM per render tab

## Commands
```bash
npm install                      # install dependencies
npm run dev                      # open Remotion Studio (preview)

# 4K master (3840x2160, H.264)
npx remotion render DataCubeAssembly-V1-Reference out/v1-4k.mp4
npx remotion render DataCubeAssembly-V2-LowOrbitCrane out/v2-4k.mp4

# 1080p deliverables (rendered from the 4K compositions, downscaled 0.5x)
npx remotion render DataCubeAssembly-V1-Reference out/v1-1080p.mp4 --scale=0.5
npx remotion render DataCubeAssembly-V2-LowOrbitCrane out/v2-1080p.mp4 --scale=0.5
```
`remotion.config.ts` sets codec H.264, CRF 16, yuv420p and the `swangle` (software)
OpenGL backend so it renders on any machine, including servers without a GPU.
On a machine with a GPU, add `--gl=angle` for a much faster render.

## Layout
```
src/Root.tsx                 compositions (4K, 30 fps, 141 frames)
src/DataCube/DataCube.tsx    React wrapper
src/DataCube/scene.ts        scene, timeline, camera rigs (reference / orbit)
src/lib/ThreeStage.tsx       deterministic Three.js <-> Remotion bridge
src/lib/PostPipeline.ts      DOF + bloom + grade
```
Timeline: frames 0–39 module descent (slot light flickers), frame 40 docking and
ignition flash, frames 40–49 fast dolly-out, frames 49–140 slow drift.
