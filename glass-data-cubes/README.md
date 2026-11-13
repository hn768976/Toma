# Glass Data Cubes (Remotion + Three.js, 4K)

A camera flight through a field of translucent "data" glass cubes printed with
code, cross-hair markers, mini bar-charts and animated wire-frame wave graphs.

| Composition id | Description | Size | FPS | Frames |
|---|---|---|---|---|
| `GlassDataCubes-V1-Reference` | Version 1: matches the reference (white studio void, smoky grey glass, graphite print) | 3840×2160 | 30 | 500 (16.667 s) |
| `GlassDataCubes-V2-Blueprint` | Version 2: same scene and camera, re-graded as a dark holographic blueprint (navy, additive cyan glass, amber data waves) | 3840×2160 | 30 | 500 (16.667 s) |

## Technology

- **Remotion 4** (`@remotion/three` `ThreeCanvas`), **React Three Fiber**, **Three.js**
- **WebGL 2 shaders**: a single custom `ShaderMaterial` draws every cube face with
  anti-aliased, constant-pixel-width edges (derivative wireframe), printed data
  from a texture atlas, and depth haze.
- **Canvas 2D**: the "printed data" atlas and background gradient are drawn
  procedurally at runtime. No fonts, images or other external assets are used.
- Everything uses a seeded PRNG, so every render is identical on every machine.

## Commands

```bash
npm install           # install dependencies (Node 20.19+ / 22.13+ / 24+)
npm run dev           # open Remotion Studio

npm run render:v1:4k      # 4K master, Version 1   -> out/GlassDataCubes-V1-Reference-4K.mp4
npm run render:v2:4k      # 4K master, Version 2   -> out/GlassDataCubes-V2-Blueprint-4K.mp4
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
  1080p deliverables are that 4K image downsampled (`--scale=0.5`), which
  supersamples the edges.
- On CPU-only machines a 4K frame takes several seconds; add `--concurrency=N`
  to use more cores.
- If Remotion can't download its Chrome Headless Shell (offline or sandboxed
  machines), point it at a local one:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render:v1:1080p`

## Source layout

```
src/
  index.ts               registerRoot
  Root.tsx               the two 4K compositions
  GlassDataCubes.tsx     scene, camera flight, per-frame animation
  scene/constants.ts     timing, resolution, the two colour palettes
  scene/cubeField.ts     cube layout, merged geometry, GLSL shaders
  scene/dataAtlas.ts     procedural "printed data" atlas + background
  scene/waves.ts         animated wave-graph networks (Line2 + points)
  scene/random.ts        seeded PRNG
```
