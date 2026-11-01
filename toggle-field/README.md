# Toggle Field – 4K Remotion composition

A field of paper-cut "toggle switch" pieces laid out on a 45° lattice. The tracks sit
at four heights and cast soft shadows. The knobs slide on and off, some pieces swing
around, and the whole field drifts diagonally. It is built with **Three.js** (WebGL 2)
inside Remotion, using real extruded geometry, soft VSM shadow maps and a
perspective camera.

| Composition      | Size        | FPS | Frames | Duration  | Description |
|------------------|-------------|-----|--------|-----------|-------------|
| `ToggleField-V1` | 3840 × 2160 | 30  | 320    | 10.667 s  | Matches the reference: flat top-down view, measured diagonal drift |
| `ToggleField-V2` | 3840 × 2160 | 30  | 320    | 10.667 s  | Alternative **camera**: tilted perspective camera that orbits 52° and dollies in over the same animated world |

The reference clip is 320 frames at 29.97 fps (10.677 s). At exactly 30 fps the
closest possible length is 320 frames = 10.667 s, which is 0.01 s shorter (a third of a frame).

## Requirements
- Node.js 20.19+ or 22.13+ (tested with Node 22.23 / npm 10.9)
- ~2 GB free disk for dependencies and the Chrome Headless Shell download

## Commands
```bash
npm install          # install dependencies
npm run dev          # open Remotion Studio to preview the compositions

npm run render:v1    # -> out/ToggleField-V1_1080p.mp4  (4K comp rendered at --scale=0.5, H.264)
npm run render:v2    # -> out/ToggleField-V2_1080p.mp4
npm run render:v1:4k # -> out/ToggleField-V1_4K.mp4     (native 3840x2160)
npm run render:v2:4k # -> out/ToggleField-V2_4K.mp4
npm run lint         # eslint + TypeScript type-check
```
To render any composition directly, run `npx remotion render <CompositionId> <output.mp4> [--scale=0.5]`.

## Notes
- `remotion.config.ts` sets H.264, yuv420p, JPEG frames at quality 95 and the
  `swangle` OpenGL backend (ANGLE + SwiftShader). That backend renders WebGL on any
  machine, including GPU-less servers. On a workstation with a GPU you can add
  `--gl=angle` for much faster renders.
- If a Playwright Chrome Headless Shell exists at the path in `remotion.config.ts`, it
  is reused. Otherwise Remotion downloads its own browser on first render.
- The WebGL canvas always renders at the full composition resolution (`pixelRatio: 1`
  prop), so a 1080p render is a supersampled downscale of the 4K frame. To make
  previews faster you can pass a lower value, for example
  `--props='{"camera":"top-down","seed":7,"pixelRatio":0.5}'`.
- Every frame is a pure function of the frame number, so renders are deterministic and
  safe to run in parallel.

## Source layout
```
src/
  index.ts            registerRoot
  Root.tsx            the two 4K compositions
  ToggleField.tsx     composition component + zod schema
  lib/ThreeStage.tsx  vanilla Three.js <-> Remotion bridge (delayRender per frame)
  lib/random.ts       seeded PRNG + easing helpers
  toggle/palette.ts   colours sampled from the reference
  toggle/world.ts     lattice generator, knob flips and piece rotations (timed events)
  toggle/camera.ts    drift curve measured from the reference + V2 orbit path
  toggle/scene.ts     geometry, materials, lights, shadows, per-frame update
```
