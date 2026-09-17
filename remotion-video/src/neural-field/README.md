# Neural Field

A 3D abstract tech background, built with three.js + WebGPU (TSL node materials)
and driven frame-by-frame by Remotion.

10.000s · 30fps · 300 frames · 16:9 · silent — the same wall-clock length as the
reference clip, retimed from its 25fps to 30fps.

`remotion.config.ts` sets `setMuted(true)`: nothing here has audio, and without
it Remotion muxes a silent AAC track whose duration rounds up to its own frame
grid, leaving the container 10.048s long where the video track is exactly
10.000s.

## Compositions

| Composition ID           | Size      | Treatment                              |
| ------------------------ | --------- | -------------------------------------- |
| `NeuralFieldAurora`      | 1920×1080 | teal/cyan/green, dense side **left**   |
| `NeuralFieldAurora4K`    | 3840×2160 | same, mastered at 4K                   |
| `NeuralFieldNebula`      | 1920×1080 | dark blue/violet, **mirrored** (right) |
| `NeuralFieldNebula4K`    | 3840×2160 | same, mastered at 4K                   |

```console
npm i
npm run dev                    # Remotion Studio, all four compositions

# 1080p delivery
npx remotion render NeuralFieldAurora out/aurora_1080p.mp4 --codec=h264 --crf=16
npx remotion render NeuralFieldNebula out/nebula_1080p.mp4 --codec=h264 --crf=16

# 4K master
npx remotion render NeuralFieldAurora4K out/aurora_4k.mp4 --codec=h264 --crf=16
npx remotion render NeuralFieldNebula4K out/nebula_4k.mp4 --codec=h264 --crf=16
```

`resolutionScale` (1 at 1080p, 2 at 4K) refines sampling-rate-dependent detail —
mesh subdivision — so the 4K render resolves the same picture more finely. It
deliberately does **not** scale the particle count: the bokeh live in world space
inside a frustum that does not change with frame size, so scaling their number
would put four times as many discs on screen at 4K, which is a different picture
rather than a sharper one. Their sizes are in world units and sharpen on their
own. Change a look parameter once and both resolutions and both colourways follow.

## Files

| File              | Role                                                         |
| ----------------- | ------------------------------------------------------------ |
| `constants.ts`    | timing, camera, focal plane, densities — all declared at 1x   |
| `palettes.ts`     | the two colour treatments                                     |
| `ridgeField.ts`   | the gyri/fingerprint layer (TSL)                              |
| `bokehField.ts`   | the defocused particle volume (TSL, instanced)                |
| `scene.ts`        | scene assembly, camera move, bloom/vignette/grain             |
| `presenter.ts`    | offscreen render target → 2D canvas blit                      |
| `webgpuCompat.ts` | `GPUTexture.createView()` descriptor shim                     |
| `NeuralField.tsx` | the Remotion component                                        |
| `random.ts`       | seeded PRNG                                                   |

## How the look is built

The gyri carry a thin bright trace along each crest. An earlier version
scattered beads of light along those traces with a cell-noise mask; that mask is
constant across each of its cells, and wherever the field flattens the band term
stops being a thin line and becomes a broad plateau, so the two together stamped
flat rectangles ~0.6 world units across into the frame. Both backends showed it,
because they share a software rasteriser here. It is gone with the dots.

**The gyri** are a synthetic-fingerprint construction: a constant slope across x,
bent by a domain-warped fractal noise field, sliced into contour bands. Contouring
the noise directly spaces bands by its gradient, so flat regions open into dead
areas; the slope guarantees even band density while the warp supplies the meander.
The field is evaluated per fragment (vertex interpolation aliases at this band
density); the vertex stage runs a cheaper, lower-octave version of the same field
for the relief displacement.

**The bokeh layer is off by default** (`particles: "none"`). The prop takes:

| `particles` | draws                                            |
| ----------- | ------------------------------------------------ |
| `none`      | the gyri field alone — the current default        |
| `sparkles`  | fine in-focus points, no discs                    |
| `full`      | defocused bokeh discs plus the sparkles           |

Particles the mode rejects are still drawn from the PRNG and then discarded, so
the ones a mode keeps land exactly where they would have with the layer full.
Skipping the draws instead would reshuffle the whole field.

When it is on, **the bokeh** carry their own circle of confusion rather than
going through a depth-of-field post pass. Each particle's depth sets its disc size, its edge
softness and its brightness falloff, so a particle far from the focal plane is a
large faint crisp-edged disc with a bright rim — what a real defocused highlight
looks like — and one near it is a small soft point. Depth is derived from a target
defocus rather than a uniform scatter, which is what keeps big discs rare.

**Seamless loop.** Every time-varying term is driven by `cos`/`sin` of a single
phase that completes one turn per clip, and the bokeh drift wraps an integer
number of times, so frame 300 lands exactly on frame 0.

## WebGPU notes

Everything is authored against `three/webgpu` + TSL, so the same source compiles
to WGSL on the WebGPU backend and GLSL on `WebGPURenderer`'s WebGL2 fallback.
The component logs which backend it got. Two environment issues are handled in
source rather than by patching `node_modules`:

- **`webgpuCompat.ts`** — three r186 fills its texture-view descriptor with recent
  draft fields (`swizzle`, `usage`) that some Chromium/Dawn builds reject outright,
  killing the render before frame 1. The shim retries without them; every field it
  can strip is optional or the identity value, so it cannot change what is drawn.
- **`presenter.ts`** — headless Chromium on a machine with no real GPU has no
  shared-image backing factory for a WebGPU canvas swap chain, and a failed
  `GPUCanvasContext.configure()` takes the whole Dawn instance down. So three is
  never given a canvas to present to: frames render into an offscreen
  `RenderTarget` and are blitted to a 2D canvas for Remotion to screenshot.
  Readback costs ~9ms at 1080p.

`remotion.config.ts` sets `setChromiumMultiProcessOnLinux(true)` (WebGPU needs
Chromium's GPU process; Remotion passes `--single-process` by default) and
`setChromiumOpenGlRenderer("swangle")` (plain `angle` tries to open an X display
and the GPU process exits).

## Tuning

Most art direction lives in `constants.ts` and `palettes.ts`. The rest:

- `ridgeField.ts` — `FIELD_FREQ`, `FIELD_ANISOTROPY` (how vertically combed the
  ridges are), `WARP_STRENGTH`, `RIDGE_SLOPE`, `RIDGE_WANDER`; `presence` /
  `sharpness` control where the mass dissolves and where detail drops out.
- `bokehField.ts` — only relevant with `particles` set to `sparkles` or `full`:
  `COC_GAIN` (how much a defocused particle grows), `COC_DIM` (how fast it dims
  as it spreads), the `defocus` exponent (how rare big discs are).
- `scene.ts` — `bloom(scenePass, strength, radius, threshold)`, vignette, grain.
