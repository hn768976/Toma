# Tile Field — 3D gold tile grid loop

A three.js / WebGPU recreation of the supplied reference clip: a dense grid of
polished metal tiles on a wave-displaced plane, shot from a low grazing camera
with shallow depth of field and a warm bloom. Three colour treatments, one
seamless 15 second loop.

## Compositions

| Composition ID           | Size        | Duration            |
| ------------------------ | ----------- | ------------------- |
| `TileFieldGold1080p`     | 1920 × 1080 | 450 frames @ 30 fps |
| `TileFieldGold4K`        | 3840 × 2160 | 450 frames @ 30 fps |
| `TileFieldNavy1080p`     | 1920 × 1080 | 450 frames @ 30 fps |
| `TileFieldNavy4K`        | 3840 × 2160 | 450 frames @ 30 fps |
| `TileFieldPlatinum1080p` | 1920 × 1080 | 450 frames @ 30 fps |
| `TileFieldPlatinum4K`    | 3840 × 2160 | 450 frames @ 30 fps |

All six are the same scene. It is fully procedural, and every length that would
otherwise be measured in pixels (depth-of-field radius, bloom radius) is
expressed as a fraction of frame height, so 4K is the 1080p frame at twice the
resolution rather than a different-looking image.

## Rendering

```console
# 1080p delivery masters
npx remotion render TileFieldGold1080p     out/tile-field-gold-1080p.mp4     --codec=h264 --crf=16
npx remotion render TileFieldNavy1080p     out/tile-field-navy-1080p.mp4     --codec=h264 --crf=16
npx remotion render TileFieldPlatinum1080p out/tile-field-platinum-1080p.mp4 --codec=h264 --crf=16

# 4K masters
npx remotion render TileFieldGold4K        out/tile-field-gold-4k.mp4        --codec=h264 --crf=16
```

Add `--concurrency=N` to use more cores. On a machine with a real GPU the
renderer takes the WebGPU path and 4K is comfortable; on a GPU-less box the
WebGL2 fallback is software-rasterised and 4K is roughly four times the cost of
1080p.

## The loop

The reference is a seamless 15 s loop, and so is this. Every temporal frequency
in the scene is an integer multiple of `2π / 15`:

- each wave in `WAVES` carries an integer `harmonic` count,
- the camera drift is `sin`/`cos` of the loop frequency,
- even the film grain is seeded through `sin`/`cos` of the loop frequency rather
  than raw time, so the noise pattern itself comes back around.

Frame 450 is therefore frame 0 exactly. Measured: the frame 449 → 0 transition
differs by the same amount as any other adjacent pair.

## WebGPU and the fallback

`scene.ts` builds a `WebGPURenderer`. The `backend` prop picks how hard to try:

- `auto` (default) — probe WebGPU for real, and fall back to WebGL2 if it fails,
- `webgpu` — require WebGPU, and throw if it is not usable,
- `webgl2` — skip the probe.

The probe matters. Headless Chrome on a GPU-less machine advertises
`navigator.gpu`, hands back an adapter *and* a device, and only then fails to
allocate the swapchain backing for the canvas — asynchronously, from inside the
renderer, where it cannot be caught. So `probeWebGPU()` drives a throwaway
canvas through the entire path (configure → acquire a swapchain texture → clear
it → drain the queue → check both error scopes) before the real renderer is
allowed near WebGPU.

On the WebGL2 path the backend is handed a context created here with
`preserveDrawingBuffer: true`; without it the headless screenshot can catch an
already-recycled drawing buffer and come out black.

## Shading

There is no glTF, no HDRI and no PMREM. Every tile is one instance of a
19-triangle plate, and all the placement and shading is TSL:

- **Placement** — the grid position, the wave height and the tile's tangent
  frame are all derived from `instanceIndex` in the vertex stage, so the CPU
  does nothing per frame but set one time uniform.
- **Normals** — the top of a tile is a shallow pillow dome. Its normal is
  rebuilt analytically from the interpolated tile-local position, which makes
  the dome smooth per pixel and lets the mesh stay coarse. This is what gives
  every tile its own bar of highlight.
- **Environment** — a four-stop procedural gradient against the elevation of the
  reflected ray, with a bright band parked at the elevation a *flat* tile
  reflects at. Wave tilt sweeps each tile into and out of that band; that is
  where the broad diagonal light bands come from.
- **Metal** — Schlick with the metal colour as F0, plus a broad key lobe, a
  tight specular lobe for the far-field sparkle, and a positional falloff that
  puts the light upper-left and the shadow lower-right.

Retargeting to a new palette means editing `themes.ts` and nothing else.

## Post

`post.ts` holds a depth-of-field gather and a bloom, both written as plain TSL.
three ships better versions of both, and neither survives this pipeline:

- `DepthOfFieldNode` resolves its circle-of-confusion into an `R16F` multiple
  render target, which SwiftShader does not resolve correctly — the effect comes
  back as a flat field.
- `BloomNode` does its work in `updateBefore()`, binding its own render targets
  mid-frame. Nested inside a larger output expression it leaves the canvas bound
  to one of them, and the frame comes out as nothing but the clear colour.

Both replacements stay inside the fragment shader, so they compose with
anything. Depth-of-field taps are weighted towards the highlights, which is what
turns the specular pin-points in the far field into round bokeh discs.

## Why three is pinned

`three` is pinned to `0.184.0`. From `0.185` the WebGPU backend passes
`swizzle: 'rgba'` — a string — in its `GPUTextureViewDescriptor`, while current
Chrome expects the dictionary form of `GPUTextureComponentSwizzle` and rejects
the call outright. `0.184.0` predates the field and works on both.
