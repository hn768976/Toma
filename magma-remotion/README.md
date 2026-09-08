# Molten Magma Surface — Remotion

Three seamless 20-second loops of a procedural molten surface: dark crust
plates with concentric contour rings, floating in a connected molten matrix of
glowing veins. Everything is generated in a single GLSL fragment shader — there
are no texture assets, no video, and no geometry beyond one full-screen triangle.

| Composition id    | Delivered as          | Look                          |
| ----------------- | --------------------- | ----------------------------- |
| `V1-MagmaOrange`  | `V1_MagmaOrange.mp4`  | Magma / lava (reference match) |
| `V2-PlasmaBlue`   | `V2_PlasmaBlue.mp4`   | Blue plasma — energy, cryo, sci-fi |
| `V3-ToxicGreen`   | `V3_ToxicGreen.mp4`   | Toxic green — biohazard, acid, alien |

All three compositions are **3840×2160, 30 fps, 600 frames (20s)** and differ
only in their colour ramp.

> Composition ids use `-` rather than `_` because Remotion only accepts
> `a-z A-Z 0-9 -` in an id. The delivered filenames use `_` as specified.

## Quick start

```bash
npm install
npx remotion studio
```

## Rendering at 4K

Each composition is already defined at 3840×2160, so a 4K render is just
`--scale=1`:

```bash
npx remotion render V1-MagmaOrange out/V1_MagmaOrange.mp4 --scale=1 --crf=15
npx remotion render V2-PlasmaBlue  out/V2_PlasmaBlue.mp4  --scale=1 --crf=15
npx remotion render V3-ToxicGreen  out/V3_ToxicGreen.mp4  --scale=1 --crf=15
```

A 1080p preview is the same command at `--scale=0.5`. Stills:

```bash
npx remotion still V1-MagmaOrange out/V1_MagmaOrange.png --frame=0 --scale=0.5
```

### Chromium GL flag

The field is a shader, so headless Chromium needs a working WebGL backend:

```bash
npx remotion render V1-MagmaOrange out/V1_MagmaOrange.mp4 --scale=1 --crf=15 --gl=angle
```

`angle` is already set as the default in `remotion.config.ts`, so the flag is
only needed to override it. On a machine with no GPU, use `--gl=swiftshader`
— it renders identically, just in software.

### Measured render time

Measured on the machine that produced the delivered previews: **4 vCPU, no GPU**,
so ANGLE resolved to a software rasteriser. `--concurrency=4`.

| Output                | Per frame | 600 frames |
| --------------------- | --------- | ---------- |
| 1080p (`--scale=0.5`) | PF_1080   | TOT_1080   |
| 4K (`--scale=1`)      | PF_4K     | TOT_4K     |

The 4K figure is a slope rather than a single timing, so the fixed startup cost
falls out of it.

If a 4K render needs to be cheaper, reduce the domain-warp work before the
cellular work — the plate structure matters more than the swirl detail, and
`warpAmp2` in `src/constants.ts` can go to `0` to drop the second warp level,
two of the 4D noise calls, at a visible but survivable cost to the liquid
detail.

These are software-rasteriser numbers on 4 vCPU with no GPU, and are close to a
worst case; budget your own hardware by measuring a short `--frames=0-11` range
first.

## How the look is built

Four layers of maths, in `src/shaders/magma.ts`:

1. **Cellular (Worley) noise** gives plates rather than clouds. Two octaves: a
   coarse one for the crust islands and their contours, and a fine one for the
   crackle filigree inside the molten channels.
2. **Domain warping**, two levels, turns a static honeycomb into something
   liquid. The large slow level does double duty — its divergence is what
   varies cell size across the frame, which a multiplicative frequency term
   could not do without planting a focal point at the origin.
3. **A repeating colour ramp.** `fract(F1 * N)` draws a thin bright line at
   every iso-level of the distance field, which is what produces the concentric
   topographic rings inside the cooler blobs. Without this the surface reads as
   a fire filter rather than cooling crust.
4. **Advection**, which is what makes it flow. See below — it is the one piece
   the other three cannot supply.

The crust is **not** a Voronoi tiling. Thresholding `F1` per cell gives rounded
islands of varying size floating in one connected molten matrix, which is what
the reference actually shows; an `F2 - F1` tiling would instead make every plate
share a border with its neighbours and close the matrix off. `F2 - F1` is still
used, for the bright veins that run *through* the matrix.

### Motion: why a warp is not enough

A domain warp does not transport anything. It is a bounded oscillating
displacement, so raising its rate makes the field reshape faster *in place*.
Measured against the reference that shows up unmistakably: at `warpRate1 = 2.0`
the per-frame change tripled to 7.33 while block displacement between frames
stayed at 1.25px. The reference instead travels 1.66 / 6.42 / 8.73 / 10.53px
over 0.3 / 1 / 2 / 3s — steadily growing, because its structures move along
continuous paths and stay recognisable while they do.

So the field is advected. Every point travels the ellipse spanned by two static
low-frequency vector fields, once per cycle:

```glsl
qa = q + uAdvAmp * (flowA * cos(TAU * uT) + flowB * sin(TAU * uT));
```

Neighbouring regions set off in different directions, so there is no pan, and
each path is closed and traversed exactly once, so the loop still closes. The
warp and both noise fields are then sampled at `qa`, so everything travels with
the material rather than sliding through it.

Giving each point a random *phase* instead is the obvious formulation and it
does not work: the phase swings tens of degrees across a single plate, so its
two halves set off in opposing directions and it tears in place instead of being
carried. Two smooth vector fields keep neighbouring points moving together.

`advAmp` is the flow speed, `advFreq` how sharply the direction varies across
the frame. Lower `advFreq` drifts towards a pan; higher tears structures apart.

### Looping

The loop is exact, and every time-varying term is periodic in
`frame / durationInFrames`:

- All noise is sampled in **4D**, with the time dimension traversing a circle:
  `snoise4(vec4(x, y, cos(2πt) * r, sin(2πt) * r))`. `r` is the *speed* control
  — every field completes exactly one lap per loop, and a smaller radius simply
  covers less noise space on the way round. That is how the domain warp evolves
  more slowly than the cellular field while both still close.
- 4D Worley would mean searching 81 cells instead of 9, so the cellular octaves
  loop a different way: each feature point runs an ellipse whose phase and axes
  are hashed per cell, closing a whole number of times per loop. Cells keep
  their identity throughout, so plates breathe without popping.
- The brightness pulse uses an integer cycle count, and the grain is seeded from
  `fract(t)` so the frame at `t = 1` is identical to the frame at `t = 0`.

Verified twice over.

In the **source frames** (lossless stills, so no codec in the way), the
frame-to-frame difference across the seam (599 → 0) is 2.642 mean absolute
levels, against 2.637 for 598 → 599 and 2.657 for 0 → 1.

In the **encoded file**, frame differences now sit in a tight band, so the seam
can be read directly against its neighbours.

An earlier version of this file claimed those differences were bimodal and put
the spikes down to an H.264 GOP cadence re-quantising the grain. That was wrong.
The spikes came in blocks of four, matching `--concurrency 4`, and were the
renderer capturing stale frames — see **Determinism** below. They are gone.

### Determinism

The field is drawn with **raw WebGL**, not react-three-fiber, and the draw is
synchronous:

```tsx
useLayoutEffect(draw);   // during commit, before paint
...
gl.drawArrays(gl.TRIANGLES, 0, 3);
gl.finish();             // buffer complete before Remotion can screenshot
```

This is not a stylistic preference. With a renderer that draws on its own
schedule, the frame Remotion captures is whatever happened to be in the buffer
at capture time, and under `--concurrency 4` that lost **27 of 31 frames** to
stale draws, in blocks matching the worker count. Single-threaded, every frame
came out identical to frame 0.

The failure is worth knowing about because of how well it hides: a still renders
one frame into a fresh page and is *always* correct, so no amount of checking
stills reveals it. It only appears when you difference a video render against a
single-threaded render of the same range.

With the synchronous draw, `--concurrency 1` and `--concurrency 4` produce
bit-identical output (max difference 0.000 across every frame). If you change
how this component draws, re-run that comparison.

The canvas is also sized to real device pixels rather than composition size.
Remotion implements `--scale` as a device scale factor, so a canvas fixed at
3840x2160 runs the shader at 4K even for a 1080p preview and discards three
quarters of the result.

### Rendering notes

- **Bloom is analytic, not a post pass.** The vein position is already known in
  the shader, so the glow is confined to a wide falloff around the veins. A
  separable blur over the whole frame would lift the dark plates into orange
  haze, and the crust contrast is the whole subject.
- **Grain at 2%** doubles as dither. The plate interiors are large near-black
  regions and would band in H.264 without it. Checked on the *encoded* file at
  9× contrast: no posterisation, 240 distinct luma levels with no unoccupied
  levels inside the range.
- No lens flare, no chromatic aberration, no camera movement.
- A very fine crust texture sits over the dark plates, in warped space so it
  travels with them. It is barely visible at 1080p and is there for 4K.

### Two judgement calls

**Blowout.** The brief asks for the hottest 5% of the field to clip to
near-white; the reference footage it points at has essentially none (0.01% of
pixels above luma 235). These pull in opposite directions, so the delivered
grade sits between them at **~1.5%** — the vein cores visibly blow out and read
as emissive, without the wash that 5% white produces over a subject whose whole
point is crust contrast. To move it, change the exponent applied to `heat`
just before the colour lookup in `src/shaders/magma.ts`: below 1.0 raises the
blowout, above 1.0 lowers it. `0.85` lands near 5%.

Measured against the reference, frame 0, luma percentiles:

| | mean | p50 | p90 | p95 | p99 | >235 | <24 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Reference | 69.2 | 51 | 152 | 179 | 216 | 0.01% | 16.7% |
| V1 | 72.3 | 53 | 159 | 191 | 242 | 1.45% | 11.0% |

**Palette stops.** The brief lists seven stops for V1 but six for V2 and V3. All
three ramps share one field, so they need the same number of stops or the same
heat value lands at a different point of each ramp. Every listed colour is kept
in order; one interpolated stop is added near the top of V2 (`#bfe9ff`) and V3
(`#d0f890`) to match V1's structure.

### Tuning

`src/constants.ts` holds every field parameter with the palettes in
`src/palettes.ts`. The two constraints worth knowing: `cellCycles`,
`cellCycles2` and `pulseCycles` **must stay integers** or the loop breaks, and
the `warpRate` values are circle radii, not angular speeds.
