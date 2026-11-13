# Yeast SEM Fly-Through — Remotion project (4K, 30 fps)

Procedural 3D recreation of an electron-microscope style shot of a yeast /
spore colony: rim-lit cells with bud scars on a dark navy background and a
shallow depth of field. Everything is generated in code — there are no image,
video or font assets. Created with the Remotion CLI (`npx create-video --blank`).

| Composition ID               | What it is                                                                                   | Size      | FPS | Frames |
| ---------------------------- | -------------------------------------------------------------------------------------------- | --------- | --- | ------ |
| `YeastSEM-V1-ReferenceMatch` | Version 1 – matches the reference: fast push-in through the colony, settling on three cells   | 3840x2160 | 30  | 300    |
| `YeastSEM-V2-OrbitPullBack`  | Version 2 – different camera: starts as a macro of the three cells, orbits and pulls back     | 3840x2160 | 30  | 300    |

Duration: 300 frames = 10.000 s, identical to the reference clip.

## Technology

- Remotion 4 + React 19
- Three.js (raw WebGL2 renderer, one instanced mesh of ~800 cells, custom
  GLSL ES 3.0 shaders)
- Post pipeline in `src/engine/post.ts`: scene pass with depth →
  circle-of-confusion → half-resolution bokeh depth of field, FXAA → vignette / grain grade

## Commands

```bash
npm install

# Preview in Remotion Studio (half-resolution preview for fluid scrubbing)
npm run dev

# 1080p H.264 MP4 (the 4K composition rendered at half scale)
npx remotion render YeastSEM-V1-ReferenceMatch out/yeast-sem-v1-1080p.mp4 --scale=0.5
npx remotion render YeastSEM-V2-OrbitPullBack  out/yeast-sem-v2-1080p.mp4 --scale=0.5

# Native 4K H.264 MP4
npx remotion render YeastSEM-V1-ReferenceMatch out/yeast-sem-v1-4k.mp4
npx remotion render YeastSEM-V2-OrbitPullBack  out/yeast-sem-v2-4k.mp4

# Single 4K still
npx remotion still YeastSEM-V1-ReferenceMatch out/still.png --frame=299
```

Codec (H.264), pixel format (yuv420p) and CRF 17, BT.709 are set in
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
  Root.tsx              the two <Composition>s (4K, 30 fps, 300 frames)
  engine/
    ThreeStage.tsx      hosts a Three.js renderer inside a Remotion composition
    post.ts             depth of field + grade pipeline
    glsl.ts             shared GLSL noise / bump helpers
  scene/
    yeast.ts            colony layout, the two camera rigs, per-frame update
    shaders.ts          yeast cell (bud scars, SEM shading) and backdrop shaders
    rng.ts              seeded random generator (renders are deterministic)
```
