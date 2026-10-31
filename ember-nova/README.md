# Ember Nova — Remotion + Three.js (4K)

Comet trails swirl through a dark, ember-filled space, converge into an orbit,
fuse into a blinding nova, and burst into an expanding particle shockwave
before settling into a glowing ember haze.

| Composition    | Size        | FPS | Frames | Duration | Look                                  |
| -------------- | ----------- | --- | ------ | -------- | ------------------------------------- |
| `EmberNova-V1` | 3840 × 2160 | 30  | 270    | 9.000 s  | Matches the reference: molten orange  |
| `EmberNova-V2` | 3840 × 2160 | 30  | 270    | 9.000 s  | Alternative palette: electric plasma blue / violet |

## Technology

- **Three.js (WebGL 2) with custom GLSL shaders**, driven frame-by-frame from
  Remotion's `useCurrentFrame()`. No wall-clock time is used, so every frame
  is deterministic and renders in parallel.
- Additive "light" compositing: instanced sprite layers (heads, flares,
  smoke, sparks, embers, burst and shell particles), tube/glow ribbon meshes
  for the comet trails, and full-screen shaders for the background and the
  shockwave ring. Overlapping orange naturally saturates to yellow-white,
  like the reference footage.
- Smoke uses a seeded, procedurally generated fBm noise texture, so the
  project has no external image assets.

## Project layout

```
src/
  index.ts / Root.tsx      Composition registration (4K, 30 fps, 270 frames)
  lib/ThreeStage.tsx       Frame-driven Three.js renderer for Remotion
  lib/math.ts              Seeded RNG, easing, envelopes, Hermite key spline
  ember/timeline.ts        Comet flight paths traced from the reference
  ember/palette.ts         FIRE (V1) and PLASMA (V2) palettes
  ember/layers.ts          Sprite / ribbon GPU layers + noise texture
  ember/scene.ts           Scene build + per-frame update
  ember/EmberNova.tsx      React component
remotion.config.ts         H.264, yuv420p, CRF 16, WebGL renderer selection
```

## Commands

```bash
npm install

npm run dev              # Remotion Studio preview

npm run render:1080p     # both versions -> out/*_1080p.mp4 (4K comp rendered at --scale=0.5)
npm run render:v1        # EmberNova-V1 only, 1920x1080
npm run render:v2        # EmberNova-V2 only, 1920x1080

npm run render:4k        # both versions at native 3840x2160
```

Equivalent raw CLI: `npx remotion render EmberNova-V1 out/v1.mp4 --scale=0.5`.

### Renderer notes

- WebGL defaults to `swangle` (SwiftShader via ANGLE), which works on any
  machine including GPU-less servers. On a workstation with a GPU you can
  speed things up with `REMOTION_GL=angle npm run render:1080p`.
- On first render Remotion downloads Chrome Headless Shell. On an offline
  machine, point it at an existing Chromium instead:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render:1080p`.
