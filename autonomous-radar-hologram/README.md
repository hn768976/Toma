# Autonomous Radar Hologram

Wireframe "self-driving perception" motion graphic built with **Remotion 4 + Three.js**.
Everything is procedural (no model, texture or font assets): vehicles are lofted
in code, the floor (grid, lane markings, range rings, radar sweep) is one
analytic fragment shader, and glow is an Unreal-bloom post pass.

| Composition        | Size        | FPS | Frames | Length | Notes                                   |
| ------------------ | ----------- | --- | ------ | ------ | --------------------------------------- |
| `RadarHologram-V1` | 3840 × 2160 | 30  | 180    | 6.0 s  | Locked-off chase view (reference match) |
| `RadarHologram-V2` | 3840 × 2160 | 30  | 180    | 6.0 s  | Alternative: low orbiting crane camera  |

## Requirements

Node.js 20.19+ / 22.13+ and npm. Remotion downloads its own headless Chrome on first render.

## Commands

```console
npm install            # install dependencies
npm run dev            # open Remotion Studio (preview both compositions)

npm run render:v1      # 1080p H.264 MP4 of V1  (4K composition rendered at --scale=0.5)
npm run render:v2      # 1080p H.264 MP4 of V2
npm run render         # both of the above

npm run render:v1:4k   # native 3840x2160 master of V1
npm run render:v2:4k   # native 3840x2160 master of V2
```

Output goes to `out/`. Equivalent raw CLI call:

```console
npx remotion render RadarHologram-V1 out/v1.mp4 --scale=0.5
```

Encoding defaults live in `remotion.config.ts`: H.264, yuv420p, BT.709, CRF 16, PNG intermediate frames.

### WebGL backend

The scene needs WebGL. `remotion.config.ts` picks `angle` on macOS/Windows and the
software backend `swangle` on Linux (works on GPU-less servers). Override with
`--gl=angle` / `--gl=swangle` or the `REMOTION_GL` environment variable.

## Structure

```
src/
  index.ts              registerRoot
  Root.tsx              the two 4K compositions
  RadarHologram.tsx     React component: canvas + per-frame deterministic render
  scene/
    buildScene.ts       Three.js scene, cameras (V1 static / V2 orbit), bloom
    ground.ts           floor shader: grid, lanes, rings, radar sweep
    vehicles.ts         procedural wireframe SUV, sedan and box van
```

Timing: radar sweep = 1 revolution / 30 frames, range rings = 90-frame cycle,
road scroll = 0.2 m / frame (the 180-frame clip loops seamlessly).
