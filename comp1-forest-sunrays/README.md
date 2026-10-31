# Composition 1 — Forest Sunrays (Remotion · WebGL 2)

A fully procedural recreation of a defocused forest canopy with drifting
bokeh, sun haze and two lens streaks. Everything is drawn by a single
WebGL 2 fragment shader (`src/forest/shader.ts`); no footage or image assets
are used.

| Composition id                 | Size        | FPS | Frames | Duration  | Notes |
|--------------------------------|-------------|-----|--------|-----------|-------|
| `ForestSunrays-V1-Reference`   | 3840 × 2160 | 30  | 601    | 20.033 s  | Matches the reference look, layout and light timing |
| `ForestSunrays-V2-GoldenHour`  | 3840 × 2160 | 30  | 601    | 20.033 s  | Alternative **colour palette**: warm golden-hour light |

Reference clip length is 20.02 s (600 frames @ 29.97 fps). At exactly 30 fps
20.02 s is 600.6 frames; 601 frames is the closest whole-frame length
(+13 ms, under half a frame).

## Requirements
* Node.js 20.19+ / 22.13+ / 24+
* Nothing else: Remotion downloads its own headless Chrome on first render.
  No GPU is needed. WebGL 2 runs through ANGLE + SwiftShader (`--gl=swangle`,
  set in `remotion.config.ts`).

## Commands
```bash
npm install            # install dependencies (uses package-lock.json)
npm run dev            # open Remotion Studio to preview both compositions

# Delivery renders: 4K compositions rendered at scale 0.5 -> 1920x1080 H.264 MP4
npm run render:v1      # out/ForestSunrays-V1-Reference_1080p.mp4
npm run render:v2      # out/ForestSunrays-V2-GoldenHour_1080p.mp4

# Native 4K masters (3840x2160), roughly 4x slower than 1080p on CPU
npm run render:v1:4k
npm run render:v2:4k
```
Equivalent raw CLI: `npx remotion render ForestSunrays-V1-Reference out/v1.mp4 --scale=0.5`.
On a machine with a GPU you can add `--gl=angle` for much faster renders.

## How it works
* `src/Root.tsx` — registers both 4K compositions.
* `src/gl/GlCanvas.tsx` — minimal WebGL 2 runner; draws one full-screen
  triangle per frame. The canvas backing store is `composition size ×
  devicePixelRatio`, so `--scale=0.5` shades exactly 1920×1080 pixels and a
  scale-1 render shades native 4K pixels.
* `src/forest/discs.ts` — seeded bokeh layout (left branch cluster, mid-frame
  highlights, background field) and per-frame wind sway / twinkle.
* `src/forest/lightCurve.ts` — per-frame global light intensity measured from
  the reference clip (see `scripts/extract_light_curve.py`), reproducing the
  timing of the sunlight dips as leaves pass in front of the sun.
* `src/forest/palettes.ts` — V1 teal reference palette, V2 golden-hour palette.

All animation is a pure function of the frame number, so renders are
deterministic and can be split across any number of workers.
