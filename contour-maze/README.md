# Contour Maze — Remotion project (4K)

Glowing "contour-wall" landscape: every iso-line of a slowly morphing scalar
field is extruded into a thin neon wall (contour spacing 0.06). The glowing
core is a raised, icy-blue plateau whose maze is a set of nested offset rings
of a winding ribbon, with one large spiral. The ribbon starts as a tightly
folded serpentine and unrolls into a diagonal hook (a narrow arm at the top
left sweeping down and right into a wide body whose tail curls back in).
Ember-orange terrain walls hug the core outline and step down away from it:
a few broad, tall, glowing terraces at the start that multiply into dense
wavy contours as the core unrolls. A warm glow hangs around the core while
the camera eases in and tilts from an oblique view to a steeper one. Light
pulses run along individual walls.

| Composition      | Size        | FPS | Frames | Duration | Look |
|------------------|-------------|-----|--------|----------|------|
| `ContourMaze-V1` | 3840 × 2160 | 30  | 400    | 13.333 s | Reference recreation: orange/amber terrain, cream rims, icy-blue core |
| `ContourMaze-V2` | 3840 × 2160 | 30  | 400    | 13.333 s | Alternative colour palette: deep-sea teal/cyan terrain, rose-magenta core, gold light pulses |

## Technology

* **WebGL 2 + GLSL shaders** (no extra libraries), rendered on a `<canvas>`
  inside a Remotion composition.
* Pass 1 bakes the scalar field into a float texture; pass 2 ray-marches the
  contour walls (with analytic anti-aliased rim tubes); passes 3–5 build a
  two-level bloom; pass 6 tone-maps (hue-preserving) and outputs sRGB.
* Fully deterministic: everything is a function of the frame number
  (seeded PRNG for the light pulses), so any frame can be rendered in isolation.
* Resolution independent: the canvas renders at the output resolution
  (3840 × 2160 at `--scale=1`, 1920 × 1080 at `--scale=0.5`).

Source layout:

```
src/index.ts          entry (registerRoot)
src/Root.tsx          the two 4K compositions
src/ContourMaze.tsx   React component: canvas + per-frame render
src/variants.ts       timing, camera path, palettes for V1/V2, light pulses
src/gl/shaders.ts     all GLSL (field, ray-march, bloom, composite)
src/gl/renderer.ts    WebGL 2 pipeline
src/gl/glUtils.ts     small WebGL helpers
remotion.config.ts    render defaults (H.264, yuv420p, CRF 16, GL backend)
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
npm run render:v1        # -> out/ContourMaze-V1_1080p.mp4
npm run render:v2        # -> out/ContourMaze-V2_1080p.mp4

# Full 4K masters (3840x2160)
npm run render:v1:4k     # -> out/ContourMaze-V1_4K.mp4
npm run render:v2:4k     # -> out/ContourMaze-V2_4K.mp4

# Single 4K still for a quick check
npm run still:4k
```

Equivalent raw CLI: `npx remotion render ContourMaze-V1 out/v1.mp4 --scale=0.5`.
Codec (H.264), pixel format (yuv420p) and CRF are set in `remotion.config.ts`.

### GPU / CPU notes

* WebGL is provided through ANGLE + SwiftShader (`swangle`) by default, which
  works on any machine, including headless servers without a GPU.
* On a machine with a GPU, renders are much faster with
  `REMOTION_GL=angle npm run render:v1`.
* Remotion downloads its Chrome Headless Shell on first render. If that
  download is blocked, point to an existing one:
  `REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render:v1`.
* CPU-only (swangle) speed is roughly 10-15 s per 1080p frame on 4 cores, so a
  full 400-frame render takes ~1.5 h. If the first frame is slow on a loaded
  machine, add `--timeout=300000`. A frame range can be rendered with
  `--frames=0-99` and the parts joined with `ffmpeg -f concat -c copy`.

## Notes on duration

The reference clip is 400 frames at 29.97 fps (13.347 s). At exactly 30 fps
the same 400 frames last 13.333 s; that is the closest duration achievable at
a constant 30 fps (difference 13 ms, under half a frame).
