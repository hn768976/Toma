# Padlock Circuit Security

A 4K (3840x2160, 30 fps, 301 frames = 10.03 s) motion-graphics composition built with
[Remotion](https://www.remotion.dev) and Three.js (WebGL 2, custom GLSL shaders).
Everything is procedural - there are no external assets - and every frame is a pure
function of the frame number, so renders are deterministic.

| Composition id | What it is |
| --- | --- |
| `PadlockSecurity-V1-Reference` | Version 1 - follows the reference clip |
| `PadlockSecurity-V2-OrbitCamera` | Version 2 - same palette with an alternative camera move (bird's-eye spiral descent into a three-quarter orbit) |

## Requirements

- Node.js 20.19+ / 22.13+
- A machine that can run headless Chrome with WebGL 2 (a GPU is used when available)

## Commands

```bash
npm install            # install dependencies (first run also downloads Remotion's headless Chrome)

npm run dev            # open Remotion Studio and preview both compositions

npm run render:v1      # Version 1 -> out/padlock-security-v1-1080p.mp4  (H.264, 1920x1080, 30 fps)
npm run render:v2      # Version 2 -> out/padlock-security-v2-1080p.mp4
npm run render:all     # both of the above

npm run render:v1:4k   # native 3840x2160 master of Version 1
npm run render:v2:4k   # native 3840x2160 master of Version 2
```

The compositions are authored at 4K. The 1080p deliverables are produced from the very
same compositions with `--scale=0.5`; drop the flag (the `:4k` scripts) for full UHD.

### GPU vs. software rendering

`remotion.config.ts` selects the `angle` OpenGL backend (GPU). On a server without a
GPU use the software rasteriser instead - slower, identical picture:

```bash
REMOTION_GL=swangle npm run render:v1          # or: npx remotion render ... --gl=swangle
```

A 4K frame takes roughly four times as long as a 1080p frame.

## Project layout

```
src/index.ts            Remotion entry point
src/Root.tsx            registers the two 4K compositions (size, fps, duration, props)
src/CircuitScene.tsx    React component hosting the WebGL canvas
src/engine/scene.ts     Three.js scene, timeline and per-frame update
src/engine/layout.ts    procedural PCB: traces, components, connectors
src/engine/camera.ts    keyframed camera moves (reference + alternative)
src/engine/palettes.ts  colour palettes
src/engine/shaders.ts   GLSL for board, traces, chip, hologram, beam, data rain
src/engine/post.ts      depth of field, bloom, zoom blur, grade
scripts/stills.mjs      helper: node scripts/stills.mjs <compositionId> <outDir> <scale> <frames>
remotion.config.ts      codec (H.264), pixel format, GL backend
```
