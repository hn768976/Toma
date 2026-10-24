# 3D Scenes 4K — Remotion + Three.js

Two motion-graphics compositions recreated from 8-second reference clips.
Every composition is authored at **3840×2160 (4K UHD), 30 fps, 240 frames
(8.000 s)**. Each comes in two versions.

| Composition ID   | Description |
|------------------|-------------|
| `BarrelField-V1` | Field of steel oil drums under warm sepia light; low, long-lens camera on a steady forward dolly with shallow depth of field (matches the reference). |
| `BarrelField-V2` | Same scene and lighting, but the **camera angle and movement** change: a high-angle orbiting crane that rises and arcs around the field. |
| `VoxelCube-V1`   | A giant cube tiled with bevelled glossy blocks of mixed sizes (large cubes, slabs, small tiles): cyan/teal glass-metal, mirror-dark and violet blocks with white-hot glowing clusters flowing across the surface. Low, long-lens three-quarter view on the leading edge with the top face and background visible, a steady sideways orbit and shallow depth of field (matches the reference). |
| `VoxelCube-V2`   | Same geometry, animation and camera, with a **different colour palette**: molten copper, orange and magenta blocks with warm gold-white glow on a deep plum background. |

## Technology

* **Remotion 4** (project scaffolded with `npx create-video --three`).
* **Three.js (WebGL 2)** driven directly from a React component
  (`src/lib/ThreeStage.tsx`). The canvas is the full composition size
  (3840×2160), and every frame is a pure function of the frame number, so
  renders are deterministic under any concurrency.
* **Custom GLSL post-processing** (`src/lib/post.ts`): half-resolution
  96–128-tap bokeh depth of field, UnrealBloom (voxel scene), ACES tone mapping,
  colour grade and vignette.
* Instanced meshes (≈1,500 drums with two levels of detail, ≈7,300 voxel tiles), procedural environment
  maps generated on a 2D canvas. **No external assets** are needed.

## Requirements

* Node.js 20.19+ or 22.13+ (tested on Node 22).
* Run `npm install` once. Remotion downloads its own headless Chrome on the
  first render. A GPU is optional: on CPU-only machines Chrome falls back to
  SwiftShader through ANGLE, which is slower but gives the same result.

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # open Remotion Studio to preview all four compositions

# Final deliverables: 4K compositions rendered at 0.5 scale = 1920x1080 H.264 MP4
npm run render:barrel-v1    # -> out/Composition1_BarrelField_V1_1080p.mp4
npm run render:barrel-v2    # -> out/Composition1_BarrelField_V2_1080p.mp4
npm run render:voxel-v1     # -> out/Composition2_VoxelCube_V1_1080p.mp4
npm run render:voxel-v2     # -> out/Composition2_VoxelCube_V2_1080p.mp4
npm run render:all          # all four, one after another

# Full-resolution 3840x2160 masters (optional)
npm run render:barrel-v1:4k  # likewise :barrel-v2:4k, :voxel-v1:4k, :voxel-v2:4k
```

Render defaults live in `remotion.config.ts`: H.264, yuv420p, CRF 16, PNG
intermediate frames, ANGLE OpenGL, and long timeouts for CPU-only machines.
Add `--concurrency=N` to tune parallelism on your machine.

## Project layout

```
src/
  Root.tsx                 # registers the 4 compositions (3840x2160, 30 fps, 240 frames)
  lib/ThreeStage.tsx       # Three.js <-> Remotion bridge (delayRender per frame)
  lib/post.ts              # DOF / bloom / tone-map / grade pipeline
  lib/random.ts            # seeded PRNG, value noise, easing
  barrels/scene.ts         # oil-drum field: geometry, materials, camera paths v1/v2
  barrels/BarrelField.tsx
  voxel/scene.ts           # voxel cube: geometry, animated material field, palettes v1/v2
  voxel/VoxelCube.tsx
remotion.config.ts
```
