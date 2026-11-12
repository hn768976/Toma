# Finance Infographics — Remotion + Three.js (4K)

A bright studio-grey field of floating financial infographics — layered area
charts, green bar charts, teal equaliser bars, pastel pie charts, donut rings,
dotted line charts and constantly ticking numbers (`-20457,376`, `+8,464 %`) —
popping in and out with glitchy horizontal streaks and a lens depth of field.

| Composition id | Version | Camera |
|---|---|---|
| `FinanceInfographics-V1-SlowPush-4K` | Version 1 | Near locked-off slow push-in, matches the reference |
| `FinanceInfographics-V2-OrbitGlide-4K` | Version 2 | Alternative camera movement: an elevated orbital glide that arcs around one side of a world-anchored field of cards while dollying in and banking, so the cards are always seen at an angle with strong parallax |

* Resolution **3840×2160 (4K UHD)**, **30 fps**, **900 frames = 30.000 s** (exact reference length)
* Technology: **Three.js (WebGL 2)** with instanced GLSL sprites
  - charts are drawn once with **Canvas 2D** into an 8192×4096 mip-mapped atlas
  - numbers are instanced glyph quads; the digits are re-chosen **in the vertex
    shader** every few frames, so thousands of labels tick without CPU work
  - per-sprite depth-of-field (9-tap Poisson + mip bias, circle of confusion from depth)
  - full-screen shader for the glitch streaks / smear bands and the vignette background
* Every frame is a pure function of the frame number (seeded randomness).

## Requirements

* Node.js 20.19+ / 22.13+ (tested with Node 22)
* npm

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # open Remotion Studio (preview / scrub)

npm run render:v1:4k        # full 4K render   -> out/finance-infographics-v1-slow-push-4k.mp4
npm run render:v2:4k        # full 4K render   -> out/finance-infographics-v2-orbit-glide-4k.mp4
npm run render:v1:1080p     # 1080p delivery   -> out/finance-infographics-v1-slow-push-1080p.mp4
npm run render:v2:1080p     # 1080p delivery   -> out/finance-infographics-v2-orbit-glide-1080p.mp4
npm run still:v1            # single 4K frame  -> out/finance-infographics-v1-frame300-4k.png
npm run lint                # TypeScript check
```

The 1080p renders use `--scale=0.5`: the composition stays 4K, the WebGL
framebuffer is rendered at 1920×1080 and encoded as H.264 (yuv420p, CRF 18).

## WebGL / browser notes

`remotion.config.ts` defaults to `--gl=swangle` (ANGLE on SwiftShader), which
works everywhere, including headless servers without a GPU. With a GPU:

```bash
REMOTION_GL=angle npm run render:v1:4k
```

Offline machine without Remotion's Chrome Headless Shell:

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npm run render:v1:1080p
```

## Assets

* `public/fonts/Inter-Light.otf` — Inter (SIL Open Font License, see
  `public/fonts/Inter-LICENSE.txt`), loaded with `FontFace` before the atlases are drawn.

## Project layout

```
src/
  index.ts                     registerRoot
  Root.tsx                     the two 4K compositions
  lib/useThreeScene.ts         Remotion <-> Three.js bridge, seeded RNG/hash helpers
  fin/
    FinanceInfographics.tsx    composition component + font loading
    buildFinance.ts            spawning, instanced sprites, shaders, streaks, background
    atlas.ts                   Canvas 2D chart atlas and glyph atlas
    cameraRigs.ts              Slow Push (V1) and Orbit Glide (V2)
    palettes.ts                colours
```
