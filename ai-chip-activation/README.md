# AI Chip Activation (Remotion + Three.js)

A macro shot of a processor on a dark motherboard. A blue holographic "AI"
plate descends in a curtain of light, lands on the chip, and a pulse of energy
races out through the circuit traces before the chip settles as dark glass
with glowing "AI" lettering.

| Composition ID          | What it is                                                     |
| ----------------------- | -------------------------------------------------------------- |
| `AiChip-V1-Reference`   | Version 1 – matches the reference camera (three-quarter push, swing to front on impact) |
| `AiChip-V2-OrbitCamera` | Version 2 – same scene, alternative camera (high rear start, descending orbit into a low hero angle) |

Both compositions are **3840x2160 (4K), 30 fps, 241 frames (8.03 s)**.

## Requirements

- Node.js 20.19+ / 22.13+ (tested with Node 22)
- No external assets: geometry, PCB artwork and lettering are generated in code.

## Commands

```bash
npm install                 # install dependencies

npm run dev                 # open Remotion Studio (preview / scrub)

# Final 1080p H.264 MP4s (the 4K composition rendered at half scale)
npx remotion render AiChip-V1-Reference   out/ai-chip-v1-1080p.mp4 --scale=0.5
npx remotion render AiChip-V2-OrbitCamera out/ai-chip-v2-1080p.mp4 --scale=0.5

# Native 4K masters
npx remotion render AiChip-V1-Reference   out/ai-chip-v1-4k.mp4
npx remotion render AiChip-V2-OrbitCamera out/ai-chip-v2-4k.mp4

# Single frame check
npx remotion still AiChip-V1-Reference out/frame.png --frame=120 --scale=0.5
```

`remotion.config.ts` already sets H.264 / yuv420p / CRF 16 and the `swangle`
software WebGL backend, which works on machines without a GPU. On a machine
with a GPU add `--gl=angle` for much faster renders. Software rendering takes
roughly 5 s per 1080p frame and about four times that at 4K.

## Technology

- **Remotion 4** drives time: every frame is a pure function of `frame / fps`.
- **Three.js (WebGL 2)** with custom GLSL shaders: instanced board components,
  animated trace ribbons, a depth-of-field pass, UnrealBloom and a grade pass.

## Layout

```
src/
  index.ts             registerRoot
  Root.tsx             the two 4K compositions
  AiChip.tsx           React component hosting the WebGL canvas
  scene/
    createScene.ts     scene graph, shaders, timeline, post chain
    board.ts           procedural component placement and trace fan-out
    textures.ts        canvas-drawn PCB artwork and "AI" lettering
    camera.ts          camera keyframes for both versions
    util.ts            seeded RNG, easing, keyframe interpolation
```
