# Ink Diffusion

A locked macro shot of ink blooming and threading through water. Three
versions, 20 seconds each, authored at 3840×2160 / 30fps.

| Composition | Look | Composite as |
|---|---|---|
| `V1-InkBlackOnWhite` | Black ink in clear water on white | multiply |
| `V2-InkColourOnBlack` | Blue and magenta backlit in dark water | screen |
| `V3-MilkInWater` | White milk billowing on pale grey | multiply |

Everything is procedural — one WebGL2 fragment shader, no texture assets, no
geometry, no camera move, no text or watermark. The clip is deliberately **not
a loop**: a diffusion has a direction, and forcing it to loop would mean the
ink un-mixing, which reads as a rewind.

## Rendering

Headless Chromium needs ANGLE to expose a usable GL context. That is already
set in `remotion.config.ts`:

```ts
Config.setChromiumOpenGlRenderer("angle");
```

On a machine with **no GPU**, change that to `"swangle"` (ANGLE on top of
SwiftShader) — otherwise Chromium may fail to create the context at all.

### 4K masters

```console
npx remotion render V1-InkBlackOnWhite  out/V1_InkBlackOnWhite.mp4  --scale=1 --crf=15
npx remotion render V2-InkColourOnBlack out/V2_InkColourOnBlack.mp4 --scale=1 --crf=15
npx remotion render V3-MilkInWater      out/V3_MilkInWater.mp4      --scale=1 --crf=15
```

Each writes 3840×2160, H.264, `yuv420p`, 30fps, 600 frames.

`remotion.config.ts` sets the intermediate frame format to PNG. Do not switch
it back to JPEG: the ink edges are high contrast, and JPEG ringing there
survives into the H.264 encode as mosquito noise around the thinnest tendrils.

### 1080p previews

```console
npx remotion render V1-InkBlackOnWhite out/V1_InkBlackOnWhite.mp4 --scale=0.5 --crf=16
```

`--scale` changes only the device pixel ratio, so the shader runs at exactly
the output resolution and the layout is untouched. A still, at the frame with
the most structure:

```console
npx remotion still V1-InkBlackOnWhite out/V1_InkBlackOnWhite.png --frame=340 --scale=0.5
```

### Render times

Measured on a 4-core container with **no GPU**, so Chromium falls back to
software GL. A machine with a real GPU will be far faster; these are the
pessimistic numbers.

Cost rises through the clip, because a late frame has a longer history to
unwind than an early one — so these are measured at the **end** of the clip,
not the start. Times are shader-only, with process start, bundling and browser
launch (a one-off ~3.4s) subtracted.

| Frame | 1920×1080 (`--scale=0.5`) | 3840×2160 (`--scale=1`) |
|---|---|---|
| 300 (mid-clip) | 8.3 s | — |
| 599 (last frame) | 11.0 s | 45 s |

4K costs 4.1x the 1080p figure — the shader is purely per-pixel, so cost
tracks pixel count almost exactly. Frame 0 is effectively free either way:
there is no history to integrate yet.

A full 600-frame 4K master on hardware like this is therefore a multi-hour
job; budget accordingly, or render it somewhere with a GPU.

## How it works

A true Navier–Stokes solver would need ping-pong textures carrying state
between frames, which Remotion cannot do reliably: frames render out of order
across threads, so anything depending on the previous frame renders wrong.
Instead **the density field is reconstructed from the frame number alone**.

The advection equation with a source term

```
∂ρ/∂t + (v · ∇)ρ = S(x, t)
```

has the exact characteristic solution

```
ρ(x, t) = ∫₀ᵗ S(X(s; x, t), s) ds
```

where `X(s; x, t)` is the trajectory arriving at `x` at time `t`, traced
backwards. So every pixel walks its own parcel of fluid backwards through the
velocity field and adds up the dye it passed through on the way. No state, no
textures, no ordering assumptions — frame N is a pure function of N — and
because the flow map folds and stretches, the dye comes out as filaments
rather than blobs.

**Velocity** is layered curl noise: the curl of a scalar stream function, which
is divergence-free by construction, so the motion rolls and folds instead of
smearing. Three octaves rise ~2.9× in frequency while their amplitude falls
~2.4×, so each contributes a similar amount of velocity at a finer scale. The
field drifts slowly over the clip, and its overall strength decays — strong
while the ink is entering, weak enough by the end that the motion settles.
Fresh injections add a radial jet on top, which is what makes the fronts
billow rather than just stir.

**Diffusion** is folded into the source term rather than run as a separate
blur: dye deposited `age` seconds ago is sampled as a Gaussian widened to
`√(σ₀² + 2·D·age)` with its amplitude scaled down, which is the exact solution
for a diffusing point source. Old dye is faint haze, fresh dye is a dense core.

**Tendrils** come from a rotated multi-octave texture stamped into each
nozzle. The flow map stretches those speckles into threads. Remove it and the
sources stay smooth Gaussians and the result reads as smoke, not ink.

### Cost

The integration is split in two. Phase A walks the injection window collecting
dye; phase B unwinds the settling tail after the last injection, where there is
no dye to collect and the source evaluation can be skipped entirely. Phase B's
step count ramps with the frame number, so late frames cost more than early
ones — the table above is measured at the last frame for that reason.

Each phase-A step stretches the nozzle **along the direction of travel** rather
than isotropically. That closes the gaps between discrete stamps — otherwise
the quadrature shows up as concentric bands inside the swirls — at roughly half
the step count, while keeping the nozzle sharp across the filament, which is
the direction the eye actually reads detail in.

## Tuning

`src/ink-diffusion/constants.ts` holds everything per version: the palette, the
injection points and their timings, the octave balance, flow speed and decay,
diffusion, grain and vignette. `seed` (set per composition in `src/Root.tsx`)
picks which patch of the noise field the tank sits in — every value gives a
valid flow, but they frame the bloom differently.

`sourceSteps` and `advectSteps` trade render time against integration accuracy.
The shipped values are the point where halving them again starts to visibly
simplify the finest wisps.

## Studio

```console
npm install
npx remotion studio
```

The compositions are 4K, so Studio caps the shader's buffer at
`studioPreviewWidth` (960px by default) to stay interactive. Rendering always
uses the full output resolution and ignores that cap.
