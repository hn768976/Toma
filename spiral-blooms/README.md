# Spiral Blooms (Remotion, 4K)

A seamless 9-second loop of pleated, spiral "bloom" funnels covered in tiny
glossy dots. They turn slowly in a dark blue / teal / violet field, under a
shallow depth of field with bokeh.

Built with **Remotion 4** and **Three.js + custom WebGL 2 shaders**:

- Each bloom is a parametric surface: a twisted, pleated funnel with a lobed
  rim. It is evaluated entirely in the vertex shader, with analytic normals
  from finite differences.
- The dots are GPU instances that stick to the moving pleats. When a bloom is
  out of focus, its dots expand into bokeh discs drawn at full resolution.
- Each bloom is rendered as its own layer, with a thin-lens circle of
  confusion and a golden-angle disc blur, then composited back to front in
  half-float HDR. The final pass adds tone mapping, a vignette and fine grain.
- The pleats advance by a whole number of pleat periods over the clip, so
  frame 270 equals frame 0 and the loop is seamless.

| Composition ID                    | Size        | FPS | Frames | Duration | Notes |
| --------------------------------- | ----------- | --- | ------ | -------- | ----- |
| `SpiralBlooms-V1-Reference`       | 3840 × 2160 | 30  | 270    | 9.000 s  | Locked-off camera that matches the reference framing, focus on the main bloom |
| `SpiralBlooms-V2-DollyRackFocus`  | 3840 × 2160 | 30  | 270    | 9.000 s  | Alternative camera: an arcing dolly-in with roll, plus a rack focus from the left bloom to the main bloom |

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- About 2 GB free RAM per render process. A GPU is optional.

## Commands

```console
npm ci                 # install the exact dependency versions from package-lock.json
npm run dev            # open Remotion Studio to preview the compositions
npm run render:v1      # 4K composition -> out/SpiralBlooms-V1-Reference-1080p.mp4 (H.264, 1920x1080, 30 fps)
npm run render:v2      # 4K composition -> out/SpiralBlooms-V2-DollyRackFocus-1080p.mp4
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
  index.ts                     registerRoot
  Root.tsx                     the two 4K compositions (30 fps, 270 frames)
  SpiralBlooms.tsx             picks the camera rig for each variant
  ThreeStage.tsx               hosts a Three.js WebGL 2 renderer inside Remotion (deterministic per frame)
  scene/flowers.ts             bloom layout, looks (colours) and per-bloom parameters
  scene/SpiralBloomScene.ts    shaders, DOF/bokeh layer pipeline, camera rigs (static / dolly + rack focus)
remotion.config.ts             codec (H.264, yuv420p, CRF 16), GL backend, timeouts
```

All geometry is procedural, so the project has no external media assets.
