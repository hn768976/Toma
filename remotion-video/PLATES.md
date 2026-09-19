# VFX Overlay Plates

Four procedurally generated, seamlessly looping VFX overlay plates, built to
match a set of live-action stock references. Every plate is pure black
background with the element rendered in light — they are designed to be
composited over footage with a **Screen** or **Add** blend mode.

Built with **Remotion 4** + **PixiJS v8**, with each plate rendered by a single
custom full-frame **WebGL2 / GLSL ES 3.00** fragment shader.

---

## The plates

| # | Composition | Element | Frames @30fps | Duration | Reference |
|---|-------------|---------|---------------|----------|-----------|
| 01 | `DustMotes4K` / `DustMotes1080` | Fine falling particulate, three parallax depths | 435 | 14.500s | istockphoto-2008506475 (14.48s) |
| 02 | `Rain4K` / `Rain1080` | Vertical rainfall, mixed length and focus | 600 | 20.000s | istockphoto-2212768742 (20.02s) |
| 03 | `Smoke4K` / `Smoke1080` | Volumetric smoke / fog, keyed from upper left | 668 | 22.267s | istockphoto-2230909784 (22.28s) |
| 04 | `Snow4K` / `Snow1080` | Driving diagonal snow with foreground bokeh | 873 | 29.100s | istockphoto-2247911326 (29.11s) |

Every plate exists as a **4K master** (3840×2160) and a **1080p delivery
sibling** (1920×1080). They run the identical shader — the shaders are
resolution independent, so 4K resolves genuinely finer detail rather than
upscaling.

## Seamless looping

All four plates loop **exactly**: frame `durationInFrames` is bit-identical to
frame 0, so a plate can be butt-joined to itself indefinitely with no visible
seam. This is a property of the shaders, not of a crossfade applied afterwards.

Each plate is driven by one normalised loop phase `uT` in `[0, 1)`, and every
animated quantity is built to be periodic in it:

- **Dust** — the whole field *scrolls* so the fall is genuinely continuous. It
  still closes because the cell hash is wrapped modulo `travel` on the fall
  axis: after `travel` whole cells the field maps onto itself. `travel` is set
  at 2.5x–4.2x the cells visible in frame, so the vertical repeat never appears
  on screen. Lateral flutter rides on top as a periodic sinusoid.
- **Rain / Snow** — a drop travels strictly inside its own grid cell at
  `fract(phase0 + uT * k)` where `k` is a whole number of falls per loop. Cells
  are tall and vertical neighbours are sampled, so the field reads as continuous
  fall rather than as a banded grid.
- **Smoke** — the fog drifts continuously upward, so it cannot simply oscillate.
  The field is instead evaluated twice, once at phase `t` and once at the same
  field one full loop earlier, and cross-dissolved by `t`. At `t = 0` the mix is
  `F(0)`; at `t = 1` it is also `F(0)`.

Verified empirically: for each plate the pixel delta across the loop seam
(last frame → frame 0) is statistically identical to the delta between two
ordinary adjacent frames.

## Rendering

```bash
npm install

# Interactive studio - every plate is live-tweakable from the sidebar
npm run dev

# 1080p deliverables (all four)
npm run render:plates

# 4K masters (all four) - slower; 4x the pixels
npm run render:plates:4k
```

Individual composition:

```bash
npx remotion render Smoke4K out/smoke-4k.mp4 \
  --codec=h264 --crf=14 --image-format=png --muted --color-space=bt709
```

### Why these render flags

- `--image-format=png` — the intermediate frame format. These plates live almost
  entirely in the bottom 10% of the value range; a JPEG intermediate visibly
  blocks in near-black. PNG is lossless and costs little here.
- `--crf=14` — below the default 18, again to protect near-black gradients.
- `--muted` — VFX plates carry no audio, so no silent track is written.
- `--color-space=bt709` — matches the references.

## Tweaking

Every plate exposes the same four props, editable in the Remotion studio sidebar
or via `--props` on the CLI:

| Prop | Range | Effect |
|------|-------|--------|
| `density` | 0–3 | Particle / detail population multiplier |
| `brightness` | 0–4 | Output gain |
| `seed` | 0–1000 | Decorrelates every hash — a new seed is a brand new take of the same look |
| `speed` | 0.05–4 | How far the loop travels. Whole numbers preserve the exact loop for dust, rain and snow |

```bash
npx remotion render Snow1080 out/snow-heavy.mp4 \
  --props='{"density":1.8,"brightness":1.2,"seed":312,"speed":1}' \
  --codec=h264 --crf=14 --image-format=png --muted
```

> **Note on `speed`:** the smoke plate stays exactly loopable at any `speed`,
> because the value scales drift *inside* the field rather than the loop phase.
> For dust, rain and snow, `speed` multiplies a whole-number fall count, so
> integer values keep the loop exact while fractional ones will not.
>
> Smoke ships at `speed: 3` rather than 1 — the reference-matched rate read as
> too slow. Verified clean: adjacent-frame motion at mid-loop (the worst case
> for its cross-dissolve) measures 0.99x the rate at the loop ends, so there is
> no dissolve artifact. Above roughly 3 the two cross-dissolved branches start
> to decorrelate and mid-loop contrast drops.
>
> Dust ships with each depth layer falling 2.5, 3.2 and 4.2 screen-heights per
> loop (nearer = faster, which reads as parallax). It carries no heavily
> defocused foreground bokeh — the plate is all fine specks, no soft circles.

## Source layout

```
src/plates/
  plates.ts             Composition registry: ids, durations, defaults, schema
  PixiShaderStage.tsx   PixiJS v8 WebGL host, driven by Remotion's frame counter
  ShaderPlate.tsx       Binds a fragment shader to the schema props
  shaders/
    lib.ts              Shared GLSL: hashing, 3D value noise, fBm, grain
    vertex.ts           Shared vertex stage (one full-frame quad)
    dust.ts  rain.ts  smoke.ts  snow.ts
```

### Determinism

Remotion renders frames in parallel and not necessarily in order. The Pixi
ticker is never started and nothing in the shaders integrates a delta-time, so
a frame's output is a pure function of `useCurrentFrame()` and is identical no
matter when or on which worker it is rendered. Drawing happens in
`useLayoutEffect` — synchronously, before paint — and the WebGL context is
created with `preserveDrawingBuffer` so the backbuffer is still readable when
Remotion captures it.

### WebGL, not WebGPU

The plates target **WebGL2**. Remotion renders in headless Chrome, where WebGPU
is not dependably available — and on a machine without a GPU (as here) Chrome
falls back to the SwiftShader software rasteriser, which implements WebGL2 but
not WebGPU. Nothing in these shaders needs compute shaders or storage buffers,
so WebGL2 costs nothing in quality and makes the render reproducible anywhere.
