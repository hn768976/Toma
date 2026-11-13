# Skin Hydration Cells — Remotion + Three.js

A water drop lands on a layer of dry, amber skin cells, releases a stream of
bubbles and the cells swell into luminous aqua pearls. Everything is procedural
(custom GLSL shaders, instanced geometry, depth of field, bloom) — there are no
external assets.

Created with the Remotion CLI (`npx create-video@latest --blank`).

| Composition ID                    | Size      | FPS | Frames | Length   |
| --------------------------------- | --------- | --- | ------ | -------- |
| `SkinHydration-V1-Reference-4K`   | 3840x2160 | 30  | 226    | 7.5333 s |
| `SkinHydration-V2-CameraMove-4K`  | 3840x2160 | 30  | 226    | 7.5333 s |

- **Version 1 – Reference match:** rolled camera that starts above the top cell
  layer, sinks past its edge and bobs between the layers, like the reference.
- **Version 2 – Camera move:** identical scene, timing and palette, but a level
  horizon with a crane-down into the gap followed by a slow frontal dolly-in.

## Install

```bash
npm install
```

Node 20.19+ / 22.13+ is required.

## Preview

```bash
npm run dev
```

## Render

The compositions are authored in 4K. The 1080p deliverables are rendered from
the same 4K compositions with `--scale=0.5`.

```bash
npm run render:v1      # 1080p H.264 MP4 -> out/
npm run render:v2
npm run render:all     # both 1080p versions

npm run render:v1:4k   # native 3840x2160
npm run render:v2:4k
```

Or call the Remotion CLI directly:

```bash
npx remotion render SkinHydration-V1-Reference-4K out/v1-1080p.mp4 --scale=0.5 --muted
npx remotion render SkinHydration-V1-Reference-4K out/v1-4k.mp4 --muted
```

`remotion.config.ts` sets H.264 / yuv420p / CRF 16 and the software WebGL
backend (`swangle`), so renders work on machines without a GPU. On a GPU
workstation you can pass `--gl=angle` for faster renders.

Offline or sandboxed machines: Remotion downloads its own headless Chrome on
first render. If that is not possible, point it to an existing one with
`--browser-executable=/path/to/chrome-headless-shell`.

## Project layout

```
src/
  index.ts              registerRoot
  Root.tsx              the two <Composition> definitions
  Hydration.tsx         V1 / V2 components
  engine/Stage.tsx      frame-driven Three.js canvas for Remotion
  engine/post.ts        depth of field, bloom, grade, grain + math helpers
  scene/hydration.ts    scene, animation timeline and both camera paths
  scene/shaders.ts      GLSL (cells, membrane, drop, bubbles, backdrop)
```

Every frame is a pure function of the frame number (seeded PRNG, no
`Math.random()`), so renders are deterministic and can be parallelised.
