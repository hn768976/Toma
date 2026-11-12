# Access Denied Login — Remotion project (4K)

A holographic login panel floats in perspective with a shallow tilt-shift
depth of field. The sequence:
1. A cursor appears and the panel opens.
2. "Login" types in.
3. A fingerprint is scanned and docks into the icon slot.
4. A password is typed, with each character turning into a dot.
5. The scan pulses and the field clears.
6. The scene turns red: **ACCESS DENIED** glitches in, and a red security
   network grows around the panel.

| Composition ID | Look | Size | FPS | Frames | Duration |
|---|---|---|---|---|---|
| `V1-AccessDenied-Original` | Version 1: reference camera (left side of panel near the lens, strong dutch roll, slow push-in) | 3840×2160 | 30 | 622 | 20.733 s |
| `V2-AccessDenied-LowAngleOrbit` | Version 2: **alternative camera angle and movement**. Mirrored low-angle view (right side nearest), continuous arcing dolly, and a rack focus that follows the active element (Login, then fingerprint, then each password dot, then ACCESS, then DENIED) | 3840×2160 | 30 | 622 | 20.733 s |

## Technology
* **Remotion 4** (scaffolded with `npx create-video --blank`), React 19, TypeScript.
* **Canvas 2D** with a small custom 3D engine (`src/engine/`, the same engine as the
  Particle Collision project):
  * The UI elements (text glyphs, fingerprint ridges, dots, bars and border
    segments) are drawn on a 3D plane. Each element uses a local affine frame
    taken from the perspective projection, so perspective is correct per
    element.
  * Each element gets its own depth-of-field blur through the blur-bin
    renderer in `dof.ts`.
* Fonts are bundled in `public/fonts/` (Rajdhani and Share Tech Mono, SIL OFL
  1.1, licences included) and loaded with `FontFace` + `delayRender`.
  Rendering needs no network access.
* Deterministic: every frame is computed from the frame number alone.

## Commands
Requires Node 20.19+ / 22.13+ (tested with Node 22).

```bash
npm install
npm run dev                 # Remotion Studio preview
npm run render:v1:4k        # → out/Version-1_Access-Denied-Login_4K.mp4               (3840x2160)
npm run render:v2:4k        # → out/Version-2_..._Low-Angle-Orbit-Camera_4K.mp4         (3840x2160)
npm run render:v1:1080p     # → out/Version-1_Access-Denied-Login_1080p.mp4            (4K comp, --scale=0.5)
npm run render:v2:1080p     # → out/Version-2_..._Low-Angle-Orbit-Camera_1080p.mp4
npm run render:all:1080p
npm run still:v1:4k         # single 4K PNG still (frame 300)
```
Output is H.264 MP4 (yuv420p, CRF 16), as set in `remotion.config.ts`.

### Browser
Remotion downloads its own Chrome Headless Shell on the first render.
On machines without internet access, point it to a local binary with
`REMOTION_BROWSER=/path/to/chrome-headless-shell`.

### Render quality vs speed
The prop `renderScale` (default `1`) sets the internal canvas resolution
relative to the 4K composition. The 1080p deliverables render the 4K
composition with `--scale=0.5` at `renderScale: 1`. Every frame is drawn
natively at 3840×2160 and downsampled to 1920×1080, which gives 2×
supersampled anti-aliasing. For a fast preview, use
`--props='{"variant":"v1","renderScale":0.5}' --scale=0.5`. Geometry, timing and colours do not change with
`renderScale`, because everything is authored in 4K pixel units.

Measured on a 4-core cloud VM (software rendering, `--concurrency=4`):
about 0.5 s per frame for 1080p output and about 0.9 s per frame for 4K output.

## File map
```
src/Root.tsx                          both 4K compositions
src/AccessDenied/AccessDenied.tsx     component, font loading, canvas
src/AccessDenied/scene.ts             timeline, both camera rigs, UI/network geometry, per-frame render
src/engine/*                          shared Canvas 2D 3D/DOF engine
public/fonts/*                        bundled fonts + OFL licences
remotion.config.ts                    codec / quality configuration
```
