# Fiber Optic Data Cables — Remotion project (4K)

Motion-graphic recreation of the reference clip: glowing fibre-optic strands sweep in from the
lower-left of a deep navy void, black data cables rise out of the bundle carrying USB-C, USB-A and
RJ45 connectors, then the camera whips round to a low angle looking back down the bundle.

| Composition ID | Version | Resolution | FPS | Frames | Duration |
| --- | --- | --- | --- | --- | --- |
| `FiberOpticCables-V1-Reference` | Version 1 – matches the reference (electric blue on navy) | 3840×2160 | 30 | 301 | 10.033 s |
| `FiberOpticCables-V2-AmberPalette` | Version 2 – alternative **colour palette** (molten amber/copper on deep plum) | 3840×2160 | 30 | 301 | 10.033 s |

Duration matches the reference exactly (301 frames @ 30 fps).

## Technology
- **Remotion 4** (scaffolded with `npx create-video --blank`), React 19, TypeScript.
- **Three.js (WebGL 2)** driven by a small deterministic renderer (`src/engine/GLStage.tsx`):
  each frame is rendered from the frame number only, so Remotion can render frames out of order
  and in parallel.
- Custom GLSL: camera-facing fibre ribbons with growth animation, travelling light pulses and a
  circle-of-confusion depth-of-field approximation (`src/fiber/strands.ts`); bokeh fibre tips;
  cable growth via shader injection into `MeshPhysicalMaterial`.
- Procedurally modelled connectors (`src/fiber/connectors.ts`), PMREM studio environment for
  reflections, UnrealBloom, SMAA, final grade (vignette, grain, subtle chromatic aberration).
- True camera motion blur during the whip move (temporal accumulation of sub-frame renders).
- No external image/video/font assets are needed — everything is generated in code.

## Commands
```bash
npm install                 # install dependencies
npm run dev                 # Remotion Studio preview
npm run typecheck           # TypeScript check

# Delivery renders (4K composition rendered natively at 1920×1080, H.264 MP4)
npm run render:v1:1080p
npm run render:v2:1080p

# Full 4K UHD renders (3840×2160, H.264 MP4)
npm run render:v1:4k
npm run render:v2:4k

# Single still for a quick check
npm run still:v1
```
Outputs go to `out/`. Equivalent raw CLI:
`npx remotion render FiberOpticCables-V1-Reference out/v1.mp4 --scale=0.5`.

## Delivery mastering (optional)
Remotion writes full-range (`yuvj420p`) H.264. The delivered MP4s were normalised to
broadcast-standard limited-range `yuv420p`, BT.709-tagged, with `+faststart`:
```bash
npm run master -- out/input.mp4 out/output-master.mp4   # requires ffmpeg on PATH
```

## Rendering notes
- `remotion.config.ts` sets H.264, yuv420p, CRF 16, JPEG frames, concurrency 2 and
  `--gl=swangle` (software WebGL, works on any headless Linux box / CI). On a machine with a GPU,
  add `--gl=angle` to the command for a large speed-up.
- `--scale=0.5` makes the WebGL renderer draw natively at 1080p (it follows
  `devicePixelRatio`), so the 1080p delivery is not a downscaled 4K render and is ~4× faster.
- Offline machines: if Remotion cannot download Chrome Headless Shell, point it at an installed
  one: `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render:v1:1080p`.
- Software rendering is CPU-heavy (≈1–10 s per 1080p frame; the motion-blurred whip frames are
  the slowest).

## Structure
```
src/
  Root.tsx                 compositions (4K, 30 fps, 301 frames)
  engine/GLStage.tsx       deterministic WebGL stage + temporal motion blur
  engine/post.ts           renderer, bloom, SMAA, grade
  engine/track.ts          C1-continuous camera keyframe interpolation
  engine/random.ts         seeded PRNG + easing
  fiber/scene.ts           scene layout, camera path, timing
  fiber/strands.ts         fibre ribbon + tip shaders
  fiber/connectors.ts      USB-C / USB-A / RJ45 models and materials
  fiber/palette.ts         Version 1 and Version 2 colour palettes
```
