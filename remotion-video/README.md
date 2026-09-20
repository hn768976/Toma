# Neural network motion backplates (Remotion)

Two abstract AI/neural-network motion pieces, built as Remotion compositions
and rendered with three.js and PixiJS.

| | **V1** | **V2** |
|---|---|---|
| Name | Abstract AI neural network | Loopable isometric branching network |
| Length | 15s (450 frames) | 8s (240 frames) |
| FPS | 30 | 30 |
| Loops | No — opens on black, ends dense | Yes — seamless |
| Master | `NeuralFiberFlow4K` (3840x2160) | `IsometricNeuralLayers4K` (3840x2160) |
| 1080p | `NeuralFiberFlow1080` (1920x1080) | `IsometricNeuralLayers1080` (1920x1080) |

Both are silent, 16:9, and carry no text, so they work as backplates.

## Commands

```console
npm i                # install
npm run dev          # Remotion Studio
npm run lint         # eslint + tsc
```

### Rendering

Every composition is resolution-independent, so the 4K and 1080p
compositions are the same shot at two sizes. On a machine without a usable
hardware GPU, add `--gl=swangle` to force Chromium's software rasteriser.

```console
# 1080p deliverables
npx remotion render NeuralFiberFlow1080 out/V1_neural-fiber-flow_1080p.mp4 \
  --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709

npx remotion render IsometricNeuralLayers1080 out/V2_isometric-neural-layers_1080p.mp4 \
  --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709

# 4K masters (same commands against the 4K compositions)
npx remotion render NeuralFiberFlow4K out/V1_neural-fiber-flow_4K.mp4 \
  --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709
```

`--scale` also works: `npx remotion render NeuralFiberFlow4K out.mp4 --scale=0.5`
renders the 4K composition at 1920x1080. Layer sizes are all derived from
`devicePixelRatio` and composition height, so scaling changes resolution
without changing framing, line weights or defocus radii.

## Architecture

```
src/neural/
  core/        backend selection, renderer factory, geometry and sprite
               builders, noise, palettes
  components/  Remotion-facing layers (ThreeLayer, PixiLayer, bokeh, grain)
  v1/          field layout + scene + composition for V1
  v2/          field layout + scene + composition for V2
```

**Backends.** `core/backend.ts` resolves one backend for the whole page:
WebGPU first, then WebGL2, then WebGL1. A WebGPU adapter that merely
*reports* itself is not trusted — the probe brings a real renderer up and
draws an additive, vertex-coloured mesh with it before accepting the tier,
because a failed WebGPU swapchain can invalidate the GPU process and take
the page's WebGL contexts down with it. The probe therefore runs exactly
once and every layer reuses the result. `three/webgpu` is built against the
same `three.core.js` as the main entry point, so one scene graph runs on
either renderer with no duplicated class registry. PixiJS follows the same
decision.

**Fibres.** Strands are triangle strips with a real world-space width, not
GL lines — line primitives are locked to one pixel, which would scale
wrongly between 1080p and 4K. Each strand is several vertices wide and
follows a lateral alpha profile, so a bright core with a soft skirt is baked
into the geometry. That gives the bloom look in one draw call, with no
post-processing pass to reimplement per backend.

**Depth of field.** Each composition renders three depth slices to separate
canvases and blurs them independently, then composites with `screen`. Blur
radii are specified at 1080p and scaled by output height.

**Determinism.** Remotion renders frames out of order across threads, so
every value is derived from the frame number alone — seeded PRNGs, no
`requestAnimationFrame`, no state carried between frames.

**Looping (V2).** Every animated term is a sine of the loop phase with an
integer cycle count, and packets travel a whole number of cycles per loop,
so frame 240 reproduces frame 0 exactly.

## Debug props

Both compositions accept:

- `debugSharp` — disables all depth-of-field blurs, for checking layout.
- `showBackend` — overlays which GPU backends actually came up.

```console
npx remotion still NeuralFiberFlow1080 out/check.png --frame=300 \
  --props='{"debugSharp":true,"showBackend":true}'
```
