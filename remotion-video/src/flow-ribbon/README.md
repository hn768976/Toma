# Flow Ribbon

An abstract 3D motion graphic: a bundle of glossy strands flowing along a
travelling wave, under a broad rolled sheet carrying a cloud of defocused
specks. Built with three.js + TSL on `WebGPURenderer`, driven frame-by-frame
by Remotion.

Two colour variants ship, as a matched mirrored pair:

| Composition | Size | Variant |
| --- | --- | --- |
| `FlowRibbon-Reference-1080p` | 1920x1080 | blue/violet, band runs upper-left to lower-right |
| `FlowRibbon-Reference-4K` | 3840x2160 | same |
| `FlowRibbon-Cyan-Mirrored-1080p` | 1920x1080 | dark blue/cyan with teal-green accents, mirrored left-right |
| `FlowRibbon-Cyan-Mirrored-4K` | 3840x2160 | same |

All four are 430 frames at 30fps (14.333s) and loop seamlessly.

## Rendering

```console
npm i
npx remotion render FlowRibbon-Reference-1080p      out/reference-1080p.mp4      --codec=h264 --crf=16
npx remotion render FlowRibbon-Reference-4K         out/reference-4k.mp4         --codec=h264 --crf=16
npx remotion render FlowRibbon-Cyan-Mirrored-1080p  out/cyan-mirrored-1080p.mp4  --codec=h264 --crf=16
npx remotion render FlowRibbon-Cyan-Mirrored-4K     out/cyan-mirrored-4k.mp4     --codec=h264 --crf=16
```

Add `--concurrency=N` to match the machine. With a software WebGPU backend a
4K frame is expensive; on a machine with a real GPU it is far quicker.

`npm run dev` opens Remotion Studio, where `variant` and `mirrored` are
editable props, so other combinations (mirrored blue/violet, unmirrored cyan)
can be previewed and rendered without touching the code.

## How it is put together

The scene is a pure function of one uniform, `loopT`, normalised loop time in
`[0, 1)`. Nothing integrates state between frames - that is what lets Remotion
render frames out of order across parallel workers and still get a coherent
result, and it is why every "random" value is seeded from a particle index
rather than `Math.random()`.

Layers, back to front:

| File | Layer |
| --- | --- |
| `haze-sheet.ts` | additive wash sitting behind the band |
| `band-sheet.ts` | the band's smooth upper body, a sheet rolling away from camera |
| `ribbon-strands.ts` | the bundle of glossy half-tube strands |
| `particle-cloud.ts` | specks riding on the sheet, with depth-of-field bokeh |

`wave.ts` holds the wave field all four layers are displaced by. `scene.ts`
assembles them, adds bloom and a vignette, and owns the render loop.

### Two things the design turns on

**Seamlessness.** Every animated term uses a temporal frequency that is an
integer multiple of `1 / LOOP_SECONDS`, and every spatial term an integer
multiple of `TAU / WAVE_PERIOD`. Particles drift exactly one wave period per
loop and wrap inside a cell one period wide, so each returns to its exact
starting position. Measured, the difference between the last frame and frame 0
is the same magnitude as between any two consecutive frames.

**Resolution independence.** The scene is authored in world units and framed
by a perspective camera, so the 4K compositions are the same image as the
1080p ones, sampled more finely - nothing is re-tuned per size. Two things had
to be corrected for that to hold: three's bloom pyramid spans a fixed number
of texels, so it is pinned to the 1080p-equivalent size (`scene.ts`); and
specks are drawn from a cell grid in surface space rather than hashed per
fragment, so they have a real footprint instead of being pixel noise
(`specks.ts`). What remains between the two is antialiasing of sub-pixel
specular detail, which is what rendering at 4K is for.

## Rendering path

`WebGPURenderer` draws into an offscreen `RenderTarget`; the frame is read back
and blitted into a 2D canvas, rather than presented through the WebGPU swap
chain.

This is deliberate. A WebGPU swap chain needs a compositor-backed surface,
which a headless browser does not have - presenting there tears the GPU device
down mid-frame (`Instance dropped in popErrorScope`). Reading back instead
sidesteps that, and has a second benefit for a frame-accurate renderer: the
pixels are provably on the canvas before Remotion screenshots the page, with no
dependence on compositor timing.

Where no WebGPU adapter exists at all, the renderer is built with its WebGL2
backend instead. TSL emits both WGSL and GLSL from the same node graph, so the
image does not change; `scene.getBackend()` reports which path was taken.

## Version notes

`three` is pinned to **0.184.0**. From 0.185 three sets a `swizzle` field on
every WebGPU texture view descriptor, which Chromium 141 - the vintage Remotion
ships its Chrome Headless Shell at - rejects outright:

```
TypeError: Failed to execute 'createView' on 'GPUTexture':
Failed to read the 'swizzle' property from 'GPUTextureViewDescriptor'
```

Upgrading three means checking that Remotion's bundled Chrome is new enough to
accept it.
