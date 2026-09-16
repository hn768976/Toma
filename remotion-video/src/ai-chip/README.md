# AI Chip Circuit

A 20 second, 30 fps 3D shot: a solid black "AI" package at the centre of a
procedurally routed circuit board, with signal pulses running out along the
nets. The camera makes one continuous move — trucking left and craning up —
ending on the package from high enough to read the lettering in full. Built
with three.js on **WebGPU** and rendered through the Remotion CLI.

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
textures.ts       canvas-baked substrate and the glowing "AI" lid
materials.ts      TSL node materials (compiled to WGSL)
scene.ts          scene graph, camera path, bloom + vignette post chain
AiChipCircuit.tsx Remotion component; drives one frame per delayRender
gpu/presentation.ts  swap chain, or readback when there is no window surface
gpu/compat.ts     three.js <-> browser WebGPU version shims
```

### The move

Everything is a function of `progress`, which runs 0 → 1 across the 600 frames.

The camera starts low and wide, where the lid is nearly edge-on and the
lettering is only a glowing sliver, then trucks left and cranes up until the
package is seen from about 35° above the board and the word reads in full.
Increasing the azimuth walks the camera along its own left, so the board sweeps
right underneath it as it climbs. The easing is half linear and half
smoothstep: a pure smoothstep parks the move at both ends, which on a shot this
long reads as a stall rather than a drift.

This is a one-way move, so **the clip does not loop** — it plays once and ends
on the logo.

The package itself never moves. Its lettering lies flat on the board and only
reads upright while its top edge points away from the viewer, so the package is
locked to the yaw the camera finishes at. Earlier in the move the lid is steeply
foreshortened and the small residual rotation is not readable.

### What glows

Only the lettering. The lid is a flat matte fill and the body carries nothing
but a narrow neutral-grey Fresnel edge to keep its silhouette readable — no
coloured rim, no glow. The glyph glow is baked as a stack of widening halo
passes under a near-white core, and the lid material drives its exposure off the
texture's own luminance, so only the glyphs and their halo are pushed into HDR
and past the bloom threshold. The nets on the board keep their own glow.

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
