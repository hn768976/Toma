# Fiber Optics

A 3D motion graphic of glowing fiber-optic cables: translucent sheaths with
scrolling binary data printed on them, dark ferrule collars, and bundles of
strands fanning out of each connector with lit tips. The camera makes one slow
push-in over the length of the shot.

Built to match a 10.01s / 30fps reference clip, in two colourways.

## Compositions

| ID | Size | Colourway |
| --- | --- | --- |
| `FiberOptics4K` | 3840x2160 | blue |
| `FiberOptics1080` | 1920x1080 | blue |
| `FiberOpticsViolet4K` | 3840x2160 | violet |
| `FiberOpticsViolet1080` | 1920x1080 | violet |

All four are 300 frames at 30fps (10.00s) and share one component, one scene
graph and one timeline — only the palette and the pixel count differ, so the 4K
master and the 1080p delivery cannot drift apart.

```bash
npm run render:fiber-optics            # blue, 1080p
npm run render:fiber-optics-violet     # violet, 1080p
npm run render:fiber-optics-4k         # blue, 4K
npm run render:fiber-optics-violet-4k  # violet, 4K
```

Each script writes H.264 / MP4 with no audio track.

## Layout

| File | Contents |
| --- | --- |
| `FiberOptics.tsx` | Remotion component: owns the canvas, the renderer, and the per-frame draw |
| `scene.ts` | Assembles the cables, drives the camera, builds the post-processing graph |
| `cable.ts` | Sheath, ferrule rings and connector sleeve for one cable |
| `fibers.ts` | The strand bundle: curves, merged tube geometry, tip glows |
| `background.ts` | Backdrop gradient |
| `textures.ts` | Canvas-drawn binary-digit and sparkle textures |
| `palette.ts` | The two colourways |
| `rng.ts` | Seeded PRNG |
| `webgpu-probe.ts` | Decides whether WebGPU is genuinely usable |
| `constants.ts` | Frame rate, length, delivery sizes |

## Renderer

The scene runs on three.js's `WebGPURenderer` with TSL node materials and the
node-based post-processing graph.

`WebGPURenderer` also drives the WebGL2 backend, and the component picks between
them at runtime (the `backend` prop: `auto`, `webgpu` or `webgl`). The same node
materials and the same post-processing graph run either way, so the image does
not change with the backend.

`auto` does not trust `navigator.gpu`. Plenty of environments — headless
containers without a working Vulkan/Dawn backend among them — expose the API,
hand out an adapter and a device, and only then drop the GPU instance; Dawn
reports that as an unhandled rejection rather than by rejecting the call that
was made, which kills the page instead of surfacing as a catchable error. So
`webgpu-probe.ts` runs a throwaway render pass first and only reports WebGPU
usable if that completes. See the comments there for the error suppression it
installs while probing.

## Things worth knowing before changing this

**Nothing may call `Math.random()` at frame time.** Remotion renders frames out
of order and across processes. All the scene's randomness comes from `rng.ts`,
seeded once at build time.

**Effects that render internally need `NodeUpdateType.RENDER`.** Node types like
`pass` and `bloom` default to updating once per *frame*, where the frame counter
is advanced by the renderer's animation loop. Remotion drives frames itself and
never starts that loop, so those nodes run exactly once and every frame after
the first silently reuses the first frame's scene texture — the video comes out
frozen while every individual frame still looks correct. `scene.ts` promotes
them to per-render updates; anything added to that graph needs the same.

**Don't gate the draw on React state.** Flipping a state flag when setup
finishes lets Remotion screenshot in the window between `continueRender` and
React flushing that update. The component holds the engine as a promise and each
frame effect registers its own `delayRender` synchronously.

**`three` is pinned, not ranged.** 0.184+ sends a `swizzle` property in its
WebGPU texture-view descriptors that older Chromium builds reject outright, so
the version the renderer's bundled browser accepts is pinned exactly.

**Depth of field is faked.** A real bokeh pass (three's `DepthOfFieldNode`) was
tried and dropped: on the software GL path it intermittently renders black,
which across 300 frames means a ruined take with nothing to notice mid-render.
The `dim` values in `CABLE_LAYOUT` push the background cables back instead.
