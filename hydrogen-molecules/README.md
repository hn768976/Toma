# Hydrogen Molecules — 4K Remotion project

Glossy H₂ molecules drifting in a pale-blue lab space, with a fly-through intro
from a white-out and a hero molecule held in focus.

| Composition ID | Version | Description |
| --- | --- | --- |
| `HydrogenMolecules-V1-Match` | Version 1 | Matches the reference: fast dolly-in from a white-out with zoom blur, then settles on the hero molecule. |
| `HydrogenMolecules-V2-OrbitCamera` | Version 2 | Alternative **camera movement**: an extreme close-up pull-back into a low-angle orbit that sweeps ~110° around the hero, framed on the left third. The palette stays the same. |

* **Resolution:** 3840 × 2160 (4K UHD). Both compositions are authored at 4K.
* **Frame rate:** 30 fps
* **Duration:** 421 frames = 14.033 s. The reference is 14.04 s, and at 30 fps the
  closest whole-frame length is 421 frames (14.04 s would need 421.2 frames).
* **Technology:** Canvas 2D in a 2.5D setup. Molecules have real 3D positions and
  perspective projection. Each molecule gets a Gaussian depth-of-field blur
  based on its distance from the focus plane. Atoms are pre-rendered glass-sphere
  sprites in a mip chain. The background lattice is drawn procedurally. There is
  also distance haze and a radial zoom-blur pass for the dolly. Everything is
  deterministic (seeded PRNG).
* **Assets:** `public/fonts/Inter-Bold.otf` (SIL OFL 1.1; licence in `public/fonts/Inter-LICENSE.txt`).

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* npm

## Commands

```bash
npm install                      # install dependencies
npm run dev                      # open Remotion Studio (preview both compositions)

# Native 4K renders (H.264 MP4, 3840x2160, 30 fps)
npm run render:v1:4k
npm run render:v2:4k

# 1080p deliverables rendered from the 4K compositions (--scale=0.5)
npm run render:v1:1080p
npm run render:v2:1080p
```

Or use the CLI directly:

```bash
npx remotion render HydrogenMolecules-V1-Match out/v1-4k.mp4
npx remotion render HydrogenMolecules-V2-OrbitCamera out/v2-1080p.mp4 --scale=0.5
```

Renders go to `out/`. `remotion.config.ts` sets the H.264 codec, yuv420p, CRF 16
and JPEG frames at quality 95.

### Headless / GPU-less machines

Rendering works without a GPU. If Remotion can't download its own Chrome Headless
Shell, for example because the network is restricted, point it at a local one:

```bash
REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render:v1:1080p
```

## Source layout

```
src/
  index.ts                 registerRoot
  Root.tsx                 the two 4K compositions
  hydrogen/
    HydrogenMolecules.tsx  React component: loads font, builds sprites, draws each frame
    scene.ts               world generation, camera paths (V1 / V2), projection, DOF, post
    sprites.ts             glass-sphere "H2" atom sprites (mip chain)
    palette.ts             colours sampled from the reference
    math.ts                vector helpers + seeded PRNG
public/fonts/              Inter Bold + licence
```
