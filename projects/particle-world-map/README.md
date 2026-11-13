# Particle World Map — Data Hologram (Remotion, 4K)

Two native **3840×2160 (4K UHD), 30 fps, 300-frame (10.000 s)** compositions
recreating a particle-dot world map floating in front of a defocused,
volumetric "data city" of light.

| Composition ID | Version | Description |
| --- | --- | --- |
| `ParticleWorldMap-V1-Reference-4K` | Version 1 | Matches the reference: locked-off frontal camera, static speckled map, drifting light structure, light shafts, soft blue light bar fading in at ~1 s. |
| `ParticleWorldMap-V2-OrbitCamera-4K` | Version 2 | Alternative **camera movement**: a slow low-angle orbital crane that starts oblique from the lower-left of the map and rises/arcs to a near-frontal view, revealing parallax between the map and the light structure. Same look, palette and timing. |

## Technology

- **Remotion 4** (project scaffolded with `npx create-video --three`).
- **Three.js (WebGL 2)** drawn imperatively into one canvas per frame
  (`src/lib/GLCanvas.tsx`); every value is a pure function of the frame
  number and fixed seeds, so renders are deterministic.
- **Custom WebGL 2 shaders** (`src/lib/postfx.ts`): depth-based bokeh depth
  of field, dual-filter bloom, anamorphic streaks, ACES filmic tone mapping,
  chromatic aberration, vignette and film grain.
- **Map particles** (`src/map/worldParticles.ts`): Natural Earth 1:50m land
  polygons (`src/data/land-50m.json`, from `world-atlas`, ISC licence) are
  rasterised with `d3-geo` and rejection-sampled into 90 000 points that are
  rendered with their own per-particle depth of field.

## Commands

```console
npm ci                      # install exact dependency versions
npm run dev                 # open Remotion Studio (preview / scrub)

# 1080p deliverables (renders the 4K composition, output scaled to 1920x1080)
npm run render:v1:1080p
npm run render:v2:1080p

# full 4K UHD masters (3840x2160)
npm run render:v1:4k
npm run render:v2:4k
```

Outputs are written to `out/` as H.264 MP4 (yuv420p, CRF 16), configured in
`remotion.config.ts`. Equivalent raw CLI call:

```console
npx remotion render ParticleWorldMap-V1-Reference-4K "out/v1.mp4" --scale=0.5
```

### Rendering notes

- WebGL runs through SwiftShader (`--gl=swangle`, set in `remotion.config.ts`),
  which works on any machine. With a GPU you can pass `--gl=angle` for faster
  renders.
- If your environment cannot download Remotion's Chrome Headless Shell, point
  `REMOTION_BROWSER_EXECUTABLE` at an existing `chrome-headless-shell`.
- Rendering is CPU-heavy at 4K (~2–3 s per frame on 4 CPU cores).

## Structure

```
src/
  Root.tsx                    compositions (4K, 30 fps, 300 frames)
  map/WorldMapHologram.tsx    React wrapper
  map/scene.ts                scene, animation and both camera moves
  map/worldParticles.ts       land mask + particle sampling
  map/textures.ts             procedural canvas textures (screens, rays, grids)
  lib/                        WebGL host, post-processing, deterministic RNG
  data/land-50m.json          Natural Earth land (world-atlas, ISC)
public/fonts/                 Inter (SIL OFL 1.1)
```
