# Cyber Data Wall — Remotion + Three.js (4K)

Low-angle, shallow-depth-of-field shot of a towering "data server" wall: rows of
protruding rack panels with flickering barcode bars and luminous light blocks,
dot-matrix displays scrolling `0 1 A - .` glyphs, laser fans that shoot from
floating hubs onto the wall, and drifting dust particles.

| Composition id | Version | Look |
|---|---|---|
| `CyberDataWall-V1-SteelBlue-4K` | Version 1 | Cold steel-blue monochrome, matches the reference |
| `CyberDataWall-V2-AmberCore-4K` | Version 2 | Alternative colour palette: molten amber/gold wall with teal laser accents |

* Resolution **3840×2160 (4K UHD)**, **30 fps**, **570 frames = 19.000 s** (exact reference length)
* Technology: **Three.js (WebGL 2)** driven imperatively from Remotion
  (`src/lib/useThreeScene.ts`), GLSL shaders for the procedural wall and panels,
  a lens depth of field (scene + depth texture rendered once, a quarter-resolution
  box-filtered copy for large blur radii, then one full-screen DOF + grade pass:
  exposure, vignette, grain, fade-in). Each render target is written once and
  read afterwards, which keeps software WebGL free of partially-updated tiles.
* Every frame is a pure function of the frame number (seeded randomness), so
  renders are deterministic and parallel-safe.

## Requirements

* Node.js 20.19+ / 22.13+ (tested with Node 22)
* npm

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # open Remotion Studio (preview / scrub)

npm run render:v1:4k        # full 4K render   -> out/cyber-data-wall-v1-steel-blue-4k.mp4
npm run render:v2:4k        # full 4K render   -> out/cyber-data-wall-v2-amber-core-4k.mp4
npm run render:v1:1080p     # 1080p delivery   -> out/cyber-data-wall-v1-steel-blue-1080p.mp4
npm run render:v2:1080p     # 1080p delivery   -> out/cyber-data-wall-v2-amber-core-1080p.mp4
npm run still:v1            # single 4K frame  -> out/cyber-data-wall-v1-frame300-4k.png
npm run lint                # TypeScript check
```

The 1080p renders use `--scale=0.5`: the composition stays 4K, Remotion renders
the WebGL framebuffer at half the device-pixel-ratio and encodes H.264
(yuv420p, CRF 18) at 1920×1080.

## WebGL / browser notes

`remotion.config.ts` defaults to `--gl=swangle` (ANGLE on SwiftShader), which
works on every machine including headless servers without a GPU. On a
workstation with a GPU you can render much faster with:

```bash
REMOTION_GL=angle npm run render:v1:4k
```

If Remotion cannot download its Chrome Headless Shell (offline machine), point
it at any installed Chrome/Chromium:

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npm run render:v1:1080p
```

## Project layout

```
src/
  index.ts                 registerRoot
  Root.tsx                 the two 4K compositions
  lib/useThreeScene.ts     Remotion <-> Three.js bridge, seeded RNG/hash helpers
  datawall/
    CyberDataWall.tsx      composition component (variant v1 / v2)
    buildDataWall.ts       scene, shaders, laser fans, particles, DOF + grade pass
    cameraRigs.ts          low-angle drift camera + depth-of-field settings
    palettes.ts            Steel Blue (V1) and Amber Core (V2) palettes
```

No external image/video assets are needed: all textures are generated procedurally
in shaders.
