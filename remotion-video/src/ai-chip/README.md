# AI Chip Circuit

A 20 second, 30 fps, seamlessly looping 3D shot: a glossy "AI" package at the
centre of a procedurally routed circuit board, with signal pulses running out
along the nets. Built with three.js on **WebGPU** and rendered through the
Remotion CLI.

## Compositions

| ID                  | Resolution  | Frames | FPS |
| ------------------- | ----------- | ------ | --- |
| `AiChipCircuit4K`   | 3840 × 2160 | 600    | 30  |
| `AiChipCircuit1080` | 1920 × 1080 | 600    | 30  |

Both use the same scene; only `resolutionScale` differs, which selects a 4096 px
substrate texture instead of 2048 px.

## Rendering

```bash
npm install

# 1080p master (H.264 / MP4)
npx remotion render AiChipCircuit1080 out/ai-chip-circuit-1080p.mp4 \
  --codec=h264 --crf=17 --muted --timeout=300000 --concurrency=2

# 4K master
npx remotion render AiChipCircuit4K out/ai-chip-circuit-4k.mp4 \
  --codec=h264 --crf=17 --muted --timeout=300000 --concurrency=1
```

`--timeout=300000` matters: the first frame has to compile the WGSL pipelines,
which is slow on a software adapter. `--muted` keeps a silent audio track out of
the container.

On a GPU-less machine 1080p renders at roughly 1 s/frame and 4K at roughly
7.5 s/frame. With a real GPU both are far quicker.

## How it is built

```
constants.ts      dimensions, palette, world scale
rng.ts            seeded mulberry32, so a seed always gives the same board
traceNetwork.ts   grid random walks -> routed polylines, corners chamfered to 45°
traceGeometry.ts  polylines -> one mitred ribbon mesh with per-route attributes
textures.ts       canvas-baked substrate and the chrome "AI" lid
materials.ts      TSL node materials (compiled to WGSL)
scene.ts          scene graph, camera path, bloom + vignette post chain
AiChipCircuit.tsx Remotion component; drives one frame per delayRender
gpu/presentation.ts  swap chain, or readback when there is no window surface
gpu/compat.ts     three.js <-> browser WebGPU version shims
```

### The loop

Everything animated is a function of `progress`, which runs 0 → 1 across the
600 frames, and every term is periodic in it:

- Pulses advance by a whole number of spacings per loop (`PULSE_TRAVEL`,
  `SLOW_PULSE_TRAVEL`), so `fract()` lands back where it started.
- The camera follows a closed Lissajous orbit. Yaw, distance, height and the
  look-at point each peak at a different phase, so the move reads as a
  continuous drift rather than a sine that visibly stops and reverses.

Frame 600 would be identical to frame 0, so the clip cuts back to its start
without a seam.

### WebGPU without a GPU

Two things get in the way of running three.js r186 on WebGPU in headless
Chromium, and both are handled at startup:

1. **No window surface.** On a software (SwiftShader) adapter, `configure()` on
   a `GPUCanvasContext` throws `A valid external Instance reference no longer
   exists`. Render and compute passes are fine — only presenting is missing. So
   `gpu/presentation.ts` supplies its own context object that hands three.js an
   ordinary render-attachment texture, then copies it to a 2D canvas after each
   frame. The renderer, node materials and passes are untouched real WebGPU.

   The path is chosen from `adapter.info`, never by trying a swap chain and
   catching the error: a failed `configure()` takes the whole Dawn instance
   down with it and nothing afterwards recovers.

2. **A spec version gap.** three.js r186 sets `swizzle: 'rgba'` on every texture
   view descriptor, per a later revision of the WebGPU spec. Chromium 141
   implements the earlier dictionary form and rejects the string.
   `gpu/compat.ts` feature-detects this and strips the key, which is equivalent
   since `'rgba'` is the identity swizzle. It disables itself on browsers that
   accept it.

On a machine with a real GPU neither applies: the renderer takes the normal
swap chain path.
