# Hair Serum Repair – Remotion + Three.js (4K)

A serum droplet lands on a damaged hair strand, is absorbed, and a glowing
front sweeps along the strand leaving it smooth and glossy, followed by a
scan grid that fades out.

Built with [Remotion](https://www.remotion.dev) (project scaffolded with
`npx create-video --blank`) and **Three.js / WebGL 2 with custom GLSL
shaders** (procedural cuticle displacement, droplet, backdrop, bloom).
No external assets are required – everything is procedural.

| Composition ID    | Size      | FPS | Frames | Duration | Description                                        |
| ----------------- | --------- | --- | ------ | -------- | -------------------------------------------------- |
| `HairSerum-V1-4K` | 3840x2160 | 30  | 251    | 8.3667 s | Version 1 – reference match (gold serum, slate bg) |
| `HairSerum-V2-4K` | 3840x2160 | 30  | 251    | 8.3667 s | Version 2 – alternative palette (rose serum, plum) |

## Requirements

- Node.js 20.19+ / 22.13+
- No GPU needed: `remotion.config.ts` selects the `swangle` software GL
  renderer. On a machine with a GPU you can append `--gl=angle` to render faster.

## Commands

```bash
npm install            # install dependencies

npm run dev            # open Remotion Studio (preview both compositions)

npm run render:v1      # Version 1 -> out/…(1080p).mp4  (4K comp, --scale=0.5)
npm run render:v2      # Version 2 -> out/…(1080p).mp4
npm run render:all     # both 1080p deliverables

npm run render:v1:4k   # native 3840x2160 master
npm run render:v2:4k
```

All renders are H.264 / yuv420p MP4 at 30 fps (set in `remotion.config.ts`).

## Structure

```
src/
  Root.tsx            composition registry (both 4K compositions)
  HairSerum.tsx       React host: canvas + vignette, drives the scene per frame
  scene/
    scene.ts          renderer, camera, post-processing (MSAA + bloom)
    timeline.ts       every keyframe / timing value (frames @ 30 fps)
    palette.ts        colour palettes for Version 1 and Version 2
    hair.ts           strand geometry + shader (cuticle, gloss, front, grid)
    droplet.ts        serum droplet + halo shaders
    backdrop.ts       defocused background strands shader
    glsl.ts           shared GLSL (noise, cuticle height field, repair mask)
```

Every frame is a pure function of the frame number (no `Math.random()`,
no wall-clock time), so renders are deterministic.
