# Voxel Brain Assembly (Remotion, 4K)

Two 3840×2160 compositions at 30 fps, 301 frames (10.033 s). Glassy cyan cubes fly in and
assemble into a voxel brain on a white pedestal. The pedestal is wired into a glowing circuit
on a bright, high-key floor of bevelled tiles.

| Composition ID | What it is |
| --- | --- |
| `VoxelBrainAssembly-V1-Match` | Version 1: matches the reference (low frontal camera, slow push-in) |
| `VoxelBrainAssembly-V2-OrbitCamera` | Version 2: same scene and timing, seen from an elevated three-quarter camera that orbits about 76° around the pedestal while it descends |

**Technology:** Three.js (WebGL 2) driven by Remotion's `useCurrentFrame()`. The scene renders
into a 4× MSAA half-float target with a depth texture. A custom post chain then adds
depth-of-field (two blur levels mixed by circle of confusion), soft bloom and a vignette.
All animation is a pure function of time, so frames can be rendered in parallel.

## Requirements
- Node.js 20.19+ or 22.13+ (tested with Node 22)
- No GPU needed. `remotion.config.ts` selects the `swangle` OpenGL backend (ANGLE on SwiftShader),
  which works on any machine. With a GPU you can add `--gl=angle` to any command for faster renders.

## Commands
```bash
npm install                 # or: npm ci
npm run dev                 # Remotion Studio preview

# 4K masters (3840x2160, H.264)
npm run render:v1:4k
npm run render:v2:4k

# 1080p deliverables (rendered from the 4K compositions with --scale=0.5)
npm run render:v1:1080p
npm run render:v2:1080p

# Single still frame check
npm run still:v1
```
Output goes to `out/`. Codec, pixel format (yuv420p) and quality (CRF 16) are set in `remotion.config.ts`.
On CPU-only machines a 4K frame takes a few seconds, so a full render takes several minutes.

## Project layout
```
src/index.ts               registerRoot
src/Root.tsx               the two 4K compositions (30 fps, 301 frames)
src/brain/VoxelBrain.tsx   Remotion component hosting the WebGL canvas
src/brain/world.ts         Three.js scene: tiles, pools, pedestal, circuit, cubes, post-processing
src/brain/voxels.ts        brain silhouette → voxel relief + fly-in choreography
src/brain/camera.ts        V1 (reference) and V2 (orbit) camera paths + focus distance
src/brain/random.ts        seeded PRNG and easing helpers
remotion.config.ts         render settings (H.264, CRF 16, swangle GL)
```

`remotion.config.ts` points Remotion at a Playwright headless-shell binary only when that
file exists (sandboxed CI). On a normal machine Remotion downloads and uses its own browser.
