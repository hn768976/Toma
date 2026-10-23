# Ocean & Sky compositions (Remotion, 4K)

Two procedural compositions, each in two versions. All four are authored at **3840×2160, 30 fps**:

| Composition ID   | Concept | Version | Duration | Technology |
|------------------|---------|---------|----------|------------|
| `Underwater-V1`  | Sun rays under the ocean surface | Matches the reference (clear ocean blue) | 240 frames / 8.000 s | WebGL 2 fragment shader |
| `Underwater-V2`  | Same scene | Alternative **colour palette**: emerald lagoon, warm golden light shafts | 240 frames / 8.000 s | WebGL 2 fragment shader |
| `MoonClouds-V1`  | Flight over a moonlit cloud deck | Matches the reference (steady forward glide, moon low right, cloud sweeps past early) | 300 frames / 10.000 s | Three.js (custom shaders) |
| `MoonClouds-V2`  | Same scene | Alternative **camera move**: the camera emerges from the cloud tops and cranes up into a banking right turn, so the moon swings toward the centre of frame | 300 frames / 10.000 s | Three.js (custom shaders) |

Everything is generated procedurally, so there are no external image or video assets.

## Setup

Requires Node.js 20.19+ or 22.13+.

```console
npm ci
```

## Preview

```console
npm run dev
```

## Render

Deliverables are rendered at 1920×1080 from the 4K compositions using `--scale=0.5`. The output is H.264 MP4, yuv420p, CRF 16 (set in `remotion.config.ts`).

```console
npm run render:c1v1   # out/Comp1_Underwater_V1_1080p.mp4
npm run render:c1v2   # out/Comp1_Underwater_V2_1080p.mp4
npm run render:c2v1   # out/Comp2_MoonClouds_V1_1080p.mp4
npm run render:c2v2   # out/Comp2_MoonClouds_V2_1080p.mp4
npm run render:all
```

To render at native 4K, drop `--scale`, e.g. `npx remotion render MoonClouds-V1 out/MoonClouds-V1-4K.mp4`.

The compositions use WebGL. Rendering uses Chrome's ANGLE backend (`Config.setChromiumOpenGlRenderer("angle")`), which falls back to software rendering on machines without a GPU. Expect roughly 1–3 s per frame on a 4-core CPU.

## Layout

```
src/
  Root.tsx                 composition registry (4 x 4K compositions)
  lib/constants.ts         size, fps, durations
  underwater/              WebGL 2 shader scene + palettes (V1 ocean, V2 lagoon)
  clouds/                  Three.js scene: sky/moon shader, procedural puff atlas,
                           cloud field layout, camera paths (V1 glide, V2 banking rise)
```
