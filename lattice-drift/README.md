# Lattice Drift (Remotion + Three.js, 4K)

An isometric field of upright white "Π" frames (two posts and a top beam, with
occasional top or floor rails and turned frames), laid out in rows on a cool
grey pinstriped floor under soft overcast light. The camera drifts steadily
across the field while a few frames shrink away and grow back. Like the
reference, the clip is a seamless loop: the field repeats every 5.5 units
along Z, and the camera travels exactly that far in 270 frames.

| Composition ID              | Size        | FPS | Frames | Duration | Notes |
|-----------------------------|-------------|-----|--------|----------|-------|
| `LatticeDrift-V1-Reference` | 3840 x 2160 | 30  | 270    | 9.0 s    | Matches the reference: orthographic near-isometric view (45° azimuth, 57° elevation), drift speed and heading measured from the reference with phase correlation (1.04 px/frame at 768 px, heading 40° up-right). Seamless loop. |
| `LatticeDrift-V2-Crane`     | 3840 x 2160 | 30  | 270    | 9.0 s    | Alternative camera: a perspective crane/orbit move that starts high, swings ~70° around the lattice and descends to a low angle. Same palette and scene. |

Everything is procedural (seeded PRNG), so there are no external assets and
every render produces the same frames.

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
- On a 4-core CPU without a GPU, a 4K frame takes about 4-5 s.
- If the config finds a Playwright Chromium headless shell under
  `/opt/pw-browsers`, it uses that. Otherwise Remotion downloads its own
  Chrome Headless Shell the first time you render.

## Source layout

```
src/
  index.ts                 registerRoot
  Root.tsx                 the two 4K compositions
  random.ts                seeded PRNG + easing helpers
  lattice/
    constants.ts           timing, size, geometry, reference palette
    pieces.ts              procedural, Z-periodic frame field
    Bars.tsx               one InstancedMesh for every bar, pulse animation
    StripeGround.tsx       procedural pinstripe floor texture
    CameraRig.tsx          applies per-frame camera poses
    LatticeDrift.tsx       scene, lights, the two camera moves
```
