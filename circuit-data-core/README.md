# Circuit Data Core (Remotion + Three.js, 4K)

A glowing translucent "data core" (a glass block of memory cells, twinkling bits
and etched circuitry) sitting on a chip substrate on an energised printed circuit
board, shot with a shallow depth of field.

| Composition id | Description | Size | FPS | Frames |
|---|---|---|---|---|
| `CircuitDataCore-V1-Reference` | Version 1: matches the reference. A slow push-in that swings ~20° from corner-on towards the front face while the camera lowers from ~50° to ~23° elevation | 3840×2160 | 30 | 450 (15.0 s) |
| `CircuitDataCore-V2-OrbitCrane` | Version 2: same look, different camera move. A low, sweeping 130° orbit that starts almost at board level and cranes up to a high three-quarter view | 3840×2160 | 30 | 450 (15.0 s) |

The reference clip is 450 frames at 29.97 fps (15.015 s). At the required 30 fps
the same 450 frames last 15.000 s, so the timing matches the reference frame for frame.

## Technology

- **Remotion 4** (`@remotion/three` `ThreeCanvas`), **React Three Fiber**, **Three.js**
- **WebGL 2 shaders** (`src/scene/shaders.ts`):
  - circuit floor: tiled PCB, pulsing energy in the traces, a light pool from the
    core, depth haze, and a fake depth of field that blends three pre-blurred
    texture levels by circle of confusion
  - data-core shells: procedural memory-cell grid, flickering bits, scan band,
    etched circuitry, fresnel glass, bevel glow. Five nested additive shells
    over a dark indigo body, plus a floor reflection
  - floating motes rendered as bokeh discs sized by the circle of confusion
- **Canvas 2D**: the circuit-board textures (and their blurred focus levels) are
  drawn procedurally at runtime. No external images or fonts are used.
- Seeded PRNG, so renders are deterministic.

## Commands

```bash
npm install           # install dependencies (Node 20.19+ / 22.13+ / 24+)
npm run dev           # open Remotion Studio

npm run render:v1:4k      # 4K master, Version 1  -> out/CircuitDataCore-V1-Reference-4K.mp4
npm run render:v2:4k      # 4K master, Version 2  -> out/CircuitDataCore-V2-OrbitCrane-4K.mp4
npm run render:v1:1080p   # 1080p delivery, Version 1 (4K comp rendered at --scale=0.5)
npm run render:v2:1080p   # 1080p delivery, Version 2
npm run still:v1          # single 4K test frame
npm run lint              # eslint + tsc
```

Output is H.264 MP4 (`yuv420p`, CRF 16), as set in `remotion.config.ts`.

### Rendering notes

- `remotion.config.ts` selects the `swangle` (ANGLE + SwiftShader) WebGL backend,
  which works on any machine, including headless servers without a GPU. On a
  machine with a GPU, add `--gl=angle` to render much faster.
- The WebGL canvas always renders at the full 4K composition resolution. The
  1080p deliverables are that 4K image downsampled (`--scale=0.5`).
- On CPU-only machines a 4K frame takes several seconds; add `--concurrency=N`
  to use more cores.
- If Remotion can't download its Chrome Headless Shell (offline or sandboxed
  machines), point it at a local one:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render:v1:1080p`

## Source layout

```
src/
  index.ts                  registerRoot
  Root.tsx                  the two 4K compositions
  CircuitDataCore.tsx       scene graph, both camera moves, per-frame animation
  scene/constants.ts        timing, resolution, scene dimensions
  scene/circuitTextures.ts  procedural PCB + cube-trace textures (Canvas 2D)
  scene/shaders.ts          GLSL shaders (floor, core shells, motes)
  scene/random.ts           seeded PRNG
```
