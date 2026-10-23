# Moonlit Sea & Archive Corridor — 4K Remotion compositions

Two procedural motion pieces recreated from reference footage, each in two
versions. Every composition is authored at **3840×2160, 30 fps, 300 frames
(10.000 s)**, matching the reference clips exactly.

| Composition ID | Technology | Description |
| --- | --- | --- |
| `MoonlitSea-V1-Reference` | WebGL 2 fragment shader | Full moon over a calm sea, drifting pink/periwinkle clouds, twinkling stars, broken moon path on the water. Matches the reference. |
| `MoonlitSea-V2-TealAmber` | WebGL 2 fragment shader | Same scene and motion, alternative **colour palette**: teal night sky, amber clouds, golden moon. |
| `ArchiveCorridor-V1-Reference` | Three.js (WebGL 2) | Endless corridor of filing-cabinet drawers, steady forward dolly (one cabinet bay per 42 frames, as in the reference) with the reference's gentle exposure lift. |
| `ArchiveCorridor-V2-DollyZoomRoll` | Three.js (WebGL 2) | Same corridor, alternative **camera move**: a "vertigo" dolly-zoom (lens widens 28° → ~90° while pushing in) combined with a slow 20° barrel roll. |

Both reference clips carry a silent audio track, so the renders contain no
audio.

## Requirements

- Node.js 20.19+ / 22.13+ (tested with Node 22)
- FFmpeg on `PATH` (only for the 1080p downscale step in `scripts/render-all.sh`)
- A browser with WebGL 2. Remotion downloads its own Chrome Headless Shell;
  rendering uses ANGLE, which falls back to SwiftShader on GPU-less machines.

## Commands

```console
npm ci                      # install exact dependency versions
npm run dev                 # open Remotion Studio to preview all four compositions
npm run lint                # eslint + TypeScript type-check
```

Render a single composition at full 4K:

```console
npx remotion render MoonlitSea-V1-Reference out/MoonlitSea-V1-Reference-2160p.mp4
```

Render a single composition directly at 1080p (browser-side downscale):

```console
npx remotion render ArchiveCorridor-V1-Reference out/ArchiveCorridor-V1-1080p.mp4 --scale=0.5
```

Render everything the way the deliverables were produced — 4K H.264 master,
then a Lanczos downsample to the 1080p H.264 deliverable:

```console
npm run render:all          # or ./scripts/render-all.sh <CompositionId>
```

Outputs land in `out/4k/` and `out/1080p/`.

Rendering is CPU/GPU heavy at 4K: on a 4-core machine without a GPU expect
roughly 2.5 s per frame for the moon scene and 5 s per frame for the corridor.

## Layout

```
src/
  Root.tsx                    composition registry (4K, 30 fps, 300 frames)
  moonlit/shader.ts           GLSL ES 3.0 sky / moon / water shader
  moonlit/MoonlitSea.tsx      WebGL 2 canvas wrapper + both palettes
  archive/scene.ts            Three.js corridor: instanced drawers, floor, lighting
  archive/ArchiveCorridor.tsx frame-driven camera rigs for both versions
scripts/render-all.sh         4K master + 1080p deliverable pipeline
remotion.config.ts            codec, pixel format, ANGLE/WebGL settings
```

Everything is procedural: there are no external image, font or audio assets.
