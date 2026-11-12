# Fiber Optic Light Streams — Remotion project (4K compositions)

Procedural fiber-optic light streaks with travelling colour waves, glowing bokeh tips, out-of-focus foreground cables and floor reflections (Three.js / WebGL 2 point-sprite bokeh renderer + HDR bloom pipeline).

Everything is generated procedurally in code, so there are no external media assets (the `public/` folder is intentionally empty).

## Compositions

| Composition ID | Resolution | FPS | Duration | Description |
|---|---|---|---|---|
| `Fiber-Optic-Light-Streams-V1-Reference` | 3840×2160 (4K UHD) | 30 | 471 frames = 15.700 s | **Version 1** – Matches the reference: light enters from the lower left, then rainbow → orange → ice-blue → magenta → blue colour waves flow along the fibres. |
| `Fiber-Optic-Light-Streams-V2-Aurora-Palette` | 3840×2160 (4K UHD) | 30 | 471 frames = 15.700 s | **Version 2** – Alternative colour palette "Aurora": emerald, teal, cyan and gold waves with matching bokeh tips; identical geometry, timing and camera. |

The duration equals the reference clip exactly (471 frames at 30 fps).

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- npm

## Commands

```bash
npm ci                 # install exact dependency versions from package-lock.json
npm run dev            # open Remotion Studio to preview both compositions

npm run render:all     # render both versions -> out/*.mp4 (1920x1080 H.264, 30 fps)
npm run render:v1      # Version 1 only (1080p delivery)
npm run render:v2      # Version 2 only (1080p delivery)
npm run render:v1:4k   # full 3840x2160 master of Version 1
npm run render:v2:4k   # full 3840x2160 master of Version 2
npm run still:4k       # single 4K still (frame 150) for a quick check
```

The 1080p delivery files are rendered from the 4K compositions with Remotion's `--scale=0.5`
(the WebGL canvas is rendered at 3840×2160 and downsampled to 1920×1080, which also acts as
2×2 supersampled anti-aliasing).

Render settings live in `remotion.config.ts`: H.264, `yuv420p`, CRF 16, JPEG frames at quality 95,
and the `swangle` OpenGL renderer (software WebGL via ANGLE + SwiftShader). This works on any
machine, including GPU-less servers, and gives deterministic frames. On a machine with a GPU you can
pass `--gl=angle` for faster renders.

### Offline / restricted network

On first render Remotion downloads *Chrome Headless Shell*. If that host is blocked, point Remotion at
any local Chrome / Chromium build, either with an environment variable (works with every npm script):

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render:all
```

or with the CLI flag:

```bash
npx remotion render Fiber-Optic-Light-Streams-V1-Reference out/v1.mp4 --scale=0.5 --browser-executable=/path/to/chrome-headless-shell
```

## Source layout

- `src/Root.tsx` – registers both 4K compositions
- `src/fibers/palettes.ts` – colour-wave theme sequences for V1 (reference) and V2 (Aurora)
- `src/fibers/variants.ts` – per-version settings
- `src/fibers/createFiberRenderer.ts` – fibre paths, light streaks, bokeh tips, reflections, camera
- `src/engine/bokehMaterial.ts` – thin-lens depth-of-field point-sprite shader (GLSL)
- `src/engine/pipeline.ts` – half-float HDR target, 2-level bloom, filmic tone-map
- `src/engine/GLCanvas.tsx` – frame-accurate WebGL canvas for Remotion
- `src/engine/random.ts` – seeded PRNG (deterministic renders)
- `remotion.config.ts` – codec / quality / OpenGL settings
