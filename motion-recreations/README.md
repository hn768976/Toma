# Motion recreations (Remotion, 4K)

Two motion-graphics compositions recreated from reference clips, each in two versions.
All four compositions are authored at **3840 × 2160 (4K UHD), 30 fps, 601 frames (20.033 s)**
and delivered as 1080p H.264 MP4 files.

| Composition ID | What it is | Technology |
| --- | --- | --- |
| `C1-V1-DotGrid` | Version 1: matches reference 1. A 62 × 32 grid of square dots on white, each dot twinkling around its own brightness level in aqua/teal | Canvas 2D |
| `C1-V2-DotGrid-Midnight` | Version 2: **color-palette alternative**. Same grid, timing and twinkle on a deep-navy field, with dots that glow from electric cyan (left) to violet (right) | Canvas 2D |
| `C2-V1-VortexField` | Version 1: matches reference 2. A grainy monochrome field of six optical vortices whose bright crescents spin around dark cores (3 full turns in 20 s) | WebGL 2 shaders |
| `C2-V2-VortexField-Flyover` | Version 2: **camera-angle/movement alternative**. The same spinning vortex field on a tilted ground plane (36° pitch), with the camera gliding forward and slowly yawing, and depth falloff toward the horizon | WebGL 2 shaders |

## Requirements

- Node.js 20.19+, 22.13+ or 24+
- Remotion downloads its own Chrome Headless Shell on first render. If a Playwright
  Chromium exists at `/opt/pw-browsers/...` (some sandboxes), `remotion.config.ts` uses that.

## Commands

```console
npm install              # install dependencies
npm run dev              # open Remotion Studio to preview all four compositions

npm run render:all       # render all four as 1080p H.264 MP4 into out/
npm run render:all:4k    # render all four as full 4K H.264 MP4 into out/

npm run render:c1v1      # single composition (1080p); also :c1v2, :c2v1, :c2v2
npm run render:c1v1:4k   # single composition at 4K
npm run lint             # ESLint + TypeScript
```

The 1080p deliverables are rendered from the 4K compositions with `--scale=0.5`,
so every frame is computed at 4K and downsampled (supersampled) to 1920 × 1080.
Codec settings (H.264, yuv420p, CRF 16) live in `remotion.config.ts`.

WebGL uses software ANGLE (`swangle`) so the shader renders identically on machines
without a GPU. Rendering takes roughly 4 min per Canvas composition and 10–20 min per
WebGL composition at 1080p on a 4-core CPU (4K takes longer).

## Project layout

```
src/
  index.ts              registerRoot
  Root.tsx              the four <Composition>s (4K, 30 fps, 601 frames)
  shared/constants.ts   size / fps / duration
  shared/random.ts      seeded PRNG (deterministic renders)
  dotgrid/DotGrid.tsx   Canvas 2D dot grid renderer
  dotgrid/palettes.ts   reference + "Midnight" palettes
  dotgrid/index.tsx     the two composition components
  vortex/shader.ts      WebGL 2 shaders (vortex field pass + 4K grain composite pass)
  vortex/VortexField.tsx WebGL 2 two-pass renderer, locked-off and flyover cameras
```

No external image, video, font or audio assets are used; everything is procedural.

## Timing note

Both references are 20.02 s long (600 frames at 29.97 fps). At exactly 30 fps that is
600.6 frames, which no whole-frame video can hit. 601 frames (20.033 s, +13 ms) is the
nearest achievable duration; 600 frames would be 20.000 s (−20 ms).

## How the references were matched

- **Dot grid:** grid pitch/offset, per-dot brightness distribution, the soft vertical
  bands of activity (~30 columns apart), twinkle speed (decorrelates in ~0.3 s) and dot
  colors were all measured from the reference frames.
- **Vortex field:** the reference turned out to be almost a single temporal harmonic with a
  6.67 s period. Six vortex positions, phases, widths and spiral twists were fitted to it
  (frames correlate 0.83–0.94 with the reference), then a tone curve matched to the
  reference's luminance distribution and shadow-weighted film grain matched to its
  measured grain size and strength.
