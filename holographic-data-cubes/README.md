# Holographic Data Cubes — Remotion project (4K masters)

A procedural, fully code-generated recreation of a wireframe "data cube" HUD
sequence: a glass cube with scrolling code, a dotted wave surface and wire
mesh, 3D bar blocks growing from its roof, a solid core cube, and a field of
grid-aligned neighbour cubes, ending on a fade to black.

Created with the Remotion CLI (`npx create-video --blank`). Rendering is done
with **Three.js on WebGL 2 with custom GLSL shaders** (fat lines, instanced
points, canvas-generated text textures, bloom and motion blur). There are no
external assets; everything is generated deterministically from seeds.

## Compositions

| Composition id           | Size      | FPS | Frames | Length   | Description |
| ------------------------ | --------- | --- | ------ | -------- | ----------- |
| `DataCubes-V1-Reference` | 3840x2160 | 30  | 900    | 30.000 s | Version 1 — matches the reference (monochrome) |
| `DataCubes-V2-CyanAmber` | 3840x2160 | 30  | 900    | 30.000 s | Version 2 — same animation, cyan/teal structure with amber accents |

Both compositions are 4K. The drawing buffer follows Remotion's `--scale`, so
`--scale=0.5` produces a native 1920x1080 render of the same composition.
The last ~3 seconds are an intentional hold on near-black, as in the reference.

## Requirements

- Node.js 20.19+ / 22.13+ and npm
- No GPU needed (software WebGL works; a GPU is much faster)

## Commands

```bash
npm install

# Preview in Remotion Studio
npm run dev

# 1080p deliverables (H.264 MP4, 30 fps)
npm run render:v1        # -> out/data-cubes-v1-1080p.mp4
npm run render:v2        # -> out/data-cubes-v2-1080p.mp4

# Native 4K masters
npm run render:v1:4k     # -> out/data-cubes-v1-4k.mp4
npm run render:v2:4k     # -> out/data-cubes-v2-4k.mp4

# Single 4K frame (quick check)
npx remotion still DataCubes-V1-Reference out/v1-frame-600-4k.png --frame=600
```

Codec (H.264), pixel format (yuv420p, BT.709), CRF and the OpenGL backend are
set in `remotion.config.ts`.

### Headless servers / containers

The default OpenGL backend is `angle` (GPU). On a machine without a display or
GPU, add `--gl=swangle` (software WebGL):

```bash
npx remotion render DataCubes-V1-Reference out/v1-1080p.mp4 --scale=0.5 --gl=swangle
```

If Remotion cannot download its Chrome Headless Shell, point it at an existing
one: `REMOTION_BROWSER=/path/to/chrome-headless-shell npx remotion render ...`

## Structure

```
src/
  index.ts, Root.tsx        Remotion entry + composition registration
  engine/ThreeStage.tsx     Hosts a Three.js renderer, renders one frame per Remotion frame
  engine/postfx.ts          MSAA scene target, motion blur, bloom, grade, grain
  cubes/camera.ts           Camera track (one continuous move, no cuts)
  cubes/builders.ts         Geometry builders (cubes, wave surface, meshes, charts)
  cubes/textures.ts         Canvas-generated code / read-out textures
  cubes/scene.ts            Scene assembly and per-beat animation
  cubes/palette.ts          Colour palettes for Version 1 and Version 2
  cubes/rng.ts              Seeded random numbers
```

Everything is a pure function of the frame number (seeded PRNG, no
`Math.random()` / wall-clock time), so renders are reproducible and frames can
be rendered in any order or in parallel.
