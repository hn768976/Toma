# Glass Cube Ring — Composition 2

A ring of thick-walled iridescent glass cubes tumbling right of frame on a flat
backdrop (13.333 s, 400 frames, 30 fps; the motion loops seamlessly every
200 frames). Built with Remotion 4 + Three.js 0.186 (WebGL 2,
`MeshPhysicalMaterial` transmission/iridescence) and a custom DOF pass.

| Composition         | Size        | Frames | Description |
|---------------------|-------------|--------|-------------|
| `GlassCubeRing-V1`  | 3840 × 2160 | 400    | Matches the reference: orange `#BF7037` backdrop, orange-rimmed glass with teal/cyan interiors. |
| `GlassCubeRing-V2`  | 3840 × 2160 | 400    | Alternative **colour palette**: midnight indigo backdrop, violet/magenta glass with cyan cores. Same motion and framing. |

## Requirements
- Node.js 20.19+ / 22.13+ / 24+
- Chromium with WebGL (Remotion downloads its own Chrome Headless Shell; no GPU needed — ANGLE falls back to SwiftShader).

## Commands
```console
npm ci                # install exact dependency versions from package-lock.json
npm run dev           # Remotion Studio preview
npm run render:v1     # out/GlassCubeRing-V1_1080p.mp4  (H.264, 1920x1080, 30 fps)
npm run render:v2     # out/GlassCubeRing-V2_1080p.mp4
npm run render:v1:4k  # full 3840x2160 master
npm run render:v2:4k
npm run lint          # eslint + tsc
```
The 1080p deliverables are rendered from the 4K compositions with `--scale=0.5`;
the WebGL backing store follows the output pixel density and all sizes are
relative to frame height, so the 4K composition renders natively at either size.

## Structure
```
src/
  Root.tsx              compositions (4K, 30 fps)
  GlassCubeRing.tsx     React wrapper
  scenes/glassRing.ts   scene, palettes, ring motion, materials
  gl/GlCanvas.tsx       deterministic per-frame WebGL canvas for Remotion
  gl/dof.ts             depth-of-field post chain + ACES tone mapping
  gl/aces.ts            ACES inverse so the backdrop hits an exact sRGB colour
  gl/env.ts             procedural HDR studio environment (no external assets)
  gl/random.ts          seeded PRNG
remotion.config.ts      codec/browser/GL settings
```
All visuals are procedural; there are no external image/font/audio assets.
