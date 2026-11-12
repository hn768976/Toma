# Server Room Fly-through — Remotion project (4K)

Recreation of the reference clip: a continuous forward dolly down a dark data-centre aisle lined
with server racks full of blinking status LEDs, bright ceiling light bars, a glossy reflective floor
and a lit bank of racks at the end of the aisle.

| Composition ID | Version | Resolution | FPS | Frames | Duration |
| --- | --- | --- | --- | --- | --- |
| `ServerRoom-V1-Reference` | Version 1 – matches the reference (steady eye-level dolly) | 3840×2160 | 30 | 401 | 13.367 s |
| `ServerRoom-V2-LowAngleCrane` | Version 2 – alternative **camera angle & movement** (low-angle crane rising from floor level, weaving and banking) | 3840×2160 | 30 | 401 | 13.367 s |

Duration matches the reference exactly (401 frames @ 30 fps).

## Technology
- **Remotion 4** (scaffolded with `npx create-video --blank`), React 19, TypeScript.
- **Three.js (WebGL 2)** with a deterministic per-frame renderer (`src/engine/GLStage.tsx`).
- Rack fronts are a procedural GLSL shader (`src/server/rackShader.ts`): 42U racks of servers,
  storage shelves, switches, LED matrices and blanking panels; every LED blinks on its own
  deterministic schedule; detail is band-limited with screen-space derivatives to avoid shimmer.
- Planar mirror floor (`Reflector`) with a custom streaky-gloss shader, PMREM environment,
  instanced rack posts / pillars / ceiling lights, exponential fog, UnrealBloom, SMAA, film grade.
- Temporal motion blur (2 sub-frame samples per frame).
- No external image/video/font assets — everything is generated in code.

## Commands
```bash
npm install
npm run dev                 # Remotion Studio preview
npm run typecheck

# Delivery renders (4K composition rendered natively at 1920×1080, H.264 MP4)
npm run render:v1:1080p
npm run render:v2:1080p

# Full 4K UHD renders (3840×2160, H.264 MP4)
npm run render:v1:4k
npm run render:v2:4k

npm run still:v1            # single still
```
Outputs go to `out/`. Raw CLI equivalent:
`npx remotion render ServerRoom-V1-Reference out/v1.mp4 --scale=0.5`.

## Rendering notes
- `remotion.config.ts`: H.264, yuv420p, CRF 16, concurrency 2, `--gl=swangle` (software WebGL
  for headless Linux / CI). With a GPU, add `--gl=angle` for a large speed-up.
- `--scale=0.5` renders the 4K composition natively at 1080p (renderer follows
  `devicePixelRatio`).
- Offline machines: `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render:v1:1080p`.

## Structure
```
src/
  Root.tsx                 compositions (4K, 30 fps, 401 frames)
  engine/                  deterministic WebGL stage, post chain, helpers
  server/scene.ts          aisle construction, floor reflections, lighting
  server/rackShader.ts     procedural rack / LED shader
  server/camera.ts         Version 1 dolly and Version 2 low-angle crane paths
  server/palette.ts        colours
```
