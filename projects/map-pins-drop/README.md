# Map Pins Drop — Remotion project (4K compositions)

A 3D city map with glossy red location pins popping in while a drone-style
camera trucks sideways across the map. It is a recreation of reference clip
`istockphoto-842944640` (15.033 s), plus one alternative version.

| Composition id                 | Version | Resolution | FPS | Frames | Duration |
| ------------------------------ | ------- | ---------- | --- | ------ | -------- |
| `MapPinsDrop-V1-Reference`     | V1: matches the reference (daylight web-map palette) | 3840×2160 | 30 | 451 | 15.033 s |
| `MapPinsDrop-V2-NightPalette`  | V2: alternative colour palette (night-mode navigation map, amber pins, neon highways, landing ripples) | 3840×2160 | 30 | 451 | 15.033 s |

## Technology
* **Remotion 4** (React) drives the timeline. Every frame is a pure function of the frame number.
* **three.js / WebGL 2**:
  * `src/map/mapShader.ts`: the entire map (Voronoi neighbourhoods with
    their own street grids, arterials, highways, river and lakes, parks,
    footpaths and lots) is a procedural **GLSL shader**. It is anti-aliased
    analytically, so it stays sharp at 4K and does not shimmer.
  * `src/map/pinGeometry.ts`: an extruded, bevelled marker with a white inlay and a clear-coat material.
  * `src/map/scene.ts`: the camera rig, the deterministic pin schedule
    (seeded PRNG), and the drop-and-squash animation with soft contact
    shadows and V2 ripples.
* The camera motion was measured from the reference with phase correlation:
  a constant lateral truck of about 18 % of the frame width per second, a
  ~45° pitch, and no rotation.

## Commands
No external media assets are needed: the map, textures and data read-outs are all generated procedurally in code.

```bash
npm install                 # install dependencies (Node 20.19+ / 22.13+)
npm run dev                 # Remotion Studio preview
npm run render:v1           # out/Version-1_Map-Pins-Drop_1080p.mp4  (4K comp → 1080p, H.264)
npm run render:v2           # out/Version-2_Map-Pins-Drop-Night-Palette_1080p.mp4
npm run render:v1:4k        # full 3840×2160 master of V1
npm run render:v2:4k        # full 3840×2160 master of V2
```
Then master the 1080p files (conversion to standard limited-range BT.709
`yuv420p`, written to `out/final/`, using Remotion's bundled ffmpeg):
```bash
npm run finalize:v1 && npm run finalize:v2
# or everything in one go:
npm run render:all
```
Remotion's JPEG frame pipeline otherwise tags the H.264 stream as full-range
`yuvj420p`. The finalize pass changes only the colour encoding, not the picture.

The 1080p deliverables are rendered from the 4K compositions with
`--scale=0.5`, so every output pixel is supersampled from 2×2 pixels of the
4K render.

### WebGL backend
`remotion.config.ts` defaults to `swangle` (SwiftShader via ANGLE), which works
on every machine, including GPU-less servers and CI, but is slow
(several seconds per 4K frame). On a machine with a GPU, render much faster with:
```bash
REMOTION_GL=angle npm run render:v1
```
The config also points Remotion at a pre-installed Playwright Chromium when
one exists. Otherwise Remotion downloads its own Chrome Headless Shell on
the first render.

## Structure
```
scripts/finalize.mjs    1080p mastering (BT.709 limited range)
remotion.config.ts      codec H.264, yuv420p, CRF 16, WebGL backend, timeouts
src/Root.tsx            the two 4K compositions
src/constants.ts        fps / duration / size
src/random.ts           seeded PRNG
src/map/MapPinsDrop.tsx React component (canvas + vignette)
src/map/scene.ts        three.js scene, camera, pins, animation
src/map/mapShader.ts    procedural map GLSL
src/map/pinGeometry.ts  pin + inlay geometry
src/map/palette.ts      V1 / V2 palettes
```
