# Tile Wave — Remotion project (4K)

A flat pastel sheet of square tiles. Along a "lightning-bolt" staircase path
(long runs along one grid axis alternating with shorter steps along the other,
plus a side branch) the tiles sink and tip into a terraced valley whose floor
glows (pink → violet → periwinkle → white → warm cream), so the band zig-zags
along the grid while running diagonally across it. A rim of raised pink cards
leans in towards the axis like overlapping scales and keeps fluttering while
the band is open. The valley opens from a slit, holds, then closes: columns of
tiles are drawn out into long blades across the band, which relax while the
surface rests. The open/hold/close curve and the 132-frame (~4.4 s) cycle are
fitted to the reference's colour curve.

| Composition   | Size        | FPS | Frames | Duration | Camera |
|---------------|-------------|-----|--------|----------|--------|
| `TileWave-V1` | 3840 × 2160 | 30  | 267    | 8.9 s    | Reference recreation: locked-off steep top-down view, band at ~50° on screen, horizontal lens shift |
| `TileWave-V2` | 3840 × 2160 | 30  | 267    | 8.9 s    | Alternative camera angle + movement: low oblique tracking shot that travels along the valley with a slow orbit |

## Technology

* **Three.js** (`three@0.178`), driven imperatively from a Remotion component.
* ~18,500 thin plates drawn as one `InstancedMesh` with a custom GLSL
  material. Each plate is positioned and tilted per frame (it tips to follow
  the valley slope); the vertex shader curls it like paper and lengthens it
  along the slope so neighbours overlap like scales. Colour is keyed on world
  height (depth palette below the surface, rim palette above it), with soft
  wrap lighting and lavender-tinted shading.
* **Motion blur + anti-aliasing by accumulation:** each output frame averages
  12 sub-frame renders spread over a 0.9-frame shutter, each with a sub-pixel camera
  jitter, into a half-float buffer.
* Fully deterministic: every pillar height is a pure function of the
  (fractional) frame number.
* Resolution independent: the canvas renders at the output resolution
  (3840 × 2160 at `--scale=1`, 1920 × 1080 at `--scale=0.5`).

Source layout:

```
src/index.ts                entry (registerRoot)
src/Root.tsx                the two 4K compositions
src/TileWave.tsx            React component: canvas + per-frame render
src/variants.ts             timing, palette, cameras for V1/V2, blur settings
src/scene/field.ts          grid, lightning path, valley/rim/blade animation, tile poses
src/scene/TileRenderer.ts   Three.js scene, shaders, accumulation pipeline
remotion.config.ts          render defaults (H.264, yuv420p, CRF 16, GL backend)
```

## Setup

Requires Node.js 20.19+ / 22.13+.

```bash
npm ci            # installs the exact versions from package-lock.json
npm run dev       # Remotion Studio preview
```

## Rendering

```bash
# Final deliverables: 1920x1080 H.264 MP4 rendered from the 4K compositions
npm run render:v1        # -> out/TileWave-V1_1080p.mp4
npm run render:v2        # -> out/TileWave-V2_1080p.mp4

# Full 4K masters (3840x2160)
npm run render:v1:4k     # -> out/TileWave-V1_4K.mp4
npm run render:v2:4k     # -> out/TileWave-V2_4K.mp4

# Single 4K still for a quick check
npm run still:4k
```

Equivalent raw CLI: `npx remotion render TileWave-V1 out/v1.mp4 --scale=0.5`.
Codec (H.264), pixel format (yuv420p) and CRF are set in `remotion.config.ts`.

### GPU / CPU notes

* WebGL is provided through ANGLE + SwiftShader (`swangle`) by default, which
  works on any machine, including headless servers without a GPU (slow:
  roughly 5–10 s per 1080p frame on 4 CPU cores because of the 12× motion-blur
  accumulation; a 4K frame takes about 4× longer).
* On a machine with a GPU, renders are much faster with
  `REMOTION_GL=angle npm run render:v1`.
* Remotion downloads its Chrome Headless Shell on first render. If that
  download is blocked, point to an existing one:
  `REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render:v1`.

## Notes on duration

The reference clip is 267 frames at 29.97 fps (8.909 s). At exactly 30 fps
the same 267 frames last 8.900 s; that is the closest duration achievable at
a constant 30 fps (difference 9 ms, under one third of a frame).
