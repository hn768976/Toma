# Cube Wall (Remotion + Three.js, 4K)

A straight-on view of a wall of square tiles. Each tile slides in and out of
the wall, so blocks of tiles keep forming and dissolving. The look is soft
cool-white with blue-grey side faces and shadows. The motion is a seamless
14-second loop, like the reference.

| Composition ID             | Size        | FPS | Frames | Duration | Notes |
|----------------------------|-------------|-----|--------|----------|-------|
| `CubeWall-V1-Reference`    | 3840 x 2160 | 30  | 420    | 14.0 s   | Matches the reference: cool white tiles, blue shading, bright centre, centred perspective camera, about 18 x 10 tiles in frame. |
| `CubeWall-V2-IndigoEmber`  | 3840 x 2160 | 30  | 420    | 14.0 s   | Alternative colour palette: deep indigo faces under a cool key light, with tile side walls glowing ember-coral so every depth step is drawn as a light line. Geometry, camera and motion are identical. |

Everything is procedural (seeded PRNG): there are no external assets, and every render produces the same frames.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- About 2 GB of free RAM per render worker

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # open Remotion Studio to preview/edit

# 4K masters (written to out/)
npm run render:v1:4k
npm run render:v2:4k

# 1080p delivery files from the 4K masters (Lanczos downscale, H.264)
npm run deliver:v1:1080p
npm run deliver:v2:1080p

# Or everything in one go
npm run render:all

# Quick direct 1080p render (no 4K master; slightly less anti-aliasing)
npm run preview:v1:1080p
```

`npx remotion render <CompositionID> out/file.mp4` works as well.

## Rendering notes

- `remotion.config.ts` sets the WebGL backend to `swangle` (software WebGL 2),
  so renders work on headless servers without a GPU. On a machine with a GPU,
  add `--gl=angle` to the render command to make it much faster.
- If the config finds a Playwright Chromium headless shell under
  `/opt/pw-browsers`, it uses that. Otherwise Remotion downloads its own
  Chrome Headless Shell the first time you render.

## Source layout

```
src/
  index.ts             registerRoot
  Root.tsx             the two 4K compositions
  random.ts            seeded PRNG + easing helpers
  wall/
    constants.ts       timing, grid size, both palettes
    depth.ts           loop-periodic depth field for every tile
    CubeWall.tsx       camera, lights, instanced tiles, vignette
```
