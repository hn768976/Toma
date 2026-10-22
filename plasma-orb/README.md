# Plasma Orb — Remotion project (Composition 1)

A glowing energy orb of beaded plasma strands streaming toward its poles,
with an energy surge (flare + excitation ring) at ~3–6 s and soft light rays
rising from the top. Rendered with **Three.js (WebGL 2)**: ~1.1 M GPU
particles with custom GLSL shaders and an Unreal bloom pass.

| Composition id | Look | Size | FPS | Frames |
| --- | --- | --- | --- | --- |
| `PlasmaOrb-V1` | Electric blue / violet / magenta (matches the reference) | 3840×2160 | 30 | 450 (15.0 s) |
| `PlasmaOrb-V2` | Alternative colour palette: solar gold / orange / crimson | 3840×2160 | 30 | 450 (15.0 s) |

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
  Root.tsx            compositions (4K, 30 fps, 450 frames)
  orb/PlasmaOrb.tsx   React entry, picks the palette per version
  orb/scene.ts        Three.js scene, GLSL shaders, timeline of the surge
  orb/strands.ts      CPU streamline tracing that builds the strand geometry
  orb/palettes.ts     V1 and V2 colour palettes
  gl/                 WebGL host component, noise, PRNG, helpers
```
