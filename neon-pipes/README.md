# Neon Pipes (Remotion, 4K)

A looping abstract motion graphic: a chain of thick, rounded bars arranged in
an interlocking isometric "maze", wrapped by thin wire tubes that carry
travelling neon light pulses, over a dark ground with fine diagonal stripes.
The camera tracks slowly along the chain.

Built with **Remotion 4** and **Three.js (WebGL 2)**: real-time geometry, soft
PCF shadows, a custom GLSL wire shader for the light pulses, and an Unreal
bloom pass.

| Composition ID            | Size        | FPS | Frames | Duration | Notes                                                  |
| ------------------------- | ----------- | --- | ------ | -------- | ------------------------------------------------------ |
| `NeonPipes-V1-Reference`  | 3840 × 2160 | 30  | 270    | 9.000 s  | Matches the reference: navy, periwinkle, coral, yellow |
| `NeonPipes-V2-EmberTeal`  | 3840 × 2160 | 30  | 270    | 9.000 s  | Alternative colour palette: teal ground, amber bars, aqua wires, icy-cyan light |

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- About 2 GB free RAM per render process. A GPU is optional.

## Commands

```console
npm ci                 # install the exact dependency versions from package-lock.json
npm run dev            # open Remotion Studio to preview the compositions
npm run render:v1      # 4K composition -> out/NeonPipes-V1-Reference-1080p.mp4 (H.264, 1920x1080, 30 fps)
npm run render:v2      # 4K composition -> out/NeonPipes-V2-EmberTeal-1080p.mp4
npm run render:all     # both of the above
npm run render:v1:4k   # optional: full 3840x2160 master
npm run render:v2:4k
npm run lint           # eslint + TypeScript type check
```

To deliver at 1080p, the 1080p renders use `--scale=0.5`. The WebGL canvas
still renders every frame at the full 3840 × 2160, and Chromium then
downsamples it 2:1, which works as 4× supersampling.

### GPU vs. software rendering

`remotion.config.ts` defaults to `--gl=swangle` (SwiftShader through ANGLE),
which works on any machine, including headless servers with no GPU. On a
machine with a GPU, run for example `REMOTION_GL=angle npm run render:v1`,
which is much faster.

If Remotion can't download its own Chrome Headless Shell, point it at an
existing one with `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.

## Project layout

```
src/
  index.ts                 registerRoot
  Root.tsx                 the two 4K compositions (30 fps, 270 frames)
  NeonPipes.tsx            picks the palette for each variant
  ThreeStage.tsx           hosts a Three.js WebGL 2 renderer inside Remotion (deterministic per frame)
  palettes.ts              V1 reference palette + V2 "ember/teal" palette
  scene/NeonPipesScene.ts  geometry, wire pulse shader, lights, shadows, bloom, camera rig
  scene/paths.ts           stroke-outline + rounded-corner path helpers
remotion.config.ts         codec (H.264, yuv420p, CRF 16), GL backend, timeouts
```

All geometry and textures are generated procedurally, so the project has no
external media assets.
