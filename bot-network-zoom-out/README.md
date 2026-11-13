# Bot Network Zoom-Out (Remotion + Three.js)

A field of glassy app tiles joined by a thin network. Little helper bots
materialise next to tiles, hop on, and each finished tile turns to the "done"
colour with a spinning check mark. The camera starts low between the tiles and
cranes up and back until the whole floor becomes a grid of glowing dots.

| Composition ID              | What it is                                               |
| --------------------------- | -------------------------------------------------------- |
| `BotNetwork-V1-Reference`   | Version 1 – matches the reference (navy / blue / red / green) |
| `BotNetwork-V2-DuskPalette` | Version 2 – same shot, alternative palette (plum / violet / teal / gold) |

Both compositions are **3840x2160 (4K), 30 fps, 481 frames (16.03 s)**.

## Requirements

- Node.js 20.19+ / 22.13+ (tested with Node 22)
- No external assets: all geometry, icons and textures are generated in code.

## Commands

```bash
npm install                 # install dependencies

npm run dev                 # open Remotion Studio (preview / scrub)

# Final 1080p H.264 MP4s (the 4K composition rendered at half scale)
npx remotion render BotNetwork-V1-Reference   out/bot-network-v1-1080p.mp4 --scale=0.5
npx remotion render BotNetwork-V2-DuskPalette out/bot-network-v2-1080p.mp4 --scale=0.5

# Native 4K masters
npx remotion render BotNetwork-V1-Reference   out/bot-network-v1-4k.mp4
npx remotion render BotNetwork-V2-DuskPalette out/bot-network-v2-4k.mp4

# Single frame check
npx remotion still BotNetwork-V1-Reference out/frame.png --frame=120 --scale=0.5
```

`remotion.config.ts` already sets H.264 / yuv420p / CRF 16 and the `swangle`
software WebGL backend, which works on machines without a GPU. On a machine
with a GPU add `--gl=angle` for much faster renders. Software rendering takes
roughly 3–4 s per 1080p frame and about four times that at 4K.

## Technology

- **Remotion 4** drives time: every frame is a pure function of `frame / fps`.
- **Three.js (WebGL 2)** with custom GLSL shaders, instanced meshes for the
  ~48,000 tiles and ~24,000 bots, and an UnrealBloom post pass.

## Layout

```
src/
  index.ts             registerRoot
  Root.tsx             the two 4K compositions
  BotNetwork.tsx       React component hosting the WebGL canvas
  scene/
    createScene.ts     scene graph, shaders, per-frame animation, post chain
    layout.ts          tile lattice, bot timelines, network links
    geometry.ts        tile / bot / check-mark geometry, icon atlas
    camera.ts          camera keyframes
    palette.ts         the two colour palettes (edit here to restyle)
    util.ts            seeded RNG, easing, keyframe interpolation
```
