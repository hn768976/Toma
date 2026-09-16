# Neon Layers

A seamless 5-second loop: a stack of square slabs, each twisted a little
further than the one in front of it, with a light caught in the chamfer along
every outline. Built with three.js' `WebGPURenderer` and TSL, driven by
Remotion's frame clock.

Two themes, one scene. `violet` matches the supplied reference — near-black
matte slabs, magenta-violet seams. `cyan` is its light-mode counterpart —
off-white slabs, cyan seams, bright backdrop. Geometry, camera and motion are
identical between them; only `themes.ts` differs, so the pair stays in sync.

## Compositions

| ID | Size | Notes |
| --- | --- | --- |
| `NeonLayersViolet1080p` | 1920×1080 | Delivery master |
| `NeonLayersCyan1080p` | 1920×1080 | Delivery master |
| `NeonLayersViolet4K` | 3840×2160 | Master at delivery resolution |
| `NeonLayersCyan4K` | 3840×2160 | Master at delivery resolution |
| `NeonLayersLookDev` | 768×432 | Reference-sized, cheap to iterate on |

All five are 151 frames at 30fps (5.033s), matching the reference clip frame
for frame.

## Rendering

```console
npx remotion render NeonLayersViolet4K out/violet-4k.mp4 --codec=h264 --crf=16
```

`remotion.config.ts` already sets everything the WebGPU path needs. On a
machine with a real GPU the renders are much faster than on the software
rasteriser, and nothing else changes.

## Why the loop is exact

Over one period the stack slides forward by exactly one slab and turns by a
whole number of quarter turns minus one slab's twist. That lands every slab
precisely where its neighbour started, and because the slab is square a quarter
turn maps it onto itself — so the last frame is byte-identical to the first,
not merely close. Extra slabs are built behind the camera and past the fog so
nothing enters or leaves frame at the seam.

Frame 150 is that repeat of frame 0; the composition is 151 frames because the
reference is.

## Running WebGPU headlessly

Three things are load-bearing, and all three are already configured:

1. **`gl: "swiftshader"`.** Chromium only exposes a WebGPU adapter when it can
   reach a Vulkan driver. Without a GPU that means the bundled SwiftShader ICD.
2. **Multi-process Chromium.** Remotion defaults to `--single-process` on
   Linux, which leaves no GPU process; `requestAdapter()` then returns null or
   the device is dropped part-way through a render.
3. **Never drawing to the canvas.** Presenting a WebGPU canvas needs a shared
   swap-chain image that both Dawn and the compositor can read. On a GPU-less
   machine that allocation fails and takes the GPU process — and the device —
   with it. `gpu-surface.ts` renders into a `RenderTarget` and reads the
   result back into a 2D canvas instead, which is what Remotion screenshots.

`three` is pinned to 0.184.0. r185 and r186 send `swizzle: 'rgba'` on every
texture-view descriptor, where the WebGPU spec wants a `GPUTextureComponentSwizzle`
dictionary; current Chromium rejects it and every render fails at the first
`createView`. Check the release notes before bumping.

## Files

- `NeonLayers.tsx` — the Remotion component; resolves theme and layout.
- `WebGPUCanvas.tsx` — bridges Remotion's frame clock to an async GPU draw.
- `gpu-surface.ts` — offscreen WebGPU surface with readback presentation.
- `scene.ts` — builds the slab stack and poses it per frame.
- `geometry.ts` — the rounded-square slab.
- `material.ts` — TSL shading for the slabs and the seam light.
- `post.ts` — scene render plus bloom composite.
- `layout.ts` — geometry, stack and camera dimensions.
- `themes.ts` — everything that differs between the two versions.
