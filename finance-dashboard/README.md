# Finance Dashboard — 3D HUD motion graphic (Remotion + Three.js)

A perspective "financial HUD": a glowing grid board with a bar chart that builds
bar by bar, a line chart with live-ticking value labels, pie/wedge indicators,
dot-matrix read-outs, text blocks and a side panel (histogram + area chart),
filmed by a slowly drifting, rolling camera.

Scaffolded with the Remotion CLI (`npx create-video@latest --three`).

| Spec | Value |
| --- | --- |
| Composition size | 3840 × 2160 (4K UHD) |
| Frame rate | 30 fps |
| Duration | 360 frames = 12.000 s |
| Delivery | 1920 × 1080 H.264 MP4 (`--scale=0.5`) |

## Compositions

| ID | Description |
| --- | --- |
| `FinanceDashboard` | Matches the reference: navy/teal board, aqua-green bars, cyan widgets. |
| `FinanceDashboardEmber` | Same animation and camera move, alternate warm "ember" palette (plum board, amber bars, coral widgets). |

Both take `palette` (`ocean` / `ember`) and `camera` props, editable in the Studio.

## How it works

- **Canvas 2D** (`src/dashboard/draw.ts`) draws every widget, per frame, into an
  8000 × 4500 transparent texture. All animation is a pure function of the frame
  number (hash-based randomness), so renders are deterministic.
- **Three.js / WebGL 2** (`src/dashboard/FinanceDashboard.tsx`) maps that texture
  onto a large board plane with a custom shader that:
  - draws the anti-aliased grid procedurally, so the board never ends;
  - fakes depth of field by biasing the mip level with distance from focus;
  - adds bloom from coarse mip levels and a soft key-light pool.
- **Camera** (`src/dashboard/camera.ts`) is keyframed as look-at point, distance,
  tilt, azimuth, roll and FOV, interpolated with Catmull-Rom splines.

## Commands

```console
npm i
npm run dev                      # Remotion Studio

# 1080p deliverables from the 4K compositions
npx remotion render FinanceDashboard      out/FinanceDashboard-1080p.mp4      --scale=0.5 --codec=h264 --crf=16 --image-format=png --pixel-format=yuv420p
npx remotion render FinanceDashboardEmber out/FinanceDashboardEmber-1080p.mp4 --scale=0.5 --codec=h264 --crf=16 --image-format=png --pixel-format=yuv420p

# Full 4K master
npx remotion render FinanceDashboard out/FinanceDashboard-4k.mp4 --codec=h264
```
