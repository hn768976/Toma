# Voxel Cube Assembly – Remotion + Three.js (4K)

A 6x6x6 cube of white, charcoal, pale-blue and chrome voxels floats in a
soft grey studio, tumbling slowly while its voxels slide apart and snap
back together in a ~6 second cycle.

Built with [Remotion](https://www.remotion.dev) (project scaffolded with
`npx create-video --blank`) and **Three.js / WebGL 2** (instanced meshes,
image-based lighting, shader-based seamless studio backdrop).
No external assets are required – everything is procedural.

| Composition ID    | Size      | FPS | Frames | Duration | Description                                            |
| ----------------- | --------- | --- | ------ | -------- | ------------------------------------------------------ |
| `VoxelCube-V1-4K` | 3840x2160 | 30  | 600    | 20.000 s | Version 1 – reference match (locked-off studio camera) |
| `VoxelCube-V2-4K` | 3840x2160 | 30  | 600    | 20.000 s | Version 2 – graphite/amber palette, dark studio, orbit |

## Requirements

- Node.js 20.19+ / 22.13+
- No GPU needed: `remotion.config.ts` selects the `swangle` software GL
  renderer. On a machine with a GPU you can append `--gl=angle` to render faster.

## Commands

```bash
npm install            # install dependencies

npm run dev            # open Remotion Studio (preview both compositions)

npm run render:v1      # Version 1 -> out/…(1080p).mp4  (4K comp, --scale=0.5)
npm run render:v2      # Version 2 -> out/…(1080p).mp4
npm run render:all     # both 1080p deliverables

npm run render:v1:4k   # native 3840x2160 master
npm run render:v2:4k
```

All renders are H.264 / yuv420p MP4 at 30 fps (set in `remotion.config.ts`).

## Structure

```
src/
  Root.tsx        composition registry (both 4K compositions)
  VoxelCube.tsx   React host: canvas + vignette, drives the scene per frame
  scene.ts        Three.js scene: voxels, scatter cycle, studio, cameras
```

Every frame is a pure function of the frame number (seeded PRNG, no
wall-clock time), so renders are deterministic.
