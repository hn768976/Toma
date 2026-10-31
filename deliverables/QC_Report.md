# Quality-control report

**Date:** 2026-10-31
**Scope:** two Remotion compositions, each with two versions, rendered as 4K masters and delivered as 1080p.

## Deliverables

| # | File | Description |
|---|------|-------------|
| 1 | `Comp1_V1_PlasmaOrb_Match_1080p.mp4` | Composition 1, V1: cyan plasma orb, matches reference A |
| 2 | `Comp1_V2_PlasmaOrb_Orbit_1080p.mp4` | Composition 1, V2: alternative **camera movement** (115° orbit, rise and push-in) |
| 3 | `Comp2_V1_LightTrails_Gold_1080p.mp4` | Composition 2, V1: gold light-painting trails, matches reference B |
| 4 | `Comp2_V2_LightTrails_Violet_1080p.mp4` | Composition 2, V2: alternative **colour palette** (neon violet / magenta) |
| 5 | `Comp1_PlasmaOrb_4K_Project.zip` | Remotion project with both 3840×2160 compositions (Three.js + WebGL 2 shaders) |
| 5 | `Comp2_LightTrails_4K_Project.zip` | Remotion project with both 3840×2160 compositions (Canvas 2D + SVG colour-ramp filter) |

Each project was scaffolded with the Remotion CLI (`npx create-video --blank`). See each project's `README.md` for its commands.

## 1. Render, format and timing

`qc/qc_check.py` checks every file with ffprobe and a full ffmpeg decode. Raw output is in `qc/qc_results_1080p.json`.

| File | Codec / profile | Resolution | FPS (r / avg) | Frames | Duration | Reference | Audio | Result |
|------|-----------------|------------|---------------|--------|----------|-----------|-------|--------|
| Comp1 V1 | H.264 High, yuv420p | 1920×1080 | 30/1 / 30/1 | 240 | 8.000 s | 240 f / 8.000 s | none (ref has none) | PASS |
| Comp1 V2 | H.264 High, yuv420p | 1920×1080 | 30/1 / 30/1 | 240 | 8.000 s | 240 f / 8.000 s | none | PASS |
| Comp2 V1 | H.264 High, yuv420p | 1920×1080 | 30/1 / 30/1 | 250 | 8.333 s | 250 f / 8.333 s | none (ref has none) | PASS |
| Comp2 V2 | H.264 High, yuv420p | 1920×1080 | 30/1 / 30/1 | 250 | 8.333 s | 250 f / 8.333 s | none | PASS |

- **Colour:** all files are BT.709 limited range with full colour tags, and use `+faststart`. The 4K masters are full-range BT.601, so they are converted through an RGB intermediate. Against a ground-truth 4K still the result is 47 dB PSNR, so there is no colour shift.
- **4K masters:** all four composition masters rendered at 3840×2160 with the same frame counts and durations.

## 2. Frame integrity

All four files pass every check:

- **Decode:** a full decode with `ffmpeg -xerror` reports no errors.
- **Black frames:** none (no frame whose peak luma stays near black).
- **Frozen or duplicated frames:** none.
- **Flicker:** no frame-to-frame luma jump above 12× the clip median. The largest jumps (5.6 and 4.8 in Comp2) are the intentional light-streak flashes, which the reference also has.
- **Missing assets or render errors:** none. Everything is procedural; there are no external media, fonts or network assets.

## 3. Match to the references (V1)

All values are measured at 768×432 to match the reference resolution.

| Metric | Ref A | Comp1 V1 | Ref B | Comp2 V1 |
|--------|-------|----------|-------|----------|
| Mean luma | 9.8 | 11.7 | 17.0 | 15.7 |
| Bright-area % (luma > 60) | 5.67 | 5.93 | 8.08 | 7.47 |
| Mean frame-to-frame change | 0.45 | 0.38 | 11.57 | 9.72 |
| Per-frame luma std ("breathing" / flashes) | 1.25 | 1.31 | 5.19 | 2.42 |
| Loop seam (last→first jump ÷ normal step) | 1.65 | 1.00 | 0.75 | 1.06 |
| Median hue of lit pixels | 201° | 199° | 30° | 32° |

**Independent verification.** A separate review agent compared each output with its reference side by side, frame by frame, plus objective statistics. It ran twice.

- **First pass** found real problems, and all were fixed:
  - Comp2's trails moved about 5.6× too slowly and were curly instead of jagged.
  - Comp1 looked like grainy speckle and had no hot core, no brightness pulse and slightly lifted blacks.
  - Neither clip looped seamlessly, though both references do.
- **Second pass:**
  - Comp1 V1 rated **good**: wispy filaments, hot core, matching pulse, true black, seamless loop.
  - Comp2 V1 rated **acceptable**. Its one remaining issue, flat "bar"-shaped light streaks, was then fixed with tapered streaks that have white-hot cores, and the trail flow was shifted to match the reference's left-to-right bias.

**Known minor differences:**

- **Comp1 V1:** the brightest highlights are slightly whiter than the reference's.
- **Comp1 V1:** faint 8-bit banding rings in the halo, visible only with brightness boosted about 12×.
- **Comp2 V1:** fewer large global brightness swings than the reference (luma std 2.4 against 5.2).

## 4. Version 2 alternatives

- **Comp1 V2, camera movement.** The camera orbits about 115°, rises and pushes in from a wide shot (orb small) to a close-up (glow fills the frame). Dust parallax shows the orb's 3D volume.
  - The palette is unchanged: lit-pixel hue is 200°, against 199° for V1.
  - The orb's bright area grows from about 3% to about 20% of the frame.
  - Luma ramps smoothly with no jumps (largest step 0.79).
  - It intentionally does not loop, since the move travels.
- **Comp2 V2, colour palette.** The gold palette becomes neon violet/magenta: lit-pixel hue is 279°, against 32° for V1.
  - Motion, timing and composition are identical to V1, so it is the same light painting in a new colour.
  - It is about 25% lower in luma because violet is perceptually darker. This is expected.

The reviewer confirmed both alternatives are clearly distinguishable and keep the original concept and quality.

## 5. Project ZIP integrity and reproducibility

| Check | Comp1 ZIP | Comp2 ZIP |
|-------|-----------|-----------|
| `unzip -t` integrity | OK | OK |
| Contents | `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint/Prettier config, `README.md`, full `src/` | same |
| Compositions listed by `npx remotion compositions` | `PlasmaOrb-V1-Match`, `PlasmaOrb-V2-Orbit`, both 3840×2160, 30 fps, 240 f | `LightTrails-V1-Gold`, `LightTrails-V2-Violet`, both 3840×2160, 30 fps, 250 f |
| Fresh extract → `npm ci` | OK | OK |
| `npm run lint` (ESLint + tsc) | OK | OK |
| `npm run render:all` (4K masters + 1080p) | OK (3640 s on a 4-core CPU with no GPU) | OK (317 s) |
| Clean-render 1080p files identical to the delivered files | **byte-identical (MD5 match)** | **byte-identical (MD5 match)** |

`node_modules` and render outputs are left out of the ZIPs on purpose; `npm ci` restores the exact locked dependency versions. Comp1 uses WebGL 2 through SwiftShader (`--gl=swangle`) so it renders without a GPU; on a GPU machine, `--gl=angle` is much faster.

**Overall result: PASS.** All four videos and both project ZIPs were validated for delivery.
