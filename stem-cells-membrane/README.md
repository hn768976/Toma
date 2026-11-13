# Stem Cells in Membranes — Remotion project (4K, 30 fps)

Procedural 3D recreation of a "stem cells inside glassy membranes" microscopy
shot. Everything is generated in code — there are no image, video or font
assets. Created with the Remotion CLI (`npx create-video --blank`).

| Composition ID                | What it is                                                         | Size      | FPS | Frames |
| ----------------------------- | ------------------------------------------------------------------ | --------- | --- | ------ |
| `StemCells-V1-ReferenceMatch` | Version 1 – matches the reference (azure liquid, navy nuclei)       | 3840x2160 | 30  | 299    |
| `StemCells-V2-OrchidPalette`  | Version 2 – same scene and camera, magenta / orchid colour palette | 3840x2160 | 30  | 299    |

Duration: the reference clip is 9.96 s. 9.96 s x 30 fps = 298.8 frames, which
is not a whole number, so the nearest frame count is used: 299 frames
(9.967 s, +0.007 s).

## Technology

- Remotion 4 + React 19
- Three.js (raw WebGL2 renderer, custom GLSL ES 3.0 shaders)
- Post pipeline in `src/engine/post.ts`: scene pass with depth →
  circle-of-confusion → half-resolution bokeh depth of field, FXAA → vignette / grain grade

## Commands

```bash
npm install

# Preview in Remotion Studio (half-resolution preview for fluid scrubbing)
npm run dev

# 1080p H.264 MP4 (the 4K composition rendered at half scale)
npx remotion render StemCells-V1-ReferenceMatch out/stem-cells-v1-1080p.mp4 --scale=0.5
npx remotion render StemCells-V2-OrchidPalette  out/stem-cells-v2-1080p.mp4 --scale=0.5

# Native 4K H.264 MP4
npx remotion render StemCells-V1-ReferenceMatch out/stem-cells-v1-4k.mp4
npx remotion render StemCells-V2-OrchidPalette  out/stem-cells-v2-4k.mp4

# Single 4K still
npx remotion still StemCells-V1-ReferenceMatch out/still.png --frame=150
```

Codec (H.264), pixel format (yuv420p), CRF 16 and JPEG quality are set in
`remotion.config.ts`.

### OpenGL renderer

The scene needs WebGL2. `remotion.config.ts` picks `swangle` (software, works
on any machine, slower) on Linux and `angle` (GPU) on macOS / Windows.
Override with `--gl=angle`, `--gl=angle-egl` or `--gl=swangle` if needed. On a
machine with little RAM, add `--concurrency=1` for 4K renders.

## Structure

```
src/
  index.ts              registerRoot
  Root.tsx              the two <Composition>s (4K, 30 fps, 299 frames)
  engine/
    ThreeStage.tsx      hosts a Three.js renderer inside a Remotion composition
    post.ts             depth of field + grade pipeline
    glsl.ts             shared GLSL noise / bump helpers
  scene/
    stemCells.ts        cell layout, camera move, per-frame update
    shaders.ts          nucleus, membrane and backdrop shaders
    palettes.ts         AZURE (Version 1) and ORCHID (Version 2) palettes
    rng.ts              seeded random generator (renders are deterministic)
```
