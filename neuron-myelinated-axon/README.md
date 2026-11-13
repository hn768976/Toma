# Myelinated Neuron Axon

A myelinated neuron drifting in dark space: striped soma, fuzzy dendrite bush, myelin sheaths with a signal hopping along the axon, out-of-focus sister neurons and floating dust.

Built with **Remotion 4** and **Three.js (WebGL 2, custom GLSL shaders)**. Everything is procedural -
there are no image, video, font or audio assets, and the video has no audio track.

| Composition | Size | FPS | Length | What it is |
| --- | --- | --- | --- | --- |
| `MyelinatedNeuron-V1` | 3840 x 2160 | 30 | 300 frames (10.000 s) | Matches the reference: slow push-in with a slight orbit, focus held on the cell. |
| `MyelinatedNeuron-V2` | 3840 x 2160 | 30 | 300 frames (10.000 s) | Alternative **camera angle and movement**: a low, close tracking shot that starts on the axon terminal and travels down the myelinated axon to the soma while racking focus. Same scene, colours and lighting. |

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- No GPU needed. The first render downloads Remotion's Chrome Headless Shell automatically.

## Commands

```console
npm install            # install dependencies
npm run dev            # open Remotion Studio to preview both compositions

npm run render:v1      # 1080p H.264 MP4 of Version 1  -> out/myelinated-neuron-v1-1080p.mp4
npm run render:v2      # 1080p H.264 MP4 of Version 2  -> out/myelinated-neuron-v2-1080p.mp4
npm run render:all     # both of the above

npm run render:v1:4k   # native 3840x2160 master of Version 1
npm run render:v2:4k   # native 3840x2160 master of Version 2
```

The compositions are authored at 4K. The 1080p deliverables are the same compositions rendered with
`--scale=0.5`, so the picture is identical, just at half the pixel size. The equivalent raw commands are:

```console
npx remotion render MyelinatedNeuron-V1 out/myelinated-neuron-v1-1080p.mp4 --scale=0.5
npx remotion render MyelinatedNeuron-V1 out/myelinated-neuron-v1-4k.mp4
```

Codec (H.264), pixel format (yuv420p), CRF and the OpenGL backend are set in `remotion.config.ts`.

### Render speed

The default OpenGL backend is `swangle` (software rendering), which works on any machine, including
servers without a GPU. Rough timings on a 4-core CPU: a 1080p render takes about 10-15 minutes, a 4K
render several times longer. On a machine with a GPU, add `--gl=angle` (macOS / Windows) or
`--gl=angle-egl` (Linux) to render much faster, e.g. `npm run render:v1:4k -- --gl=angle`.

## How it works

- `src/Root.tsx` - registers the two 4K compositions.
- `src/scenes/myelinated.ts` - the scene: procedural geometry, colours, camera move, focus and animation timing
  for both versions. This is the file to edit to change the look.
- `src/engine/builder.ts` - seeded random generator and the recursive branch grower that produces the
  neuron as a list of 3D capsules.
- `src/engine/renderer.ts` - the WebGL 2 renderer: every capsule is one instanced quad whose fragment
  shader evaluates an analytic capsule, fake-lights it as a tube and widens / fades it by its circle of
  confusion (depth of field). Capsules are sorted back-to-front per frame; bloom, vignette, tone
  mapping and grain run as post passes.
- `src/engine/NeuronCanvas.tsx` - React component that hosts the canvas and redraws it for the current
  Remotion frame.

Every frame is a pure function of the frame number (seeded randomness, no wall-clock time), so renders
are deterministic and repeatable.
