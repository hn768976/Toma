# Particle Blob Morph — 4K Remotion project

A deforming blob made of ~21,600 shaded beads that folds into layered ridges and
relaxes into a smooth pebble, on a studio-sweep background.

| Composition ID                    | Version | Look                                   | Size        | FPS | Duration          |
| --------------------------------- | ------- | -------------------------------------- | ----------- | --- | ----------------- |
| `V1-Particle-Blob-Morph-Cobalt`   | 1       | Matches the reference (cobalt on navy) | 3840 × 2160 | 30  | 300 frames / 10.0 s |
| `V2-Particle-Blob-Morph-Ember`    | 2       | Alternative colour palette (ember on plum) | 3840 × 2160 | 30  | 300 frames / 10.0 s |

## Technology

* **Three.js + WebGL 2 / GLSL ES 3.0 shaders** (`src/blob/shaders.ts`)
  * 4D simplex noise deformation field evaluated on the GPU for every bead and
    for the dark "skin" mesh beneath them (shared function, so they never drift apart).
  * Each bead is a point sprite shaded as a sphere impostor (key + fill +
    specular + rim light, self-shadowing and cavity darkening from the surface normal).
  * The field is cross-faded between `t` and `t − loop` so the 10 s clip loops seamlessly.
* Dots sit on a spherified-cube lattice (`src/blob/lattice.ts`) to keep the
  tidy bead rows of the reference.
* Palettes live in `src/blob/palettes.ts` — V2 is only a palette swap.

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* ~2 GB free RAM per render worker

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # open Remotion Studio (preview / scrub)

# Delivery renders: 4K composition rendered at scale 0.5 -> 1920x1080 H.264 MP4
npm run render:v1
npm run render:v2

# Full native 4K (3840x2160) renders
npm run render:v1:4k
npm run render:v2:4k

npm run still:4k            # single 4K PNG frame (quick smoke test)
```

All outputs go to `out/`. Encoding settings (H.264, yuv420p, BT.709, CRF 18,
JPEG frame capture at q95) are in `remotion.config.ts`.

### Notes

* WebGL runs through SwiftShader (`--gl=swangle`, set in `remotion.config.ts`) so
  it renders on any machine, including servers without a GPU. On a desktop with a
  GPU, append `--gl=angle` for much faster renders.
* Remotion downloads its own Chrome Headless Shell on first render. In an offline
  / sandboxed environment point it at an existing build instead:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render:v1`.
