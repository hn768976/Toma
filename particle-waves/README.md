# Particle Waves — Remotion project (Composition 2)

An undulating cloth of teal particles: broad folds roll, pinch into glowing
creases, and dissolve into drifting dust in places, with depth-of-field and
bloom. Rendered with **Three.js (WebGL 2)**: a GPU particle grid displaced
by simplex-noise fields in a custom GLSL vertex shader, plus an Unreal bloom
pass.

| Composition id | Camera | Size | FPS | Frames |
| --- | --- | --- | --- | --- |
| `ParticleWaves-V1` | High three-quarter view down into the folds, slow drift (matches the reference) | 3840×2160 | 30 | 450 (15.0 s) |
| `ParticleWaves-V2` | Alternative camera angle and movement: low-altitude banking flyover toward a fog-softened horizon | 3840×2160 | 30 | 450 (15.0 s) |

Everything is a pure function of the frame number (seeded PRNG, no
`Math.random`, no wall-clock time), so frames can render in any order.

## Commands

```console
npm ci                 # install exact dependency versions (Node 20.19+ / 22.13+ / 24+)
npm run dev            # Remotion Studio preview
npm run render:v1      # 1080p H.264 MP4 rendered from the 4K composition (--scale=0.5)
npm run render:v2
npm run render:v1:4k   # full 4K H.264 MP4
npm run render:v2:4k
npm run lint           # eslint + tsc
```

Output goes to `out/`.

### About `--gl=swangle`

WebGL 2 needs a GL backend in headless Chrome. The render scripts pass
`--gl=swangle` (SwiftShader via ANGLE, CPU-only), which works on any machine,
including servers without a GPU. On a machine with a GPU you can swap it for
`--gl=angle` (or `--gl=egl` on Linux) for much faster renders; the output is
the same.

## Layout

```
src/
  Root.tsx                 compositions (4K, 30 fps, 450 frames)
  waves/ParticleWaves.tsx  React entry, picks the camera rig per version
  waves/scene.ts           Three.js scene and GLSL shaders
  waves/looks.ts           palette and the two camera rigs
  gl/                      WebGL host component, noise, PRNG, helpers
```
