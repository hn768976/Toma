# Composition 2 — Sunburst Flare (Remotion · WebGL 2)

A fully procedural recreation of a blown-out sun shining through foliage:
veiling glare, starburst, defocused leaf highlights and lavender lens-flare
ghosts. Everything is drawn by a single WebGL 2 fragment shader
(`src/sunburst/shader.ts`); no footage or image assets are used.

| Composition id                | Size        | FPS | Frames | Duration  | Notes |
|-------------------------------|-------------|-----|--------|-----------|-------|
| `SunburstFlare-V1-Reference`  | 3840 × 2160 | 30  | 506    | 16.867 s  | Locked-off framing matching the reference |
| `SunburstFlare-V2-CameraPan`  | 3840 × 2160 | 30  | 506    | 16.867 s  | Alternative **camera movement**: eased pan + push-in + roll; flare ghosts sweep along the optical axis |

Reference clip length is 16.85 s (1011 frames @ 60 fps) = 505.5 frames at
30 fps. 506 frames is the closest whole-frame length that does not end early
(+17 ms, half a frame).

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
npm run render:v1      # out/SunburstFlare-V1-Reference_1080p.mp4
npm run render:v2      # out/SunburstFlare-V2-CameraPan_1080p.mp4

# Native 4K masters (3840x2160), roughly 4x slower than 1080p on CPU
npm run render:v1:4k
npm run render:v2:4k
```
On a machine with a GPU you can add `--gl=angle` for much faster renders.

## How it works
* `src/Root.tsx` — registers both 4K compositions.
* `src/gl/GlCanvas.tsx` — minimal WebGL 2 runner (see comp 1 README).
* `src/sunburst/scene.ts` — world layout (sun, leaf highlights, bokeh dots),
  the camera model (`staticCamera` / `movingCamera`) and the flare ghosts,
  which are placed on the line from the sun through the frame centre, as in a
  real lens — so in V2 they move correctly as the camera pans.
* `src/sunburst/lightCurve.ts` — per-frame light intensity measured from the
  reference clip (`scripts/extract_light_curve.py`).

All animation is a pure function of the frame number, so renders are
deterministic and can be split across any number of workers.
