# Gold Grid Morph — Composition 1

A macro shot of a gold studded metal sheet: a grid of crisp cubes swells into
spheres and settles back into cubes (12.0 s, 360 frames, 30 fps). Built with
Remotion 4 + Three.js 0.186 (WebGL 2), rendered on a full-composition canvas.

| Composition         | Size        | Frames | Description |
|---------------------|-------------|--------|-------------|
| `GoldGridMorph-V1`  | 3840 × 2160 | 360    | Matches the reference: oblique macro view, slight drift that retraces itself (palindrome). |
| `GoldGridMorph-V2`  | 3840 × 2160 | 360    | Alternative **camera movement**: one continuous slider/crane move that glides across the sheet, cranes up and swings round the stud grid while focus rides the target. |

## Requirements
- Node.js 20.19+ / 22.13+ / 24+
- Chromium with WebGL (Remotion downloads its own Chrome Headless Shell; no GPU needed — ANGLE falls back to SwiftShader).

## Commands
```console
npm ci                # install exact dependency versions from package-lock.json
npm run dev           # Remotion Studio preview
npm run render:v1     # out/GoldGridMorph-V1_1080p.mp4  (H.264, 1920x1080, 30 fps)
npm run render:v2     # out/GoldGridMorph-V2_1080p.mp4
npm run render:v1:4k  # full 3840x2160 master
npm run render:v2:4k
npm run lint          # eslint + tsc
```
The 1080p deliverables are rendered from the 4K compositions with `--scale=0.5`.
The WebGL backing store follows the output pixel density, so the same 4K
composition renders natively at either resolution (all sizes — blur radii,
etc. — are expressed relative to frame height).

## Structure
```
src/
  Root.tsx              compositions (4K, 30 fps)
  GoldGridMorph.tsx     React wrapper
  scenes/goldGrid.ts    scene, lighting, camera moves, morph timing
  gl/GlCanvas.tsx       deterministic per-frame WebGL canvas for Remotion
  gl/morphCube.ts       analytic cube→sphere rounded-box geometry
  gl/dof.ts             depth-of-field post chain + ACES tone mapping
  gl/env.ts             procedural HDR studio environment (no external assets)
  gl/random.ts          seeded PRNG
remotion.config.ts      codec/browser/GL settings
```
All visuals are procedural; there are no external image/font/audio assets.
