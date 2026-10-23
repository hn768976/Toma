# CPU Circuit — Remotion project (Composition 2)

Macro shot of an LGA processor lying on a dark board: gold contact lands,
circuit traces leaving the package edges, and cyan / amber data lights that
wake up from the edge outward and stream along the traces, filmed with a
shallow depth-of-field lens.

* Technology: **Three.js** (WebGL 2) with custom GLSL shaders —
  instanced gold lands, anti-aliased trace ribbons, point-sprite bokeh lights
  sized by their own circle of confusion, depth-buffer depth-of-field, camera
  motion blur, bloom and grade. Procedural from a fixed seed; no external assets.
* Compositions (3840 × 2160, 30 fps, 361 frames = 12.033 s):

| ID                 | Version | Description |
| ------------------ | ------- | ----------- |
| `CpuCircuit-V1-4K` | V1      | Matches the reference: three framings (corner, low close-up along the edge, high view over the trace maze) joined by fast whip moves at 4.8 s and 8.2 s |
| `CpuCircuit-V2-4K` | V2      | Alternative camera: one continuous move — starts high and near top-down over the board, cranes down and orbits round the package corner into a low, grazing glide along the lit edge |

The reference clip is 12.04 s; 361 frames is the closest whole-frame length at
30 fps (difference 7 ms, under half a frame).

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* Remotion downloads its own Chrome Headless Shell on first render.
* No GPU needed (`--gl=angle` falls back to SwiftShader); a GPU is faster.

## Commands

```console
npm i                      # install dependencies
npm run dev                # Remotion Studio preview

# 4K masters
npm run render:v1:4k       # -> out/CpuCircuit-V1-4K.mp4
npm run render:v2:4k       # -> out/CpuCircuit-V2-4K.mp4

# 1080p delivery files (4K composition rendered at --scale=0.5)
npm run render:v1:1080p    # -> out/CpuCircuit-V1-1080p.mp4
npm run render:v2:1080p    # -> out/CpuCircuit-V2-1080p.mp4

npm run lint               # eslint + TypeScript check
```

Output is H.264 / yuv420p MP4 (set in `remotion.config.ts`).

## Layout

```
src/
  index.ts, Root.tsx   registerRoot + the two 4K compositions
  constants.ts         resolution, fps, duration
  cpu/
    CpuCircuit.tsx     scene build + 4-pass render (scene, DOF, lights, final)
    camera.ts          V1 shots + whip moves, V2 crane spline
    layout.ts          package, lands, traces, lights, dust (procedural)
    shaders.ts         GLSL for every material and post pass
    random.ts          seeded PRNG
remotion.config.ts     codec, pixel format, GL backend, JPEG quality
```
