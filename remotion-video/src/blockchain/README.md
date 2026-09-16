# Blockchain data chain

A 3D "blockchain / global data network" motion background: a chain of
binary-skinned cubes streaming past the lens over a dot-matrix world
map, a floor of glowing data marks and a drifting particle haze.

Built with **three.js WebGPU** (`three/webgpu` + TSL node materials),
driven frame-by-frame by Remotion.

Two layouts, each registered at 1080p and 4K:

| Composition                 | Layout     | Size        | Frames | FPS |
| --------------------------- | ---------- | ----------- | ------ | --- |
| `BlockchainChain1080p`      | `diagonal` | 1920 × 1080 | 600    | 30  |
| `BlockchainChain4K`         | `diagonal` | 3840 × 2160 | 600    | 30  |
| `BlockchainChainHero1080p`  | `hero`     | 1920 × 1080 | 600    | 30  |
| `BlockchainChainHero4K`     | `hero`     | 3840 × 2160 | 600    | 30  |

600 frames at 30fps = **20.000s**, matching the reference clip exactly.

- **`diagonal`** reproduces the reference framing: the chain recedes
  toward the upper right, nearest cube large in the lower left, camera
  dollying forward down the chain.
- **`hero`** is the alternate layout: the chain crosses the frame
  left-to-right with one large hero cube foreground-left, the camera
  trucking sideways instead of pushing in, and the lower third kept
  clear of cubes so titles can sit there.

## Rendering

```console
npx remotion render BlockchainChain1080p out/chain-a-1080p.mp4 --codec=h264 --crf=16
npx remotion render BlockchainChainHero1080p out/chain-b-1080p.mp4 --codec=h264 --crf=16
npx remotion render BlockchainChain4K out/chain-a-4k.mp4 --codec=h264 --crf=16
npx remotion render BlockchainChainHero4K out/chain-b-4k.mp4 --codec=h264 --crf=16
```

The 1080p and 4K compositions differ only in `resolutionScale`, which
drives particle density, texture resolution and the bokeh radius, so
the two resolutions stay visually identical rather than the 4K version
coming out denser and sharper by accident.

## Props

Every composition is schema-typed, so all of these are editable live in
Remotion Studio without touching code:

| Prop              | Meaning                                                    |
| ----------------- | ---------------------------------------------------------- |
| `layout`          | `"diagonal"` or `"hero"`                                    |
| `resolutionScale` | `1` = 1080p, `2` = 4K. Must match the composition's size.   |
| `seed`            | Reshuffles every procedural detail (skins, haze, readouts). |
| `depthOfField`    | Turn the DOF pass off for a much faster preview.            |

## Layout of the code

| File                    | Responsibility                                               |
| ----------------------- | ------------------------------------------------------------ |
| `constants.ts`          | Timing, palette, density, bloom. All 1x values.               |
| `layouts.ts`            | The two camera rigs, chain axes and focus settings.           |
| `engine.ts`             | Renderer, post-processing chain, per-frame update.            |
| `BlockchainChain.tsx`   | Remotion component; owns engine lifecycle and `delayRender`.  |
| `scene/cubeChain.ts`    | The cube conveyor, edge beams, link strips, depth proxy.      |
| `scene/dataField.ts`    | World map, digit wall, floor marks, haze, readouts.           |
| `textures.ts`           | All canvas-generated textures (no image assets).              |
| `worldMap.ts`           | The continents, as checkable ASCII art.                       |
| `rng.ts`                | Seeded PRNG.                                                  |

## Things worth knowing before changing this

These are all load-bearing, and each one cost a debugging round.

**Determinism.** Remotion renders frames out of order across several
browser tabs. Nothing may read a clock or `Math.random()` — every
random value comes from the seeded `makeRandom()` stream, and every
animated value is a pure function of `frame`.

**three is pinned to 0.184.0.** From 0.185 onward the WebGPU backend
sends `swizzle: 'rgba'` on every `GPUTextureViewDescriptor`, which
Chromium 141's Dawn rejects outright (`Failed to read the 'swizzle'
property ... not of type 'GPUTextureComponentSwizzle'`), killing the
device on the first render target. Do not bump three without checking
that the Chrome that Remotion ships accepts it.

**We never present to a canvas swap chain.** `renderer.setOutputRenderTarget()`
points the renderer at an offscreen `RenderTarget`, and each frame is
read back with `readRenderTargetPixelsAsync()` and blitted into a 2D
canvas. Configuring a WebGPU canvas context needs a shared-image
backing that headless Chromium cannot allocate on a software
(SwiftShader) adapter — the attempt tears down the entire Dawn
instance, taking the device with it. The readback costs a few ms per
frame, which is irrelevant for offline rendering, and the same path
works unchanged on a real GPU and on the WebGL2 fallback backend.
The WebGPU backend returns those rows top-down, which is the order
`ImageData` wants, so there is no vertical flip in the blit.

**`THREE.Points` is unusable here.** three's WebGPU backend can only
draw 1-pixel point primitives — `PointsNodeMaterial.size` is silently
ignored, so the world map and the particle haze rendered as invisible
single pixels. Both are `InstancedMesh` quads instead; the haze is
billboarded on the CPU each frame, the map dots are coplanar with the
map and need no billboarding.

**Depth of field needs the depth proxies.** Every visible material is
additive with `depthWrite: false`, which leaves the depth buffer empty
and makes the DOF pass defocus the whole frame uniformly. Invisible
`colorWrite: false` boxes (following the cubes) and a ground plane
write depth only, giving the pass a real per-pixel distance. Because
of that, every visible material also sets `depthTest: false` — the
depth buffer no longer describes what is drawn, and additive blending
is order-independent anyway.

**The DOF is hand-rolled**, not three's `DepthOfFieldNode`. That one
runs an 80-tap two-pass bokeh through half-float MRT targets, which is
more than this look needs and unreliable on SwiftShader. `engine.ts`
does a single-pass 24-tap golden-angle gather with a per-pixel rotation
hash; without the rotation, every small bright point smears into 24
discrete copies and the defocused areas fill with star shapes.

**Cube faces are `FrontSide`.** With `DoubleSide` the back faces blend
additively over the front ones and the binary digits mush into noise.

## Performance

On a GPU-less machine (software WebGPU via SwiftShader/Dawn) 1080p runs
around 1.7s/frame on 4 cores — roughly 17 minutes for a 600-frame
render. 4K is about four times that. On a machine with a real GPU it is
dramatically faster. `depthOfField: false` is the single biggest saving
when iterating.

`remotion.config.ts` sets `swangle` as the OpenGL renderer and forces
multi-process on Linux; both are required for a WebGPU adapter to exist
at all in headless Chromium. Remotion already passes
`--enable-unsafe-webgpu` itself.
