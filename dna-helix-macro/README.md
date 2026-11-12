# DNA Helix Macro (Remotion, 4K)

A macro shot of molecular DNA double helices built from thousands of glossy
spheres, with a lens-style depth of field. It is recreated from the reference
clip and offered in two versions.

| Composition ID | Version | Description |
| --- | --- | --- |
| `DnaHelix-V1-Match` | Version 1 | Matches the reference: a slow, steady push-in on the hero helix. The focus stays locked on it, and the large foreground helix on the left drifts further out of focus. |
| `DnaHelix-V2-OrbitRackFocus` | Version 2 | Alternative **camera move**: a low-angle orbiting crane around the hero helix. A rack focus starts on the foreground helix and pulls to the hero as the camera arcs past. Palette and scene are unchanged. |

* Resolution: **3840 × 2160 (4K UHD)**, **30 fps**, **261 frames = 8.700 s**. This is the exact length of the reference.
* Technology: **raw WebGL 2 + GLSL shaders**, driven by `useCurrentFrame()`.
  Every atom is a ray-traced sphere impostor. Depth of field is computed per
  sprite from the circle of confusion. Strongly defocused spheres are drawn in
  ¼-res and ⅛-res layers and recombined with a bicubic upsample, which keeps
  4K software rendering fast.
* There are no external assets. Geometry, colours and lighting are all procedural, so `public/` is intentionally empty.
* All randomness is seeded, so renders are deterministic and frames can be rendered in parallel.
* There is no audio. The reference has no audio track.

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* Chrome Headless Shell. Remotion downloads it automatically on first render.
  On machines that cannot download it, set `REMOTION_BROWSER=/path/to/chrome-headless-shell`.

## Commands

```bash
npm ci                 # install the exact dependency versions (package-lock.json)
npm run dev            # open Remotion Studio to preview both compositions

npm run render:v1      # 4K master -> out/4k/…V1…_4K.mp4, then 1080p delivery -> out/1080p/
npm run render:v2      # same for Version 2
npm run render:all     # both versions

# Individual steps
npm run render:v1:4k   # remotion render DnaHelix-V1-Match (H.264, CRF 12, 4K)
npm run downscale:v1   # Lanczos 4K -> 1920x1080, H.264 High, CRF 16, yuv420p, BT.709
npx remotion render DnaHelix-V1-Match out/test.mp4 --frames=0-29   # quick partial render
npm run lint           # eslint + TypeScript check
```

Render settings live in `remotion.config.ts`: H.264, yuv420p, BT.709, JPEG
quality 95 and concurrency 2. The OpenGL backend is `swangle` (ANGLE on SwiftShader),
which works on any machine including GPU-less servers. With a GPU you can add
`--gl=angle` to the render command for faster renders.

## Project layout

```
src/index.ts           registerRoot
src/Root.tsx           the two 4K compositions
src/dna/DnaHelix.tsx   component + the two camera rigs (V1 push-in, V2 orbit/rack focus)
src/dna/scene.ts       procedural helix / atom / dust generation and scene layout
src/dna/renderer.ts    WebGL 2 renderer (sphere impostors, tiered DOF, vignette)
src/dna/math.ts        vector helpers + seeded RNG
remotion.config.ts     render configuration
```
