# HUD Interface (Remotion · WebGL 2 shader · SVG)

A sci-fi holographic data interface over drifting volumetric smoke, recreated
from a 30 s reference clip (768×432, 30 fps). The interface includes a top
data bar, sector labels, a bar chart, a line graph, gauges, an equalizer, a
moving reticle and crosshair, translucent scan panels and annotation labels.

| Composition ID       | Size        | FPS | Frames | Duration | Description |
|----------------------|-------------|-----|--------|----------|-------------|
| `HudInterface-V1-4K` | 3840 × 2160 | 30  | 900    | 30.000 s | **Version 1**: matches the reference: teal/blue interface, blue smoke, yellow graph points. |
| `HudInterface-V2-4K` | 3840 × 2160 | 30  | 900    | 30.000 s | **Version 2**: the same interface and animation in an alternative amber/red "alert" colour palette (warm smoke, amber lines, red markers, ice-white data points). |

## Requirements

- Node.js 20.19+ or 22.13+ (tested with Node 22)
- About 2 GB of free disk space for `node_modules` and Remotion's headless Chrome. Chrome is downloaded on the first render, so that first render needs internet access.

## Setup

```bash
npm ci
npm run dev     # Remotion Studio preview
```

## Rendering

```bash
npm run render:v1      # -> out/Version1_HUD-Interface_1080p.mp4
npm run render:v2      # -> out/Version2_HUD-Interface_Amber-Palette_1080p.mp4
npm run render:all

# Full-resolution 4K masters:
npm run render:v1:4k
npm run render:v2:4k
```

The 1080p deliverables are rendered from the **4K compositions** with
`--scale=0.5`. `remotion.config.ts` sets the output to H.264, `yuv420p`,
CRF 16.

### WebGL / GPU note
The smoke is a WebGL 2 fragment shader. The config uses `swangle`
(SwiftShader), which works everywhere, including GPU-less servers. Add
`--gl=angle` on a GPU machine for faster renders.

## How it works

```
src/
  Root.tsx                 registers both 4K compositions (900 frames @ 30 fps)
  HudInterface.tsx         smoke canvas + one SVG (viewBox 1920x1080 scaled to 4K)
  palette.ts               TEAL (V1) and AMBER (V2) palettes
  smoke/SmokeLayer.tsx     WebGL 2 shader: drifting soft cloud masses × domain-warped fBm
  hud/TopBar.tsx           data-analysis waveform, sector tables, GPS, CODE box, progress bars
  hud/SidePanels.tsx       sector labels, bar chart, flowing curves, line graph, gauges, equalizer
  hud/Center.tsx           reticle path, crosshair, translucent squares, annotation labels
  lib/anim.ts              boot-flicker, glitch, value-noise and text generators
  lib/random.ts            stateless hash (deterministic frames)
public/fonts/              Share Tech Mono (SIL Open Font License)
```

All HUD art is vector (SVG), so it stays sharp at 4K. Every frame is a pure
function of the frame number.
