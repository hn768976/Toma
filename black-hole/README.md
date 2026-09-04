# Black Hole / Gravitational Lensing — Remotion

A 30-second seamless loop of a Schwarzschild black hole: a hard black event
horizon with soft, blurry dust motes orbiting well clear of it, lensed up over
the top of the sphere and back under it, against a lensed starfield. Nothing
touches the black disc — a clear gap isolates it. Monochrome, gold and blue
versions.

Everything is procedural. No texture assets, no external media, no watermark.

## Compositions

| Composition id      | Version                | Output name            |
| ------------------- | ---------------------- | ---------------------- |
| `V1-BlackHoleMono`  | Monochrome white/grey  | `V1_BlackHoleMono.mp4` |
| `V2-BlackHoleGold`  | Warm gold/orange       | `V2_BlackHoleGold.mp4` |
| `V3-BlackHoleBlue`  | Blue/cyan              | `V3_BlackHoleBlue.mp4` |

All three are **3840×2160, 30 fps, 900 frames (30s)**. Geometry, motion and
timing are identical across the three — only the colour ramp changes, selected
by the `palette` prop and applied by a single `ramp()` in the fragment shader.

(Composition ids use `-` because Remotion does not allow `_` in an id. The
rendered file names use `_`.)

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are defined at 3840×2160, so a full-resolution render is just
`--scale=1`:

```bash
npx remotion render V1-BlackHoleMono out/V1_BlackHoleMono.mp4 --scale=1 --crf=16
npx remotion render V2-BlackHoleGold out/V2_BlackHoleGold.mp4 --scale=1 --crf=16
npx remotion render V3-BlackHoleBlue out/V3_BlackHoleBlue.mp4 --scale=1 --crf=16
```

Stills:

```bash
npx remotion still V1-BlackHoleMono out/V1_BlackHoleMono.png --frame=558 --scale=1
```

Add `--scale=0.5` instead for a 1920×1080 preview. The canvas sizes its own
backing store from the render scale, so a half-scale preview traces a quarter of
the rays rather than rendering 4K and downsampling.

### On a machine without a GPU

Append `--gl=swangle` to render through SwiftShader. On a machine with a working
GPU leave it off — `remotion.config.ts` already selects `angle`, which is
roughly an order of magnitude faster for this shader.

## Render times

Measured on a 4-core cloud VM with **no GPU** (SwiftShader software rasteriser,
`--gl=swangle`, `--concurrency=1`), which is the slow case:

| Resolution           | Per frame | Per 900-frame composition |
| -------------------- | --------- | ------------------------- |
| 1920×1080 (`--scale=0.5`) | **~4.6 s** | **~1 h 10 m** |
| 3840×2160 (`--scale=1`)   | ~18 s (projected, 4× the pixels) | **~4 h 40 m** (projected) |

The 1080p figure is the wall-clock average over a full 900-frame render, encode
included. The shader cost is very close to linear in pixel count, so the 4K
projection is reliable — budget about five and a half hours per composition on a
comparable CPU-only machine, or roughly sixteen and a half hours for all three. **On a real GPU expect this to drop by roughly an order of
magnitude** — budget the 4K pass accordingly, and raise `--concurrency` only if
the renderer is *not* SwiftShader (SwiftShader already saturates every core from
a single context, so extra concurrency just adds memory pressure).

## How it works

`src/shaders/blackhole.ts` is the whole picture; everything else is plumbing.

**Lensing.** Rather than marching a 3D deflection field, each ray is integrated
in its own orbital plane using the null-geodesic orbit equation
`u'' + u = 3M u²` (with `u = 1/r`), which is *exact* for photons in Schwarzschild
and costs a handful of scalar operations per step. Units are `rs = 1`, so the
horizon is at `r = 1`, the photon sphere at `r = 1.5`, and the shadow's apparent
edge at the critical impact parameter `b = 3√3·M = 2.598`. Because the orbit is
planar, the disc plane is crossed at exactly two known values of `phi` per turn
— crossings are solved for in closed form instead of being hunted for by
sampling. That is what produces the double arc: the far side of the disc appears
both above and below the sphere.

**Nothing touches the black disc.** Emission fades out below a fixed impact
parameter, which is a circle in screen space concentric with the shadow, so the
clear gap is guaranteed by construction rather than by hoping the geometry
cooperates — strongly lensed images would otherwise wrap right up against the
horizon. A second, much tighter mask keeps bloom off the horizon's edge; using
the wide gap for both jobs turns the black disc into a soft blob and loses the
hard edge that sells its scale.

**Dust motes, not a turbulent disc.** The motes sit on a polar grid, one per
cell, jittered in position, size and brightness, with a soft shoulder rather
than a hard core so they read as blurry light rather than as sprites. Their
shape is corrected for the *local* foreshortening of the disc's radial and
tangential directions, taken from the ray's own tangent at each crossing: a
single global aspect cannot work, because the plane is seen at a different
grazing angle across the frame, and motes that are round near the hole streak
into radial spokes further out. Where the sightline runs along the orbit the
tangential foreshortening collapses and a mote would stretch without bound, so
that term is clamped.

**The horizon is an absolute void.** Any radiance a ray gathered before falling
through the horizon is discarded, so nothing shows through the black disc — no
edge glow, no gradient. A strictly physical edge-on render would let near-side
material cross in front of the shadow; lifting the reference's shadow by three
stops shows a perfectly flat black, so this follows the reference.

**Seamless loop.** Time enters the shader only as `uT = frame / durationInFrames`
in `[0,1)`, and every time-varying term is periodic in it *by construction*:

- Rotation is differential (inner motes faster than outer), which cannot complete
  a whole number of turns at every radius at once. Each radial row therefore
  takes its own *integer* turn count, so every row returns exactly to its start;
  neighbouring rows take different counts, and that difference is the shear.
  Because the motes are discrete, the row boundaries are invisible — no
  cross-fading, and so no ghosting.
- The rotation phase is reduced modulo one turn (`fract(n*t)`). Whole turns can
  be dropped without moving a single mote, and doing so keeps the coordinate
  small: subtracting `n*t` outright loses enough mantissa that `t = 1` lands a
  rounding error away from `t = 0` rather than exactly on it. This one caught
  the loop out twice.
- Star twinkle uses `sin(TAU * fract(k*t + phase))` with integer `k`. The `fract`
  matters: `sin(TAU*k + x)` is only periodic in exact arithmetic, not in floats.

Frame 900 is byte-identical to frame 0 — verified by rendering both and
comparing the files.

**Performance.** The renderer is a five-stage pass chain (scene → thresholded
bright pass → separable blurs at half and eighth resolution → composite). Two
things dominate cost on a software rasteriser, and neither is the one you would
guess:

- *Per-pixel branching*, by a wide margin. Removing one divergent early-out from
  the noise path — and paying for the extra noise evaluation it was avoiding —
  made the shader 27% faster.
- *Transcendentals at disc crossings*. A single shared `log2(r)` now feeds the
  radial profile, the rotation rate and both noise layers' radial coordinate,
  and the `pow()` calls became one `exp2` each.

The exit direction is computed in closed form (`phi_inf = phi + pi - atan(u, du)`)
rather than read off the last integration step. Reading it off the step makes it
jump wherever the step count changes between neighbouring pixels, which tears
the starfield into false arcs. Stars themselves sit on equal-area latitude rings
— a single lat/long grid degenerates at the poles, where one cell spans a whole
latitude circle and smears one star into an arc across the frame.

Supersampling is adaptive: 4 rays per pixel only inside a band around the
critical impact parameter, where the horizon edge, the photon ring and the
tightest arcs live. One ray per pixel is already smooth everywhere else, and
stars are sized in angular units so they cover the same solid angle — and stay
the same apparent size — at 1080p and at 4K.

**Post.** The light is meant to be soft and blurry, so the bloom threshold sits
low — most of the frame feeds it — and the wide halo is built from four blur
passes at increasing radius rather than one tight one. It is masked by the
keep-clear region so no glow creeps back across the gap onto the horizon. Grain
sits at ~2%: large smooth dark
falloffs around a black disc are the worst case for H.264 banding. The encoded
1080p output was checked at 14× contrast across the falloff and shows no
contouring at CRF 16. If a 4K encode does band, raise `LOOK.grain` in
`src/look.ts` before lowering the CRF.

No lens flare, no chromatic aberration, no camera motion — the camera is locked.

## Tuning

`src/look.ts` holds exposure, grain, bloom strengths and the horizon's position
in frame. The palettes and all the geometry constants live at the top of
`src/shaders/blackhole.ts`.

## Layout

```
src/
  index.ts               registerRoot
  Root.tsx               the three compositions
  BlackHole.tsx          canvas + per-frame draw, sized from the render scale
  look.ts                shared look constants; the only per-version difference
  gl/renderer.ts         WebGL2 pass chain (scene, bloom, composite)
  shaders/blackhole.ts   the lensing scene
  shaders/post.ts        bright pass, blur, composite
remotion.config.ts
```
