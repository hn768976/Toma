# Particle Brain Formation (Remotion + Three.js)

A scrambled, writhing sheet of glowing particles folds itself into a human brain:
a red → green colour wave sweeps back to front while the surface settles, then
the finished point-cloud brain slowly turns.

| Composition         | Size              | FPS | Frames | Duration | Look |
|---------------------|-------------------|-----|--------|----------|------|
| `BrainFormationV1`  | 3840×2160 (4K UHD) | 30  | 300    | 10.000 s | Matches the reference: cyan-white body, green frontal lobe, red accents |
| `BrainFormationV2`  | 3840×2160 (4K UHD) | 30  | 300    | 10.000 s | Alternative **colour palette** "Neural Ember": gold body, magenta frontal lobe, violet accents |

## Technology

* **Remotion 4** (project scaffolded with `npx create-video --blank`).
* **Three.js (WebGL 2)** with custom GLSL shaders:
  * ~600k particles sampled on a procedural brain surface (signed-distance
    ellipsoids for the hemispheres, temporal lobes, cerebellum and brainstem, with
    gyri/sulci carved by domain-warped simplex noise).
  * A wire mesh and the particles share one GPU deformation field
    (`chaosDisplace`), so the "crumpled sheet" and the formed brain are the same
    surface.
  * A depth-only/dim body pass hides the far hemisphere once the brain is formed.
  * Post: UnrealBloom + vignette.
* Everything is a pure function of the frame number and seeded RNG, so frames
  render identically in any order and in parallel.

## Assets

No external assets are needed: all geometry, textures, particles and effects are
generated procedurally in code (`src/`). `public/` is intentionally empty.

## Commands

Requires Node.js 20.19+ / 22.13+ / 24+.

```bash
npm install                 # install dependencies
npm run dev                 # Remotion Studio preview

# Final deliverables: the 4K compositions rendered at 1080p (H.264 MP4)
npm run render:v1           # -> out/Version 1 - Particle Brain Formation.mp4
npm run render:v2           # -> out/Version 2 - Particle Brain Formation (Neural Ember Palette).mp4
npm run render:all

# Full 4K masters (slow on CPU-only machines)
npm run render:v1:4k
npm run render:v2:4k
```

`--scale=0.5` makes Remotion render the 4K composition with a device pixel ratio
of 0.5; the scene sizes its WebGL drawing buffer from that ratio, so it rasterises
natively at 1920×1080 with identical framing.

### Rendering notes

* `remotion.config.ts` sets H.264, CRF 16, yuv420p and the `swangle`
  (SwiftShader) OpenGL backend, which works on servers without a GPU. On a
  machine with a GPU add `--gl=angle` for much faster renders.
* If a Playwright Chrome Headless Shell exists at the path in
  `remotion.config.ts` it is used; otherwise Remotion downloads its own.
* No audio (the reference has none).
