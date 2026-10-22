# HUD Compositions (Remotion)

Two 4K (3840×2160, 30 fps) motion-graphics compositions, each in two versions.
The project was scaffolded with the Remotion CLI (`npx create-video --blank`).

| Composition ID           | Concept                                   | Version | Frames | Duration  |
| ------------------------ | ----------------------------------------- | ------- | ------ | --------- |
| `SatelliteTargeting-V1`  | Satellite scan → pivot-farm target lock   | Reference match (near top-down pass) | 668 | 22.267 s |
| `SatelliteTargeting-V2`  | same                                      | Alternate **camera**: oblique, orbiting drone-style move | 668 | 22.267 s |
| `WorldTracking-V1`       | Global tracking dashboard → target found  | Reference match (graphite / red grade) | 626 | 20.867 s |
| `WorldTracking-V2`       | same                                      | Alternate **colour palette**: navy / cyan holographic with amber alerts | 626 | 20.867 s |

Reference durations are 22.256 s (667 frames @ 29.97) and 20.854 s (625 frames @ 29.97).
At exactly 30 fps the closest whole-frame lengths are 668 and 626 frames, within
half a frame (≈12 ms) of each reference.

## Technology

- **SatelliteTargeting**: WebGL 2 fragment shaders. The terrain (valley, braided
  river wash, hill-shaded ranges, town grid, centre-pivot farm district) is fully
  procedural GLSL. Because it is expensive, it is baked once into two textures
  (`public/terrain/*.jpg`) by the `TerrainBake-*` still compositions; the per-frame
  shader samples them through a perspective ground camera and renders the scan
  lens, radar sweep, grid, grade and grain. The SVG HUD uses the same camera
  maths (`src/satellite/camera.ts`) so markers stay locked to the ground.
- **WorldTracking**: Canvas 2D + d3-geo. Coastlines come from Natural Earth
  1:50m land (public domain, `world-atlas` package), drawn in a Miller projection
  and filled with a procedural relief texture (`public/map/land-relief.jpg`,
  baked by the `MapTextureBake` still). Whip pans use multi-sample motion blur.
  The dashboard UI is HTML/SVG.
- HUD layers are authored in a 1920×1080 design space and scaled to 4K, so text
  and vectors stay sharp at full resolution.
- Fonts are bundled through `@fontsource` (Barlow Condensed, Share Tech Mono, OFL).
- No audio (the references have no audio track).

## Commands

Requires Node 20.19+ / 22.13+ / 24+.

```console
npm install
npm run dev                    # Remotion Studio preview
```

Render the 4K masters:

```console
npx remotion render SatelliteTargeting-V1 out/SatelliteTargeting-V1-4K.mp4
npx remotion render SatelliteTargeting-V2 out/SatelliteTargeting-V2-4K.mp4
npx remotion render WorldTracking-V1      out/WorldTracking-V1-4K.mp4
npx remotion render WorldTracking-V2      out/WorldTracking-V2-4K.mp4
```

Render the 1080p delivery files (same 4K compositions, scaled at render time):

```console
npm run render:1080
# equivalent to, for each composition:
# npx remotion render <ID> out/<ID>-1080p.mp4 --scale=0.5
```

Codec, pixel format (H.264, yuv420p) and the WebGL backend are set in
`remotion.config.ts`. Rendering uses Chromium's `swiftshader` GL backend by
default so WebGL 2 and Canvas 2D work on machines without a GPU; set
`REMOTION_GL=angle` to use a hardware GPU instead.

Re-bake the procedural textures (only needed after editing the terrain/relief code;
the baked files are committed in `public/`):

```console
npm run bake
```

## Layout

```
src/
  Root.tsx                 composition registry
  common/                  constants, shader canvas, design space, fonts, helpers
  satellite/               SatelliteTargeting: shaders, camera, timeline, HUD
  worldmap/                WorldTracking: projection, relief texture, map canvas, UI
public/
  terrain/                 baked terrain textures (WebGL)
  map/                     baked land relief texture (Canvas 2D)
```
