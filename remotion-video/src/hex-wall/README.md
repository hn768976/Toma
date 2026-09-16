# Hexagon wall

A 3D hexagon-tile wall that pulses: concentric waves start at the centre,
travel outwards lifting each tile as they pass, and let it settle back down
behind them. Rebuilt from a 9.04s / 25fps reference clip, retimed to 30fps.

Two colourways, each registered at 1080p and at 4K:

| Composition      | Size        | Colourway                |
| ---------------- | ----------- | ------------------------ |
| `HexWallMono`    | 1920 × 1080 | studio white (reference) |
| `HexWallBlue`    | 1920 × 1080 | tinted blue ceramic      |
| `HexWallMono4K`  | 3840 × 2160 | studio white (reference) |
| `HexWallBlue4K`  | 3840 × 2160 | tinted blue ceramic      |

All four are 271 frames at 30fps (9.033s), matching the reference length as
closely as 30fps allows.

## Rendering

```console
npm run render:white     # 1080p, studio white
npm run render:blue      # 1080p, tinted blue
npm run render:white-4k  # 4K, studio white
npm run render:blue-4k   # 4K, tinted blue
```

Each writes H.264 / MP4 into `out/`. The 4K renders are roughly four times
the work of the 1080p ones - budget accordingly, and raise `--concurrency`
if the machine has the memory for it.

## How it is put together

- `constants.ts` - timing, grid size and the world-space dimensions
  everything else is measured against.
- `wave.ts` - the motion. `tileHeight(radius, seconds, jitter)` is a pure
  function, so any frame can be drawn without knowing about the ones before
  it, which is what lets Remotion render frames out of order and in parallel.
- `grid.ts` - the pointy-top hexagon lattice, plus a stable per-tile jitter
  value that stops the wave front reading as a perfect circle.
- `themes.ts` - the two colourways: tile and panel colours, the four studio
  lights, and the CSS glow laid over the render.
- `scene.ts` - the three.js scene on a `WebGPURenderer`, built from one
  `InstancedMesh` of hexagonal prisms in front of a flat panel.
- `HexWall.tsx` - the Remotion component; holds a `delayRender()` handle open
  while the GPU works on each frame.

### Rendering through WebGPU in a headless browser

The renderer is three.js's `WebGPURenderer`, which is what actually draws
every frame. Two things are worth knowing if you change this code:

1. **Three is pinned to 0.180.** Newer releases pass a `swizzle` field in
   `GPUTextureViewDescriptor` that Chrome does not accept yet, and every
   frame fails with `Failed to execute 'createView' on 'GPUTexture'`.
2. **Frames go through an offscreen render target, not the canvas.**
   Headless Chrome has a GPU but no display compositor, so a WebGPU canvas
   swap chain has nowhere to present to and the canvas stays blank. Instead
   the scene is drawn into a `RenderTarget` installed via
   `setOutputRenderTarget()` - which keeps tone mapping and the sRGB
   conversion in play - and the pixels are read back and written onto a plain
   2D canvas, which is what Remotion screenshots.

If a machine has no WebGPU adapter at all, `WebGPURenderer` falls back to its
WebGL2 backend on its own and the composition still renders. The backend in
use is logged once per render as `[hex-wall] three.js is running on ...`.
