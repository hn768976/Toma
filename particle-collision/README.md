# Particle Collision (Remotion · Three.js · WebGL 2)

Two crossing ribbons of glowing golden particles with a "data scan" HUD overlay.
Recreated from a 20 s reference clip (768×432, 30 fps).

| Composition ID            | Size        | FPS | Frames | Duration | Description |
|---------------------------|-------------|-----|--------|----------|-------------|
| `ParticleCollision-V1-4K` | 3840 × 2160 | 30  | 600    | 20.000 s | **Version 1**: matches the reference. It opens on a wedge of striated particle sheets fanning out from a bright apex, swings round into the crossing "X" by about 7 s, then tilts down until the sheets read as two bright edge-on filaments. |
| `ParticleCollision-V2-4K` | 3840 × 2160 | 30  | 600    | 20.000 s | **Version 2**: same scene, look and HUD, filmed with a different camera: a reverse-angle orbit about 80° around the back of the collision, craning down from a high three-quarter view. The ribbons sweep the other way and never resolve into V1's frontal X. |

## Requirements

- Node.js 20.19+ or 22.13+ (tested with Node 22)
- About 2 GB of free disk space for `node_modules` and Remotion's headless Chrome. Chrome is downloaded on the first render, so that first render needs internet access.

## Setup

```bash
npm ci          # installs the exact versions in package-lock.json
npm run dev     # opens Remotion Studio to preview the compositions
```

## Rendering

```bash
npm run render:v1      # -> out/Version1_Particle-Collision_1080p.mp4
npm run render:v2      # -> out/Version2_Particle-Collision_Orbit-Camera_1080p.mp4
npm run render:all     # both

# Full-resolution 4K masters (slower):
npm run render:v1:4k
npm run render:v2:4k
```

The 1080p deliverables are rendered from the **4K compositions** with
`--scale=0.5`. The WebGL canvas still draws at full 3840×2160 and is
downsampled, so the 1080p output is supersampled.

`remotion.config.ts` sets the output format: H.264, `yuv420p`, CRF 16, 30 fps
(taken from the composition), with JPEG frames at quality 95.

### WebGL / GPU note
The scene needs WebGL 2. The config uses `swangle` (SwiftShader through ANGLE),
which works on any machine, including servers without a GPU. On a machine with
a GPU, add `--gl=angle` for much faster renders:

```bash
npx remotion render ParticleCollision-V1-4K out/v1.mp4 --scale=0.5 --gl=angle
```

## How it works

```
src/
  index.ts / Root.tsx         registers both 4K compositions (600 frames @ 30 fps)
  ParticleCollision.tsx       layers: WebGL particle field + Canvas 2D HUD
  scene/
    geometry.ts               ~305k particles (edge, comb-rung and fill particles); ribbon spines
                              (cubic Béziers) and sheet widths
    shaders.ts                GLSL ES 3.00 shaders: particle motion and depth of field,
                              bloom blur, HDR tone mapping with mesh, vignette and dither
    ParticleField.tsx         raw Three.js renderer: HDR (half-float) target,
                              2× box-downsample bloom chain, tone-map pass
    camera.ts                 V1 and V2 camera paths: Catmull-Rom keyframe splines (pure functions of time)
  hud/HudOverlay.tsx          Canvas 2D: scan line, travelling rings, sliding panel,
                              data rows (sharp with glow, or defocused and smeared),
                              bokeh orbs, dot matrix, frames
  lib/random.ts               seeded PRNG and hash, so every frame is deterministic
  lib/font.ts                 loads the bundled HUD font (public/fonts)
public/fonts/                 Share Tech Mono (SIL Open Font License, see the .txt file)
```

Every frame is a pure function of the frame number. Particles move in the
vertex shader from static attributes and `uTime`, and the HUD uses stateless
hashes, so parallel and partial renders are identical to a full render.
