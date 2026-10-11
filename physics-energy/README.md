# Physics & Energy — Remotion project (8 compositions)

Five looks, eight compositions. All are 3840×2160, 30 fps, 600 frames (20 s) and loop seamlessly. Everything is built in code with three.js inside `@remotion/three` (WebGL2).

| Composition id | Look | Version |
|---|---|---|
| `WindFarmHologram-Blue` | Wind farm hologram (3D) | 1A Blue (as reference) |
| `WindFarmHologram-Green` | Wind farm hologram (3D) | 1B Green |
| `PrismDispersion-Dark` | Prism dispersion (3D) | 2 Dark |
| `MagneticTorus-PinkViolet` | Magnetic torus (3D) | 3 Pink-violet |
| `BarMagnets-Attract` | Bar magnets (3D) | 4A Attract (S faces N) |
| `BarMagnets-Repel` | Bar magnets (3D) | 4B Repel (N faces N) |
| `ElectricField-OppositeCharges` | Electric field (2D, orthographic) | 5A + / − |
| `ElectricField-LikeCharges` | Electric field (2D, orthographic) | 5B + / + |

Each version is one data row in `src/variants.ts`.

## Setup

```bash
npm install
npx remotion studio          # preview (the Studio draws at half resolution to stay interactive)
```

Node 18+ is required. Versions are pinned in `package.json` and `package-lock.json`.

### Chromium GL flag

Rendering needs WebGL2 through ANGLE. `remotion.config.ts` sets this already:

```ts
Config.setChromiumOpenGlRenderer("angle");   // CLI equivalent: --gl=angle
```

On a machine with a GPU, ANGLE uses the GPU. Without a GPU, Chromium falls back to SwiftShader behind ANGLE. That still works, just slowly (see the timings below). Do not use WebGPU.

## Rendering

### 4K master, per composition

```bash
npx remotion render src/index.ts WindFarmHologram-Blue         out/WindFarmHologram_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts WindFarmHologram-Green        out/WindFarmHologram_Green.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts PrismDispersion-Dark          out/PrismDispersion_Dark.mp4          --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts MagneticTorus-PinkViolet      out/MagneticTorus_PinkViolet.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts BarMagnets-Attract            out/BarMagnets_Attract.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts BarMagnets-Repel              out/BarMagnets_Repel.mp4              --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts ElectricField-OppositeCharges out/ElectricField_OppositeCharges.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts ElectricField-LikeCharges     out/ElectricField_LikeCharges.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

For a ProRes master, add `--codec=prores --prores-profile=4444` and drop `--crf` and `--pixel-format`.

### 720p preview (as delivered)

```bash
npx remotion render src/index.ts <id> out/<name>.mp4 --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

`scripts/render-previews.sh` renders all eight previews and a PNG still of each.

### 6K still (6000×3375)

```bash
npx remotion still src/index.ts WindFarmHologram-Blue out/WindFarmHologram_Blue_6K.png --frame=150 --scale=1.5625 --gl=angle
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. Every look draws at the device scale, so the still is rendered natively at 6K, not upscaled.

## How it works

- `src/lib/LookCanvas.tsx` hosts each look inside `<ThreeCanvas>`. The look itself is plain imperative three.js. R3F's `useFrame(…, 1)` serves only as the render hook, which takes over from R3F's automatic render. The frame number comes from `useCurrentFrame()`. Nothing uses R3F's clock.
- `src/lib/post.ts` is the post chain:
  1. HDR (half-float, 4× MSAA) scene target.
  2. Optional depth-of-field gather pass (wind farm only).
  3. 13-tap downsample / tent upsample bloom.
  4. Final pass: vignette, a soft shoulder, sRGB, grain, then ±1/255 triangular dither.
- `src/lib/ribbon.ts` draws thin lines as screen-space ribbons. Widths are given in 4K pixels and are analytically anti-aliased by pixel coverage, so thin lines don't crawl at 720p.
- `src/lib/fieldlines.ts` provides the RK4 field-line tracer and the field models.
- `src/lib/spectrum.ts` provides wavelength → RGB (the CIE 1931 analytic fit of Wyman et al. 2013) and the Cauchy index of refraction.

### Determinism

- Every value on screen is a pure function of `frame % 600`.
- Random numbers come from `mulberry32`, seeded at scene build time and never at render time. There is no `Math.random()`, `Date.now()`, R3F clock, or state carried between frames.
- Field lines are computed once, because the sources don't move. Only dots and pulses move, as functions of the frame.
- Prism beams are re-traced from each frame's pose.
- Grain is a PCG hash of (pixel x, pixel y, `frame % 600`).
- There is no TAA. DoF and bloom are single-frame passes.
- The font (`delayRender`) is loaded before the canvas mounts. The world map is imported as JSON at bundle time.

### Seamless loops

- All motion is built from whole cycles per 600 frames:
  - rotor turns are multiples of 120°;
  - the torus turns 360°/24 × 4;
  - the prism tumbles one full turn, with a wobble of two whole cycles;
  - dot, bead, spark, pulse and particle trips are whole numbers per loop;
  - the camera laps are closed.
- On top of that, every time input is `frame % 600`, so frame 600 is literally the same input as frame 0.

## Physics notes

- **Electric field (5A/5B).** Coulomb field of two equal point charges, with E ∝ Σ q r̂ / r².
  - 20 seeds are spaced evenly around each + charge and integrated with RK4 along the unit field direction.
  - Lines are followed far outside the frame (to r = 40), so a line that sweeps off-screen comes back in and ends on the − charge.
  - The lines that come in from infinity to the − charge (including its outer axis line) are traced backward from it.
  - 5B seeds are offset by half a step so no line runs straight into the neutral point, where E = 0.
  - Particles and pulses move along the field (+ → −, or outward in 5B).
- **Magnetic torus (3).** The dipole is a small current loop (radius 0.2, moment +y), with B from Biot–Savart summed over 96 segments.
  - Seeds sit on rings inside the loop, in the equatorial plane, at three radii. Each radius is found by bisection so the loop's outer equatorial radius is 1.0, 0.74 or 0.5.
  - Each loop is integrated with RK4 until it comes back up through the core. 24 azimuths × 3 radii gives 72 closed loops. The loops are colored by height.
- **Bar magnets (4A/4B).** Each magnet is two magnetic charges, + at the N face and − at the S face.
  - Each face charge is spread over the face width (7 sub-charges), so facing poles give the near-parallel gap field of flat faces rather than a point fan.
  - In the plane through the pole charges, B has no vertical component, so lines traced in that plane are exact. They are drawn lying on the table, like iron filings.
  - 16 seeds per N face sit on a thin ellipse around the face, at equal steps of **magnetic flux** through it (Gauss's law). Each line therefore carries the same flux, and line density follows field strength. This is why facing opposite poles show a dense, straight bundle across the gap.
  - Lines are also traced backward from each S face (seeded the same way) and kept only if they come in from outside the diagram.
  - The diagram is bounded to an oval around the magnets. A line leaving the oval ends there with a short fade, as in a textbook figure.
  - Dots move N → S at a speed proportional to √|B|.
- **Prism (2).** The beam is traced every frame from the prism's pose. It is a white beam split into 7 parallel sub-rays across its width, × 24 wavelengths (400–700 nm). For each one:
  1. Refract at the entry face (vector Snell).
  2. At the next face, split by the unpolarised Fresnel equations into a transmitted ray and an internally reflected ray (total internal reflection where Snell has no solution).
  3. Follow the reflected ray through one internal bounce to its exit.
  - The entry face also reflects a white beam. Its Fresnel strength is drawn 4× brighter so it reads on screen.
  - Index of refraction: Cauchy n(λ) = A + B/λ², with A = 1.50 and **B = 0.021 µm², about 5× crown glass (BK7 ≈ 0.0042)**. **The dispersion is deliberately exaggerated** so the rainbow fan is wide, as in the reference. Real glass spreads the spectrum over only a few degrees.
  - Transmission goes to zero continuously at the critical angle, so a beam that switches off by total internal reflection fades rather than pops.
  - A path that enters face A, reflects off face B and leaves through face C is optically a parallel plate in an equilateral prism: C mirrored in B is parallel to A. Such beams leave essentially white, at the mirror angle. This is correct, not a bug.

## Banding

Each look's final pass applies ±1/255 triangular dither and position-and-frame grain:

| Look | Grain amount |
|---|---|
| Wind farm, torus | 1.5 % |
| Prism, electric field | 1.5 %, faded to 0 below 3 % luminance |
| Bar magnets | 1 % |

See the measured results below; they were taken from the encoded mp4 files.

## Adding a colourway

Add one row to `src/variants.ts`, for example:

```ts
{ id: "WindFarmHologram-Amber", factory: createWindFarm({ bgBottom: "#2A1606", bgTop: "#5A3A0E", dots: "#FFD08A", glow: "#FF9A5A" }) },
```

- The torus takes `{ top, bottom, bg }`.
- Magnets and charges take their arrangement (`attract`, `charges`).
- Colours for those two are constants at the top of their look files.

The new id appears in the Studio and is renderable straight away.

## Licences

- **Font:** Blinker SemiBold by the Blinker Project Authors, under the SIL Open Font License 1.1 (`public/fonts/OFL.txt`).
- **Map data:** `world-atlas` `land-110m.json` (ISC licence, © Mike Bostock), derived from Natural Earth 1:110m land, which is in the public domain. It is rasterised in code into a dot grid.
- three.js (MIT), Remotion (Remotion licence: free for individuals and small companies; larger companies need a company licence; see remotion.dev/license).
- There are no logos or brand marks. The only text is N, S, + and −.

## Measured results

The environment was a 4-vCPU cloud container with **no GPU**, so WebGL2 ran through ANGLE → SwiftShader (software). On a GPU machine expect much faster renders; I could not measure that here.

### Render time per frame, 720p previews

The previews were rendered at `--scale=0.3333333333333333 --concurrency=2`. The figure is wall time ÷ 600 frames. Concurrency 4 was no faster, because software GL already uses all cores.

| Composition | s / frame (720p) | Est. s / frame (4K) | Est. 4K render (600 frames) |
|---|---|---|---|
| WindFarmHologram-Blue | 1.08 | **9.8 (measured)** | ~1 h 40 min |
| WindFarmHologram-Green | 1.08 | ~9.8 | ~1 h 40 min |
| PrismDispersion-Dark | 1.46 | **13.0 (measured)** | ~2 h 10 min |
| MagneticTorus-PinkViolet | 0.73 | ~6.6 | ~1 h 05 min |
| BarMagnets-Attract | 0.45 | ~4.0 | ~40 min |
| BarMagnets-Repel | 0.48 | ~4.3 | ~43 min |
| ElectricField-OppositeCharges | 0.67 | ~6.0 | ~1 h |
| ElectricField-LikeCharges | 0.77 | ~6.9 | ~1 h 10 min |

How the 4K numbers were obtained:
- The two **measured** 4K frames are frame 300 of 1A (60,000 ground dots, 4 turbines, depth of field, bloom) and of 2 (traced beams and bloom), at 3840×2160 with concurrency 1.
- Each was measured as (time for 4 frames − time for 1 frame) ÷ 3, which removes browser start-up.
- The other 4K estimates scale each look's 720p figure by the measured ratio of about 9×.
- **The whole set at 4K comes to about 10 hours on this CPU-only container.** With a GPU and `--gl=angle`, expect a large speedup.

### Verification

| Check | Result |
|---|---|
| 1. File checks (ffprobe) | All 8 pass: 1280×720, 30/1, 20.0 s, 600 frames, h264, yuv420p, one video stream, no audio. |
| 2. Seamless loop | All 8: frame 0 and frame 600 (601-frame composition via `--props='{"loopCheck":true}'`) are pixel-identical (max diff 0). On lossless PNGs, the 599→0 step equals a normal frame step (for example 3.72 vs 3.72 for 1A), so the motion is continuous across the wrap and not only equal at the endpoints. |
| 3. Determinism | All 8: frame 300 from a cold `remotion still` and frame 300 from a multi-frame, 2-thread `remotion render --sequence` are byte-identical (same SHA-256 of the PNG). |
| 4. Banding (encoded mp4) | Frames decoded from the mp4s, with crops contrast-stretched to their full range (`scripts/banding_crops.py`). Every region shows a smooth, grain-dithered ramp with no steps, and the longest constant run in a 16-row-averaged profile is 1–4 rows. Regions: 1A/1B sky gradient and violet bloom, prism beam edge, torus indigo background, magnet shadow on white, e-field glow on black. Grain stayed at the planned 1.5 % (1 % on white); no increase was needed. |
| 5. Content | Contact sheets (`out/analysis/*_sheet.png`) checked for every composition. The only text is N, S, + and −. There are no logos. |
| 6. Motion | Mean absolute difference between consecutive frames, frames 270–330, shows no spikes in any composition, so nothing pops. Total internal reflection fades out through the Fresnel transmission, which goes to 0 at the critical angle. Thin lines are coverage-anti-aliased screen-space ribbons. Rotor speeds are 3–4 revolutions per 20 s (about 2° per frame), so there is no strobing. |

`scripts/loop-check.sh` and `scripts/analyze.py` rerun these checks.

## Completion checklist

- [x] 8 compositions, one data row each, 3840×2160, 30 fps, 600 frames
- [x] three.js in `@remotion/three` on WebGL2 (`--gl=angle`); no WebGPU; no MCP; no PixiJS
- [x] Field lines integrated with RK4 from physical fields; prism beams traced per wavelength with Snell and Fresnel
- [x] Deterministic: no `Math.random()` at render time, no clocks, no TAA, single-frame post
- [x] Seamless 20 s loops (pixel-identical 0/600)
- [x] Dither (±1/255) and frame-hashed grain in every final pass; banding checked on the encoded mp4
- [x] OFL font only (Blinker SemiBold, licence included); world-atlas / Natural Earth note included
- [x] 720p previews and stills; 4K and 6K commands documented

