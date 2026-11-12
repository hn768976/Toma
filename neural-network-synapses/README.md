# Neural Network Synapses — Remotion project (4K masters)

A procedural, fully code-generated recreation of a macro fly-through of a
neural network: glassy dendrites and cell bodies, depth of field, and glowing
impulses travelling along the branches.

Created with the Remotion CLI (`npx create-video --blank`). Rendering is done
with **Three.js on WebGL 2 with custom GLSL shaders** (no external assets —
all geometry, materials and motion are generated deterministically from seeds).

## Compositions

| Composition id                  | Size      | FPS | Frames | Length   | Description |
| ------------------------------- | --------- | --- | ------ | -------- | ----------- |
| `NeuralNetwork-V1-Reference`    | 3840x2160 | 30  | 401    | 13.367 s | Version 1 — matches the reference (silver glass, cyan impulses) |
| `NeuralNetwork-V2-EmberPalette` | 3840x2160 | 30  | 401    | 13.367 s | Version 2 — same shot, alternative rose-gold / amber colour palette |

Both compositions are 4K. The drawing buffer follows Remotion's `--scale`, so
`--scale=0.5` produces a native 1920x1080 render of the same composition.

## Requirements

- Node.js 20.19+ / 22.13+ and npm
- No GPU needed (software WebGL works; a GPU is much faster)

## Commands

```bash
npm install

# Preview in Remotion Studio
npm run dev

# 1080p deliverables (H.264 MP4, 30 fps)
npm run render:v1        # -> out/neural-network-v1-1080p.mp4
npm run render:v2        # -> out/neural-network-v2-1080p.mp4

# Native 4K masters
npm run render:v1:4k     # -> out/neural-network-v1-4k.mp4
npm run render:v2:4k     # -> out/neural-network-v2-4k.mp4

# Single 4K frame (quick check)
npx remotion still NeuralNetwork-V1-Reference out/v1-frame-100-4k.png --frame=100
```

Codec (H.264), pixel format (yuv420p), CRF and the OpenGL backend are set in
`remotion.config.ts`.

### Headless servers / containers

The default OpenGL backend is `angle` (GPU). On a machine without a display or
GPU, add `--gl=swangle` (software WebGL):

```bash
npx remotion render NeuralNetwork-V1-Reference out/v1-1080p.mp4 --scale=0.5 --gl=swangle
```

If Remotion cannot download its Chrome Headless Shell, point it at an existing
one: `REMOTION_BROWSER=/path/to/chrome-headless-shell npx remotion render ...`

## Structure

```
src/
  index.ts, Root.tsx        Remotion entry + composition registration
  NeuralNetwork.tsx         The two versions (palette selection)
  engine/ThreeStage.tsx     Hosts a Three.js renderer, renders one frame per Remotion frame
  engine/postfx.ts          MSAA scene target, depth of field, bloom, grade, grain
  neural/camera.ts          Camera track (continuous backwards drift, pan and roll)
  neural/network.ts         Procedural neurons (branching tube geometry, cell bodies)
  neural/materials.ts       GLSL: glass dendrites, cell membranes, impulse sprites
  neural/scene.ts           Scene assembly, hero cells, impulse animation
  neural/palettes.ts        Colour palettes for Version 1 and Version 2
```

Everything is a pure function of the frame number (seeded PRNG, no
`Math.random()` / wall-clock time), so renders are reproducible and frames can
be rendered in any order or in parallel.
