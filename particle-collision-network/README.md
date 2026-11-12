# Particle Collision Network — Remotion project (4K)

Glowing plexus strands grow through dark space; the orange orbs at their tips
fly toward each other and collide in bursts of sparks, while the camera
orbits through the cluster with shallow depth of field. The clip ends in a
final collision and dissolves back into the opening shot, like the reference.

| Composition ID | Look | Size | FPS | Frames | Duration |
|---|---|---|---|---|---|
| `V1-ParticleCollision-Original` | Version 1: reference look (navy space, silver plexus, orange orbs) | 3840×2160 | 30 | 799 | 26.633 s |
| `V2-ParticleCollision-AuroraPalette` | Version 2: **alternative colour palette** "Aurora" (teal abyss, mint plexus, magenta/violet orbs). Same camera and animation | 3840×2160 | 30 | 799 | 26.633 s |

## Technology
* **Remotion 4** (scaffolded with `npx create-video --blank`), React 19, TypeScript.
* **Canvas 2D** with a small custom 3D engine (`src/engine/`):
  * `camera.ts`: pinhole projection in 4K pixel space.
  * `dof.ts`: depth-of-field renderer. Geometry is sorted into blur bins by
    circle-of-confusion. Each bin is drawn into a down-scaled offscreen
    canvas, Gaussian-blurred and composited additively. Also contains bloom,
    vignette and film grain.
  * `math.ts`: seeded RNG, vectors, Catmull-Rom splines and easing.
* Every frame is computed from the frame number alone, using seeded
  randomness and no stored state. Renders are deterministic and can run in
  parallel.
* No external assets or network access are needed at render time.

## Commands
Requires Node 20.19+ / 22.13+ (tested with Node 22).

```bash
npm install                 # install dependencies
npm run dev                 # Remotion Studio preview
npm run render:v1:4k        # → out/Version-1_Particle-Collision-Network_4K.mp4        (3840x2160)
npm run render:v2:4k        # → out/Version-2_..._Aurora-Palette_4K.mp4                (3840x2160)
npm run render:v1:1080p     # → out/Version-1_Particle-Collision-Network_1080p.mp4     (4K comp, --scale=0.5)
npm run render:v2:1080p     # → out/Version-2_..._Aurora-Palette_1080p.mp4
npm run render:all:1080p    # both 1080p deliverables
npm run still:v1:4k         # single 4K PNG still (frame 300)
```

Output is H.264 MP4 (yuv420p, CRF 16), as set in `remotion.config.ts`.
You can append extra CLI flags after `--`, for example `npm run render:v1:1080p -- --concurrency=4`.

### Browser
Remotion downloads its own Chrome Headless Shell on the first render.
On machines without internet access, point it to a local Chromium or
headless-shell binary:
```bash
REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render:v1:1080p
```

### Render quality vs speed
The prop `renderScale` (default `1`) sets the internal canvas resolution
relative to the 4K composition. The 1080p deliverables render the 4K
composition with `--scale=0.5` at `renderScale: 1`. Every frame is drawn
natively at 3840×2160 and downsampled to 1920×1080, which gives 2×
supersampled anti-aliasing. For a fast preview, use
`--props='{"palette":"original","renderScale":0.5}' --scale=0.5`. Geometry, timing and colours do not change with
`renderScale`, because everything is authored in 4K pixel units.

Measured on a 4-core cloud VM (software rendering, `--concurrency=4`):
about 0.5 s per frame for 1080p output and about 0.9 s per frame for 4K output.

## File map
```
src/Root.tsx                              both 4K compositions
src/ParticleCollision/ParticleCollision.tsx   React component, canvas + loop dissolve
src/ParticleCollision/scene.ts            world build (strands, collisions, dust), camera path, per-frame render
src/ParticleCollision/palettes.ts         V1 original + V2 aurora palettes
src/engine/*                              shared Canvas 2D 3D/DOF engine
remotion.config.ts                        codec / quality configuration
```
