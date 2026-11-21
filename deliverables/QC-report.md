# QC report – two references → four videos

## Summary

| # | File | Composition | Size | Frames | Duration | Result |
|---|---|---|---|---|---|---|
| 1 | `01-V1-hazard-barrels.mp4` | `V1-hazard-barrels` | 1920×1080, H.264, yuv420p, 30 fps | 250 | 8.333 s | all technical checks pass |
| 2 | `02-V2-hazard-barrels.mp4` | `V2-hazard-barrels` (palette) | same | 250 | 8.333 s | all technical checks pass |
| 3 | `03-V1-memory-chips.mp4` | `V1-memory-chips` | same | 450 | 15.000 s | all technical checks pass |
| 4 | `04-V2-memory-chips.mp4` | `V2-memory-chips` (camera angle) | same | 450 | 15.000 s | all technical checks pass |

Also delivered: `hazard-barrels-project.zip`, `memory-chips-project.zip` (4K compositions, source, lockfile, config, assets, README) and the images under `qc/`.

What to know before reading the detail:

- **Technical checks all pass** for the four videos (specs, duration, decode, frame scan, determinism, banding, ZIP test).
- **The look targets are only partly met.** On the five frames measured per video, 90 of 125 measures are within ±10% for barrels V1 and 87 of 125 for chips V1. The measures that miss are listed in section 2 and under each look table; three of them (grain, glow falloff, detail) cannot be met for structural reasons explained there.
- **The Version 1 videos are close, not identical.** After the three allowed review rounds each, a final independent comparison still lists differences (section 3B and section 6). The main ones: both renders are crisper than the soft 898×506 previews; the barrels' paint reads slightly greener with softer highlight streaks; the chips' leads read flatter and the table more matte than the reference.
- **Both Version 2 reviews answered yes** to "is the change clearly visible" and "is everything else the same concept and quality".
- The `Inputs` block of the brief still held its placeholders, so the short names `hazard-barrels` and `memory-chips` were chosen from the content of the clips.
- Remotion's own browser download is blocked in the build environment; renders used the pre-installed headless Chrome (Chrome for Testing 157) with ANGLE on software GL. The config only points at that browser when the file exists.

## 1. Reference analysis (step 2)

The `Inputs` block of the brief still held its placeholders, so short names were chosen from the content:

| | Reference file | Short name |
|---|---|---|
| A | `935b2fca-3965626265-preview.mp4` | `hazard-barrels` |
| B | `e5a430d1-4129653725-preview.mp4` | `memory-chips` |

Both clips are 898×506, H.264, 29.97 fps (30000/1001), no audio, with a stock-agency watermark (ignored and masked out of every measurement).

### Reference A – hazard-barrels

- **Duration:** 8.341667 s (ffprobe), 250 frames at 29.97 fps. `round(8.341667 × 30) = 250` frames at 30 fps = 8.333 s; difference 0.0083 s (a quarter of a frame).
- **2D or 3D:** 3D. The camera cranes up past stacked cylinders with perspective convergence, parallax between near and far stacks, depth of field and a specular highlight that depends on the view angle. None of that survives a 2D treatment.
- **Loop:** no. The first frame is mid-stack, the last reveals the sky above the stacks.
- **What it shows:** stacks of yellow steel drums, each with two rolling hoops, hazard-stripe bands at both rims, the words RADIOACTIVE WASTE and a trefoil warning triangle. A hero stack sits left of centre, one lit stack to its left, and a row of stacks recedes to the right into shadow. Sampled colours: lit paint `#b9b176`–`#a39d60`, highlight streak `#cac8ba`, shadowed paint `#1a2213`–`#31361b`, markings near `#10161c`, sky `#0d6b7d`.
- **Motion and timing:** one continuous, constant-speed vertical crane of about 1.1 m (measured from drum joints: y = 215 px at frame 1, 60 px at frame 125 for the next joint, 335 px at frame 250). The camera is tilted up about 22° with no visible roll or pan. 0–8.3 s: steady rise; in the last second the tops of the far stacks and the sky enter at the top corners.
- **Light:** a low, warm, soft key from camera-left (about 52° off the lens axis), giving a broad terminator about three-quarters of the way across each drum and a tall, soft, near-white vertical highlight on the left of each lit drum. Fill is weak and cool-green; the right-hand row sits in the hero stack's shadow at about 15% luminance. Warm light bounces from the hero stack onto the stack to its left.
- **Atmosphere:** no visible fog, dust or rays. Depth fades into darkness and blur rather than haze. Blacks are lifted (p1 ≈ 0.043).
- **Texture:** glossy enamel paint with slight dents that wobble the highlight, light scuffing; no visible film grain (flat-area high-pass std ≈ 0.2/255, i.e. compression residue). The clip is soft overall (small preview, motion blur, shallow focus on the hero stack).
- **Text and symbols:** the wording is generic and the trefoil is the standard public hazard symbol, so both were reproduced. No logos or brands are present.
- **Technology:** three.js through `@remotion/three` (WebGL 2, ANGLE), with pmndrs `postprocessing` for depth of field and bloom, plus two small custom passes (camera motion blur; exposure, ACES tone mapping, grade, grain and dither). Drum textures are drawn procedurally on canvas (2D) with a bundled open-licence font. Chosen because the shot needs a real perspective camera, PBR gloss, shadows and depth of field.
- **Version 2 choice:** **palette** (turquoise drums, cream markings, amber dusk sky). The shot is one simple move over a single-colour subject, so colour carries the mood; a palette swap is obvious at a glance while layout, light, gloss, focus and motion stay identical.

### Reference B – memory-chips

- **Duration:** 15.015 s (ffprobe), 450 frames at 29.97 fps. `round(15.015 × 30) = 450` frames at 30 fps = 15.000 s; difference 0.015 s (under half a frame).
- **2D or 3D:** 3D. The camera glides along a circuit board at a three-quarter angle with strong perspective, parallax between the board and the raised chips, depth of field front and back, and soft cast shadows.
- **Loop:** no. It starts at one end of the module and ends at the other.
- **What it shows:** a memory module (teal board, seven dark memory chips with fine silver pins on two edges, a column of small parts, a gold contact strip with a keying slot, notches and a hole at each end) lying on a satin grey table, surrounded by loose chips: two long two-row packages and a small eight-pin one near the start, a large square flat-pack with gull-wing leads and a square package with side contacts near the end. Sampled colours: table `#b7c0c4` (bright side) to `#516470` (dark side), board `#173439` (dark teal, brighter where lit), chip tops `#4f626e`, large package top `#2f4653`, leads `#b1bcc0`, gold `#e3cfb4`, package sides and shadow cores near black.
- **Motion and timing:** one continuous glide of about 83 mm along the board at constant speed over the full 15 s. Vanishing-point measurements show the camera looking down about 37° at the start and about 46° from the middle onward, with the heading 7–10° off the board's axis. Parts enter at the top and leave at the bottom; the keying slot crosses the frame from y = 62 px (frame 1) to y = 395 px (frame 300).
- **Light:** a large, cool, soft source from behind and to the right, so shadows fall towards the camera and to the left with wide penumbrae and dense contact cores. The table is near-neutral and bright on the right and falls off to a darker blue-grey on the left. Faces towards the camera go almost black.
- **Atmosphere:** clean studio; no fog, dust or rays. Depth is carried by a shallow focus band (front and back strongly blurred).
- **Texture:** matte moulded plastic with a soft sheen and faint laser marking, satin table, glossy solder mask with faint traces; no visible grain (≈ 0.1/255).
- **Text, logos:** only illegible etched codes on the chips; these were replaced with made-up dot-matrix glyphs. No brands are present.
- **Technology:** the same three.js pipeline as A. Everything is modelled from primitives, extrusions and instanced meshes; the board and chip textures are procedural canvas drawings. No external assets.
- **Version 2 choice:** **camera angle** (a plan view from almost straight above, board square to the frame). The subject is a flat layout, so the viewing angle changes the picture more than anything else, while palette, light and travel stay identical.

## 2. Look development (step 4A)

`scripts/measure-look.py` (in both projects) measures, on a frame resized to 898 px wide: luminance percentiles, share of pixels above 90% and below 5%, mean saturation and the hue of shadows / midtones / highlights, glow falloff from the brightest element (radius to 50 / 25 / 10%), contrast (p95 − p5) in the top / middle / bottom thirds and in a "near" and a "far" area, grain (high-pass standard deviation of the flattest patch), detail (Laplacian variance) and the corner-to-centre brightness ratio. The stock watermark rectangle is masked out of every measure. `scripts/compare-look.py` applies the targets: within ±10% of the reference (hue within ±10°), with a small absolute floor for values near zero.

Each project has a `LookDev` composition that renders the three key moments (start, middle, end) as stills; `scripts/lookdev.sh` renders them and prints the comparison. The look was tuned in the order exposure and tone mapping → light → atmosphere → glow → surface → lens, and every setting lives in `src/look.ts`.

Three measures cannot land inside ±10% for structural reasons and are reported as misses rather than hidden:

- **grain:** the brief requires a ±1/255 dither in the final pass. On its own that dither measures about 0.3/255 after downscaling, which is already above the 0.1–0.2/255 left in the compressed reference previews. No film grain was added to the chips; the barrels carry a very small amount.
- **glow falloff:** neither reference has a glow; the measure follows whichever small highlight is brightest in a frame, so it swings with composition.
- **detail (Laplacian):** the references are 898×506 previews softened by compression. The renders keep more real detail in focus and were not blurred down to match.

### hazard-barrels: look-dev stills against the reference

Side-by-side images (reference | ours | difference ×2): `hazard-barrels/lookdev/compare-start.png`, `compare-middle.png`, `compare-end.png` (copied to `qc/lookdev/hazard-barrels-compare-*.png` next to this report).

| measure | start: ref | ours | diff | middle: ref | ours | diff | end: ref | ours | diff |
|---|---|---|---|---|---|---|---|---|---|
| lum_p1 | 0.043 | 0.044 | +3.6% | 0.044 | 0.048 | +10.3% | 0.041 | 0.045 | +10.3% |
| lum_p5 | 0.073 | 0.083 | +14.7% | 0.071 | 0.085 | +19.3% | 0.073 | 0.085 | +16.6% |
| lum_p50 | 0.188 | 0.176 | -6.5% | 0.185 | 0.177 | -4.1% | 0.185 | 0.180 | -2.6% |
| lum_p95 | 0.679 | 0.713 | +4.9% | 0.679 | 0.739 | +8.8% | 0.683 | 0.741 | +8.4% |
| lum_p99 | 0.837 | 0.889 | +6.2% | 0.798 | 0.900 | +12.8% ✗ | 0.844 | 0.893 | +5.7% |
| lum_mean | 0.304 | 0.277 | -9.0% | 0.300 | 0.285 | -5.2% | 0.308 | 0.290 | -5.6% |
| pct_above_90 | 0.120 | 0.789 | +557.5% | 0.027 | 1.011 | +3663.0% | 0.091 | 0.870 | +851.6% |
| pct_below_05 | 1.716 | 1.447 | -15.7% | 1.792 | 1.180 | -34.2% | 1.861 | 1.324 | -28.9% |
| sat_mean | 0.511 | 0.497 | -2.8% | 0.510 | 0.495 | -3.0% | 0.507 | 0.502 | -1.1% |
| hue_shadows | 97.354 | 89.756 | -7.6 deg | 98.760 | 89.953 | -8.8 deg | 98.533 | 91.470 | -7.1 deg |
| hue_midtones | 64.595 | 79.143 | +14.5 deg ✗ | 65.615 | 78.756 | +13.1 deg ✗ | 67.680 | 81.056 | +13.4 deg ✗ |
| hue_highlights | 53.777 | 51.626 | -2.2 deg | 53.803 | 51.923 | -1.9 deg | 53.598 | 52.190 | -1.4 deg |
| glow_r50_pct_w | 12.361 | 8.129 | -34.2% ✗ | 11.136 | 9.020 | -19.0% ✗ | 11.804 | 8.352 | -29.2% ✗ |
| glow_r25_pct_w | 28.619 | 13.808 | -51.8% ✗ | 23.274 | 12.138 | -47.8% ✗ | 25.947 | 17.038 | -34.3% ✗ |
| glow_r10_pct_w | 32.851 | 20.156 | -38.6% ✗ | 36.860 | 46.882 | +27.2% ✗ | 34.076 | 36.303 | +6.5% |
| contrast_top | 0.596 | 0.654 | +9.8% | 0.593 | 0.648 | +9.4% | 0.600 | 0.653 | +8.9% |
| contrast_mid | 0.616 | 0.656 | +6.4% | 0.637 | 0.697 | +9.4% | 0.630 | 0.674 | +7.0% |
| contrast_bottom | 0.596 | 0.558 | -6.4% | 0.596 | 0.616 | +3.4% | 0.608 | 0.635 | +4.4% |
| contrast_near | 0.626 | 0.738 | +17.9% ✗ | 0.614 | 0.753 | +22.7% ✗ | 0.638 | 0.743 | +16.5% ✗ |
| contrast_far | 0.127 | 0.116 | -8.3% | 0.119 | 0.122 | +2.1% | 0.118 | 0.127 | +7.4% |
| lum_near | 0.494 | 0.459 | -7.2% | 0.490 | 0.468 | -4.4% | 0.498 | 0.468 | -6.1% |
| lum_far | 0.146 | 0.155 | +5.7% | 0.144 | 0.154 | +7.1% | 0.147 | 0.161 | +9.1% |
| grain_std_255 | 0.237 | 0.328 | +38.5% | 0.217 | 0.346 | +59.1% | 0.204 | 0.349 | +70.7% |
| laplacian_var | 116.993 | 69.615 | -40.5% ✗ | 79.799 | 65.934 | -17.4% ✗ | 63.297 | 59.693 | -5.7% |
| vignette_ratio | 1.108 | 1.171 | +5.7% | 1.109 | 1.266 | +14.1% ✗ | 1.122 | 1.198 | +6.7% |

Within target: start 19/25 within target; middle 17/25 within target; end 21/25 within target. ✗ marks a value outside target: ±10% (hue ±10°), or, for quantities close to zero, a small absolute floor (0.015 for luminance levels, 1 percentage point for the pixel shares), which is why a few large percentages on tiny values carry no mark.

**Independent look checks (fresh sub-agent each round, shown only the three pairs):**

- Round 1 – asked for more saturated paint, cooler darker shadows, glossier highlights, a warm far-left drum, less scratch texture, more background blur, bloom on highlights, darker markings. Fixed: paint colour, fill lowered, enamel index of refraction and clearcoat added, scratches cut, depth of field strengthened, bloom threshold lowered, ink darkened, haze reduced.
- Round 2 – still no full-height specular streaks; shadows read olive not cool; blacks crushed; background labels too dark. Fixed: the key light was rebuilt as a tall strip (with the camera tilted up, a single sun only mirrors into part of each drum), black level lifted, haze returned at low density, sky colour corrected.
- Round 3 – streaks should be tighter and brighter, shadows less green, a little grain and wear. Fixed: tighter clearcoat lobe, shadow tint moved off green, fill colour separated from the visible sky colour so the shadow side sits at the measured olive hue.
- Not followed: the reviewers' repeated request for teal shadows. The measured shadow hue of the reference is about 98° (olive green) at saturation 0.49, and region averages agree, so shadows were kept there.

After the visual-match rounds on the video (section 3B) the stills were re-measured; the table above is the final state.

### memory-chips: look-dev stills against the reference

Side-by-side images (reference | ours | difference ×2): `memory-chips/lookdev/compare-start.png`, `compare-middle.png`, `compare-end.png` (copied to `qc/lookdev/memory-chips-compare-*.png` next to this report).

| measure | start: ref | ours | diff | middle: ref | ours | diff | end: ref | ours | diff |
|---|---|---|---|---|---|---|---|---|---|
| lum_p1 | 0.001 | 0.000 | -100.0% | 0.001 | 0.000 | -100.0% | 0.002 | 0.000 | -100.0% |
| lum_p5 | 0.009 | 0.006 | -37.4% | 0.012 | 0.022 | +83.6% | 0.017 | 0.050 | +188.8% ✗ |
| lum_p50 | 0.446 | 0.436 | -2.3% | 0.376 | 0.405 | +7.7% | 0.426 | 0.471 | +10.7% ✗ |
| lum_p95 | 0.768 | 0.719 | -6.4% | 0.780 | 0.784 | +0.5% | 0.788 | 0.758 | -3.8% |
| lum_p99 | 0.837 | 0.866 | +3.5% | 0.851 | 0.896 | +5.3% | 0.868 | 0.919 | +5.9% |
| lum_mean | 0.437 | 0.426 | -2.7% | 0.398 | 0.404 | +1.6% | 0.443 | 0.446 | +0.5% |
| pct_above_90 | 0.067 | 0.001 | -97.9% | 0.075 | 0.804 | +974.4% | 0.278 | 1.970 | +608.2% ✗ |
| pct_below_05 | 8.636 | 6.921 | -19.9% ✗ | 8.679 | 6.055 | -30.2% ✗ | 6.909 | 4.996 | -27.7% ✗ |
| sat_mean | 0.282 | 0.278 | -1.5% | 0.331 | 0.325 | -1.9% | 0.296 | 0.302 | +2.0% |
| hue_shadows | 205.003 | 206.524 | +1.5 deg | 204.686 | 207.551 | +2.9 deg | 204.492 | 207.140 | +2.6 deg |
| hue_midtones | 200.789 | 201.483 | +0.7 deg | 201.063 | 198.781 | -2.3 deg | 200.825 | 199.077 | -1.7 deg |
| hue_highlights | 193.022 | 202.409 | +9.4 deg | 193.040 | 201.559 | +8.5 deg | 191.544 | 202.172 | +10.6 deg ✗ |
| glow_r50_pct_w | 2.784 | 2.784 | +0.0% | 4.788 | 3.341 | -30.2% ✗ | 0.780 | 2.561 | +228.6% ✗ |
| glow_r25_pct_w | 3.675 | 8.575 | +133.3% ✗ | 8.797 | 8.909 | +1.3% | 1.114 | 11.359 | +920.0% ✗ |
| glow_r10_pct_w | 13.363 | 10.356 | -22.5% ✗ | 10.134 | 26.058 | +157.1% ✗ | 1.670 | 24.165 | +1346.7% ✗ |
| contrast_top | 0.771 | 0.668 | -13.3% ✗ | 0.770 | 0.752 | -2.3% | 0.539 | 0.575 | +6.8% |
| contrast_mid | 0.728 | 0.702 | -3.6% | 0.774 | 0.716 | -7.6% | 0.613 | 0.643 | +4.9% |
| contrast_bottom | 0.613 | 0.607 | -0.9% | 0.708 | 0.730 | +3.0% | 0.777 | 0.762 | -2.0% |
| contrast_near | 0.645 | 0.567 | -12.1% ✗ | 0.682 | 0.600 | -12.0% ✗ | 0.778 | 0.741 | -4.6% |
| contrast_far | 0.701 | 0.570 | -18.7% ✗ | 0.628 | 0.694 | +10.4% ✗ | 0.406 | 0.383 | -5.7% |
| lum_near | 0.548 | 0.471 | -14.0% ✗ | 0.407 | 0.382 | -6.1% | 0.401 | 0.412 | +2.7% |
| lum_far | 0.434 | 0.451 | +4.0% | 0.449 | 0.419 | -6.6% | 0.575 | 0.579 | +0.7% |
| grain_std_255 | 0.096 | 0.327 | +240.9% ✗ | 0.157 | 0.317 | +101.3% ✗ | 0.100 | 0.307 | +208.0% ✗ |
| laplacian_var | 329.628 | 178.292 | -45.9% ✗ | 406.436 | 239.267 | -41.1% ✗ | 399.914 | 223.809 | -44.0% ✗ |
| vignette_ratio | 1.291 | 1.309 | +1.4% | 1.133 | 1.151 | +1.6% | 1.048 | 1.313 | +25.3% ✗ |

Within target: start 16/25 within target; middle 18/25 within target; end 14/25 within target. ✗ marks a value outside target: ±10% (hue ±10°), or, for quantities close to zero, a small absolute floor (0.015 for luminance levels, 1 percentage point for the pixel shares), which is why a few large percentages on tiny values carry no mark.

**Independent look checks (fresh sub-agent each round, shown only the three pairs):**

- Round 1 – shadows long and hard, table too blue and dark, depth of field weak, pins flat grey, chip bodies navy and blotchy, falloff weak, gold too yellow. Fixed: softbox raised and widened, table albedo neutralised, bokeh increased, leads made glossier, chip noise changed to fine grain, cone tightened, gold desaturated.
- Round 2 – too cool and saturated in the bright areas, no dense contact core under parts, chip tops flat, shaded pins black, no bloom, vignette blue and heavy. Fixed: soft contact-shadow decals under every part, glossier plastic for a broad sheen, saturation lowered globally with a blue push in the shadows only (the reference is neutral in highlights and saturated in the darks), bloom threshold lowered, vignette reduced.
- Round 3 – table darker and bluer than the reference, falloff too strong, shadows too dark and crisp, board too dark, fine lead rows dim. Fixed: wider softbox and larger shadow filter, lighter neutral table, brighter board and leads, lighter contact decals.
- Not followed: added grain and an overall softening of the in-focus band (see the note on grain and detail above).

After the visual-match rounds (section 3B) the stills were re-measured; the table above is the final state.

## 3. Verification (step 8)

### A. Technical checks

| # | check | 01-V1-hazard-barrels | 02-V2-hazard-barrels | 03-V1-memory-chips | 04-V2-memory-chips |
|---|---|---|---|---|---|
| 1 | resolution | 1920×1080 – pass | 1920×1080 – pass | 1920×1080 – pass | 1920×1080 – pass |
| 1 | codec / pixel format | h264 / yuv420p – pass | h264 / yuv420p – pass | h264 / yuv420p – pass | h264 / yuv420p – pass |
| 1 | frame rate | 30/1 – pass | 30/1 – pass | 30/1 – pass | 30/1 – pass |
| 1 | frame count | 250 – pass | 250 – pass | 450 – pass | 450 – pass |
| 1 | audio streams | 0 – pass | 0 – pass | 0 – pass | 0 – pass |
| 2 | duration vs reference | 8.333 s (-0.0083 s) – pass | 8.333 s (-0.0083 s) – pass | 15.000 s (-0.0150 s) – pass | 15.000 s (-0.0150 s) – pass |
| 3 | full decode | pass | pass | pass | pass |
| 4 | black frames | 0 (frame mean 70.5–73.1 of 255) – pass | 0 (frame mean 61.3–64.3 of 255) – pass | 0 (frame mean 97.2–112.7 of 255) – pass | 0 (frame mean 88.7–97.9 of 255) – pass |
| 4 | frozen / duplicated frames | 0 (frame-to-frame change 2.73–3.25) – pass | 0 (frame-to-frame change 2.71–3.14) – pass | 0 (frame-to-frame change 1.91–2.74) – pass | 0 (frame-to-frame change 2.10–2.94) – pass |
| 4 | brightness jumps / flicker | largest step 0.142 of 255 – pass | largest step 0.151 of 255 – pass | largest step 0.197 of 255 – pass | largest step 0.185 of 255 – pass |

| # | check | result |
|---|---|---|
| 1 | colour tags | all four streams are tagged BT.709 (matrix, transfer, primaries). The first renders were untagged, which leaves the colour matrix to each player's guess, so `Config.setColorSpace("bt709")` was added and everything re-rendered. |
| 4 | contact sheets (one frame per second) | viewed for all four videos: `qc/0N-…-sheet.png`. No missing or broken elements. |
| 5 | loop | not applicable: neither reference loops (A ends on the sky reveal, B travels from one end of the module to the other). |
| 6 | determinism, hazard-barrels | **pass.** Frame 124 rendered cold with `remotion still` and the same frame from a 7-frame sequence render have identical SHA-256 (`9ff4fdcf…7854e8223`). Against frame 124 decoded from the delivered MP4 the mean absolute difference is 1.42 of 255 (H.264 loss only). |
| 6 | determinism, memory-chips | **pass.** Frame 224: identical SHA-256 (`9003277c…313f8b02c`) for the cold still and the sequence frame; 1.43 of 255 against the delivered MP4. |
| 7 | look over time | measured on 5 frames per video, tables below. Partly within target; see the notes under section 2. |
| 8 | banding and artefacts | **pass.** Dark and soft-gradient regions viewed with contrast stretched ×4 around the local level (`qc/0N-banding-x4.png`): no steps, seams or aliasing. Used luma levels are contiguous (largest gap 1–2 levels). Gradients are rendered in half-float buffers with a ±1/255 dither in the final pass. |
| 9 | ZIP test | **pass**, see section 4. |

Other items from the brief:

- **No `Math.random()`, `useFrame`, `requestAnimationFrame`, `Date.now()`, `useState` or TAA** drives any visual. The scenes are static; the camera, grain, dither and motion blur are functions of `useCurrentFrame()`. Randomness comes from `mulberry32` seeded in `src/config.ts`.
- **Assets behind `delayRender`:** the barrel font loads through `AssetGate`; every frame is additionally held until its WebGL render has been issued. The chips project has no external assets.
- **WebGL 2 with `--gl=angle`**, no WebGPU; no self-clocked animation libraries; no AI-generated or stock imagery; no MCP servers were used.
- **Pinned versions:** every dependency in both `package.json` files is an exact version (remotion 4.0.545, three 0.187.0, @react-three/fiber 9.8.2, postprocessing 6.39.6, react 19.3.1).
- **Backgrounds:** neither reference sits on pure black, green or white, so there is no keyed background to preserve.
- **Audio:** none (the references have no audio stream).

### Look over time (check 7)

`tools/look-table.py` extracts five evenly spaced frames from each delivered MP4, measures them and the same moments of the reference, and counts how many of the five frames are within target for each measure.

For Version 2 the measures its change affects are skipped:

- **02 (palette):** hue and saturation.
- **04 (camera angle):** the measures that depend on what is where in the frame or on which faces are visible – the regional contrasts, near/far levels, glow falloff, vignette, the share of near-black pixels and the two lowest luminance percentiles (from above, the black side faces of the packages are hidden). With nothing skipped, 41 of 125 frame-measures are within target; the plan view is about 12% darker in the mid-tones and more saturated than the three-quarter reference because the table's sheen is view-dependent.

Light, haze and grain stability between frames is covered by the flicker scan in check 4: the largest frame-to-frame change in mean brightness is below 0.2 of 255 in every video, and the frame-to-frame difference stays inside a narrow band with no spikes.

#### 01-V1-hazard-barrels

Frames measured: 0, 62, 124, 186, 249 (reference frames 1, 63, 125, 187, 250)

| measure | reference (mean) | video (mean) | difference | frames within target |
|---|---|---|---|---|
| lum_p1 | 0.043 | 0.040 | -6.8% | 5/5 |
| lum_p5 | 0.072 | 0.078 | +8.3% | 5/5 |
| lum_p50 | 0.186 | 0.172 | -7.2% | 5/5 |
| lum_p95 | 0.681 | 0.727 | +6.7% | 5/5 |
| lum_p99 | 0.829 | 0.889 | +7.3% | 4/5 |
| lum_mean | 0.303 | 0.278 | -8.4% | 4/5 |
| pct_above_90 | 0.053 | 0.738 | +1283.9% | 5/5 |
| pct_below_05 | 1.753 | 1.779 | +1.5% | 5/5 |
| sat_mean | 0.509 | 0.503 | -1.0% | 5/5 |
| hue_shadows | 98.228 | 88.712 | -9.5° | 4/5 |
| hue_midtones | 65.858 | 78.326 | +12.5° | 0/5 |
| hue_highlights | 53.714 | 51.395 | -2.3° | 5/5 |
| glow_r50_pct_w | 11.537 | 8.241 | -28.6% | 0/5 |
| glow_r25_pct_w | 26.860 | 13.964 | -48.0% | 0/5 |
| glow_r10_pct_w | 34.143 | 37.394 | +9.5% | 2/5 |
| contrast_top | 0.596 | 0.648 | +8.7% | 4/5 |
| contrast_mid | 0.627 | 0.681 | +8.6% | 4/5 |
| contrast_bottom | 0.599 | 0.605 | +1.1% | 5/5 |
| contrast_near | 0.639 | 0.748 | +16.9% | 1/5 |
| contrast_far | 0.121 | 0.122 | +0.6% | 5/5 |
| lum_near | 0.492 | 0.458 | -7.0% | 5/5 |
| lum_far | 0.145 | 0.151 | +4.0% | 5/5 |
| grain_std_255 | 0.231 | 0.331 | +43.7% | 2/5 |
| laplacian_var | 85.396 | 67.533 | -20.9% | 1/5 |
| vignette_ratio | 1.102 | 1.194 | +8.4% | 4/5 |

**90/125 frame-measures within target.**

#### 02-V2-hazard-barrels

Frames measured: 0, 62, 124, 186, 249 (reference frames 1, 63, 125, 187, 250)

| measure | reference (mean) | video (mean) | difference | frames within target |
|---|---|---|---|---|
| lum_p1 | 0.043 | 0.044 | +2.9% | 5/5 |
| lum_p5 | 0.072 | 0.078 | +7.3% | 5/5 |
| lum_p50 | 0.186 | 0.149 | -20.0% | 0/5 |
| lum_p95 | 0.681 | 0.710 | +4.3% | 5/5 |
| lum_p99 | 0.829 | 0.887 | +7.0% | 4/5 |
| lum_mean | 0.303 | 0.243 | -20.0% | 0/5 |
| pct_above_90 | 0.053 | 0.716 | +1244.0% | 5/5 |
| pct_below_05 | 1.753 | 1.566 | -10.7% | 5/5 |
| sat_mean | – | – | skipped (changed on purpose in Version 2) | – |
| hue_shadows | – | – | skipped (changed on purpose in Version 2) | – |
| hue_midtones | – | – | skipped (changed on purpose in Version 2) | – |
| hue_highlights | – | – | skipped (changed on purpose in Version 2) | – |
| glow_r50_pct_w | 11.537 | 5.546 | -51.9% | 0/5 |
| glow_r25_pct_w | 26.860 | 12.450 | -53.6% | 0/5 |
| glow_r10_pct_w | 34.143 | 37.016 | +8.4% | 1/5 |
| contrast_top | 0.596 | 0.626 | +5.0% | 5/5 |
| contrast_mid | 0.627 | 0.668 | +6.4% | 5/5 |
| contrast_bottom | 0.599 | 0.589 | -1.7% | 5/5 |
| contrast_near | 0.639 | 0.732 | +14.6% | 1/5 |
| contrast_far | 0.121 | 0.147 | +21.3% | 2/5 |
| lum_near | 0.492 | 0.407 | -17.3% | 0/5 |
| lum_far | 0.145 | 0.126 | -12.8% | 0/5 |
| grain_std_255 | 0.231 | 0.260 | +12.6% | 5/5 |
| laplacian_var | 85.396 | 57.031 | -33.2% | 0/5 |
| vignette_ratio | 1.102 | 1.222 | +10.9% | 3/5 |

**56/105 frame-measures within target.**

#### 03-V1-memory-chips

Frames measured: 0, 112, 224, 336, 449 (reference frames 1, 113, 225, 337, 450)

| measure | reference (mean) | video (mean) | difference | frames within target |
|---|---|---|---|---|
| lum_p1 | 0.001 | 0.000 | -100.0% | 5/5 |
| lum_p5 | 0.012 | 0.021 | +81.0% | 3/5 |
| lum_p50 | 0.400 | 0.419 | +4.7% | 5/5 |
| lum_p95 | 0.779 | 0.753 | -3.4% | 5/5 |
| lum_p99 | 0.853 | 0.890 | +4.3% | 5/5 |
| lum_mean | 0.416 | 0.412 | -0.9% | 5/5 |
| pct_above_90 | 0.143 | 0.670 | +368.4% | 4/5 |
| pct_below_05 | 8.821 | 6.831 | -22.6% | 0/5 |
| sat_mean | 0.313 | 0.314 | +0.5% | 5/5 |
| hue_shadows | 205.789 | 210.449 | +4.7° | 5/5 |
| hue_midtones | 200.788 | 199.957 | -0.8° | 5/5 |
| hue_highlights | 192.525 | 203.819 | +11.3° | 1/5 |
| glow_r50_pct_w | 3.229 | 2.695 | -16.6% | 2/5 |
| glow_r25_pct_w | 8.263 | 9.800 | +18.6% | 2/5 |
| glow_r10_pct_w | 12.428 | 18.619 | +49.8% | 1/5 |
| contrast_top | 0.684 | 0.667 | -2.4% | 4/5 |
| contrast_mid | 0.713 | 0.689 | -3.2% | 5/5 |
| contrast_bottom | 0.702 | 0.671 | -4.3% | 4/5 |
| contrast_near | 0.688 | 0.630 | -8.4% | 2/5 |
| contrast_far | 0.617 | 0.615 | -0.3% | 2/5 |
| lum_near | 0.436 | 0.413 | -5.3% | 4/5 |
| lum_far | 0.464 | 0.461 | -0.6% | 5/5 |
| grain_std_255 | 0.098 | 0.186 | +89.2% | 4/5 |
| laplacian_var | 401.453 | 236.317 | -41.1% | 0/5 |
| vignette_ratio | 1.174 | 1.214 | +3.4% | 4/5 |

**87/125 frame-measures within target.**

#### 04-V2-memory-chips

Frames measured: 0, 112, 224, 336, 449 (reference frames 1, 113, 225, 337, 450)

| measure | reference (mean) | video (mean) | difference | frames within target |
|---|---|---|---|---|
| lum_p1 | – | – | skipped (changed on purpose in Version 2) | – |
| lum_p5 | – | – | skipped (changed on purpose in Version 2) | – |
| lum_p50 | – | – | skipped (changed on purpose in Version 2) | – |
| lum_p95 | 0.779 | 0.680 | -12.7% | 0/5 |
| lum_p99 | 0.853 | 0.789 | -7.6% | 3/5 |
| lum_mean | 0.416 | 0.368 | -11.7% | 2/5 |
| pct_above_90 | 0.143 | 0.129 | -10.0% | 5/5 |
| pct_below_05 | – | – | skipped (changed on purpose in Version 2) | – |
| sat_mean | 0.313 | 0.395 | +26.4% | 0/5 |
| hue_shadows | 205.789 | 205.722 | -0.1° | 5/5 |
| hue_midtones | 200.788 | 198.492 | -2.3° | 5/5 |
| hue_highlights | 192.525 | 203.101 | +10.6° | 2/5 |
| glow_r50_pct_w | – | – | skipped (changed on purpose in Version 2) | – |
| glow_r25_pct_w | – | – | skipped (changed on purpose in Version 2) | – |
| glow_r10_pct_w | – | – | skipped (changed on purpose in Version 2) | – |
| contrast_top | – | – | skipped (changed on purpose in Version 2) | – |
| contrast_mid | – | – | skipped (changed on purpose in Version 2) | – |
| contrast_bottom | – | – | skipped (changed on purpose in Version 2) | – |
| contrast_near | – | – | skipped (changed on purpose in Version 2) | – |
| contrast_far | – | – | skipped (changed on purpose in Version 2) | – |
| lum_near | – | – | skipped (changed on purpose in Version 2) | – |
| lum_far | – | – | skipped (changed on purpose in Version 2) | – |
| grain_std_255 | 0.098 | 0.209 | +112.9% | 4/5 |
| laplacian_var | 401.453 | 322.761 | -19.6% | 1/5 |
| vignette_ratio | – | – | skipped (changed on purpose in Version 2) | – |

**27/50 frame-measures within target.**

### B. Visual match by separate agents (checks 10 and 11)

Each review used a fresh sub-agent that saw only three reference frames and the three frames of the video at the same times, with the instruction from the brief. Reviewer statements were checked against pixel samples before acting; where a claim was not supported by the numbers it is marked.

#### 01-V1-hazard-barrels

> Video 01 (barrels V1), visual match round 1 (on the first full render):
> 1 paint duller and ~15-20% darker, left drum mismatched ochre; 2 specular streaks faint; 3 right-hand drums too dark and green, labels nearly invisible, no brightening towards the end;
> 4 surface too clean; 5 end frame: no drum tops visible, sky only thin slivers; 6 left stack does not lean, no drum visible in the wedge behind; 7 markings thinner, smaller and greyer (text, sign outline, stripes), background drums carry fewer labels;
> 8 hoops too fat, double hoop under the stripes; 9 far drums too blurred, foreground crisper than the reference; 10 nothing to report on particles/glow/empty space.
> Matching: layout and drum widths, stripe curvature, label order, hero label positions at all three times (scroll speed and timing), per-drum label rotation.
> Fixes: ExtraBold font, text 0.29 -> 0.33 m wide, sign outline 6 -> 9.5 mm and larger trefoil, wider stripe bands, markings repeated 3x round each drum;
> hoops and rim beads slimmed; far stacks of the hero row dropped 0.1 m so their tops and the sky show at the end; back rows lean 2.2 deg;
> sky light opens up near the top of the stacks (drums brighten towards the end); clearcoat 0.8 with roughness 0.2 and a wider strip glow for broader near-white streaks;
> DoF bokeh 6.2 -> 4.2; wear increased; back-row warmth eased. The first render was discarded and all four videos re-rendered.

> Video 01 (barrels V1), visual match round 2 (on stills, before re-rendering):
> 1 paint said to be darker/duller (reference estimated at (215,205,60); not confirmed: sampled lit paint is (175,164,85) in the reference and (152-174,143-164,64-90) in ours, streak peak (227,227,226) vs (230,227,215));
> 2 highlights broader and softer than the narrow near-white streaks, right side too bright; 3 grime and smudges missing on the far drums; 4 end frame: sky patch and striped drum top at upper right still missing;
> 5 sky brighter and more turquoise than the reference's deeper blue-teal; 6 the in-between drum behind the left stack is missing, left drum too wide; 7 stripe rows now too tall, rims too chunky;
> 8 too crisp; 9 text slightly too bold/wide, sign slightly too large and thick; 10 gaps greener and less deep.
> Matching: composition and scale, five-column layout, upward perspective taper, camera rise speed and timing, label order and design, sky only at the end.
> Fixes: far stacks dropped 0.3 m (sky patch and lit drum tops at the end); sky colour darker and bluer; left stack moved back and out (lit side and streak in frame) with a 2.6 deg lean,
> one extra stack in the wedge and one lower stack closing the left edge; stripe band 39 -> 31 mm, rim bead 8 -> 6 mm; text 0.33 -> 0.315 m, sign side 255 -> 240 mm, outline 9.5 -> 8 mm;
> soft dirt blotches and more mottling added to the paint; clearcoat roughness 0.2 -> 0.14 and strip glow narrowed for tighter streaks; neighbour shading/bounce made distance-weighted.

> Video 01 (barrels V1), visual match round 3 (on rendered frames):
> 1 paint said to be olive/khaki and darker than the reference's lemon (region averages: hero lit paint (180,173,111) in the reference vs (171,164,110), same hue 54 deg, 5% darker, slightly less saturated);
> 2 left drum dim and greyish (confirmed: saturation 0.34 vs 0.54); 3 streaks narrower and dimmer than the 40-50 px hot streaks; 4 new dirt mottling now too obvious; 5 shadow side too green (confirmed: hue 105-112 vs 82-86);
> 6 too crisp; 7 print lighter on the back drums, tape rows slightly thin; 8 sliver drum between left and hero stacks reads as a dark gap; 9 end frame: sky patch top-left too large, top-right rim plain, sky colour off;
> 10 drums too upright; 11 hoops now too subtle; 12 nothing on particles/empty area.
> Matching: composition, column positions and widths, low-angle perspective, label layout, upward camera move and timing (labels within ~15 px at all three times), sky only at the end.
> Fixes (third and last round for this video): back-row paint warmer and more saturated; fill light warmed so the shadow side sits at an olive hue; saturation 0.80 -> 0.86 and key +4%;
> dirt blotches and mottling halved; the edge-closing stack removed and the left stack shifted so the sliver stack catches the sun; hoop height 7 -> 9 mm; stripe band slightly taller.
> Not fixed: overall softness of the reference (kept sharper on purpose), residual lean of the drums.
>
> Video 01, confirmation on the final render (after the three allowed rounds; no further changes made):
> Remaining differences: paint reads slightly greener and duller than the reference's golden yellow; left-to-right contrast flatter, with the left stack dimmer than the hero stack (in the reference it is as bright);
> streaks broader and softer than the narrow blown-out ones; the sliver stack between left and hero stacks sits in shadow; lettering on side and background drums fainter, background signs ~15% smaller;
> crisper than the soft reference, no grain; less grime on the shadowed drums; sky flatter and more saturated, lid rim at top right plainer; hero markings about 15 px lower at the end; less darkening towards the right edge.
> Matching: drum sizes and positions, upward perspective and band curvature, stripe pattern, label layout, start and middle framing, sky reveal at the end.

#### 02-V2-hazard-barrels

> Video 02 (barrels V2, palette), round 1 (on rendered frames): "Change clearly visible: yes. Everything else same concept and quality: yes."
> Remaining differences against the reference other than palette: flatter left-to-right contrast, weaker streaks, dark gaps between columns, cleaner surfaces, crisper hoops,
> no softness/motion softness, more upright right-hand columns, heavier lettering and thicker sign outline, larger and flatter sky wedges at the end. Timing and label heights match.
> No fix required by the rule for Version 2 (both answers yes); shared improvements made for Version 1 afterwards apply to Version 2 as well.
>
> Video 02, confirmation on the final render: "Change clearly visible: yes. Everything else same concept and quality: yes." Remaining differences against the reference (palette aside): crisper than the soft reference, thinner and dimmer streaks, more even lighting with cleaner darks, less surface wear, less lean, thinner rim lips, slightly lighter lettering. Timing and marking heights match.

#### 03-V1-memory-chips

> Video 03 (chips V1), visual match round 1 (on stills, before the long render):
> 1 chip bodies said to be too light and blue (not confirmed: patch samples match the reference within a few levels, e.g. (71,90,102) vs (69,88,101)); 2 table lighting too flat (reference falls to dark lower-left and corners);
> 3 contact shadows and reflections weak; 4 legs read as dark with white square tips instead of chrome; 5 the long right-hand package too large and exposed at the start; 6 small 8-pin package too flat, 20 px too far left;
> 7 gold contacts paler, fewer and thicker fingers; 8 memory-chip pin rows grey and coarse (reference: bright, fine, dense); 9 column of small parts too large and light; 10 chip markings too legible;
> 11 in-focus area too crisp; 12 an extra partial package at the far left in the middle frame, top-left pins too low at the start; 13 board slightly light, traces too few and bright.
> Matching: camera angle and motion timing at all three frames, module position/size/tilt, notch position, placement of the large flat-pack and right-hand package in the middle and end frames, board hue, amount of empty table.
> Fixes: cone tightened and vignette restored for the lower-left falloff; contact decals darker and wider, softbox lowered; environment given a dim all-round level so metal legs pick up grey reflections;
> right-hand package shortened 52 -> 42 mm with tucked legs; 8-pin package taller and moved 2 mm; gold fingers at 1.0 mm pitch, more orange; pin rows 40 -> 54 per side with their own bright metal;
> side parts smaller and dark; markings at half strength; left package shortened and moved off the frame edge, flat-pack moved 3 mm away; twice as many trace mazes, dimmer traces, darker board.

> Video 03 (chips V1), visual match round 2 (on the first full render):
> 1 contact shadows now too heavy and halo-like; 2 pins pure white and hard (reference: brushed silver-grey, some nearly dark), a row of white dots on the right-hand package;
> 3 memory chips nearly abut, board and traces between them barely visible (reference leaves 20-35 px); 4 board darker and duller, gold paler and brighter than the reference's orange-tan;
> 5 module too wide and more tilted in the middle and end frames (measured: far half 5-10% wider, right edge tilted about twice as much); 6 depth of field weaker;
> 7 8-pin package now a tall black box; 8 side-part column should be a dense double column of tiny grey parts; 9 left packages flatter/blacker, right ones lighter;
> 10 placement offsets of 20-40 px on four packages; 11 table slightly lighter/greener with a flatter gradient; 12 too crisp.
> Matching: composition and camera timing at all three frames, object count and layout, the big package in the middle frame, the module's chip structure and fine pin rows, grey studio floor, amount of empty space.
> Fixes: contact decals 0.9 -> 0.6 with narrower margins; leads dimmer and rougher; pins and pads shortened and chips 14.2 -> 13.4 mm deep so ~3.6 mm of board with brighter traces shows between chips;
> board brighter teal, gold warmer and dimmer; camera distance eased from 178 to 187-190 mm over the move and yaw reduced to 7.6 deg; bokeh 4.6 -> 6.2 with a shorter focus range;
> 8-pin package lowered to 6 mm; side parts rebuilt as two columns of 1.1 x 0.8 mm grey parts at 1.9 mm pitch; right-hand package shortened; table albedo less green, cone slightly tighter.
> The render was discarded and both chips videos re-rendered.

> Video 03 (chips V1), visual match round 3 (on stills, third and last round):
> 1 legs of the long and 8-pin packages read dark grey with pale tips instead of chrome; 2 memory-chip tops said to be too light (not confirmed: sampled tops match within a few levels) and too grainy;
> 3 pin rows thinner and dimmer than the reference's bright strips on both long edges; 4 table bluer and brighter; 5 contact shadows paler, broader and showing on the lit side of the module, no pin reflections;
> 6 side parts read as a grid of dark squares in 2-3 columns (reference: one column of small grey parts), traces too bright between chips; 7 gold more saturated with coarser fingers;
> 8 offsets: 8-pin package position and height, top-left pin row 30 px low at the start, left package's pins intruding in the middle frame, right package 30 px left, big flat-pack 30 px wide at the end, module leaning more at the end;
> 9 near end of the module blurred at the start (reference fairly sharp there); 10 big flat-pack top too dark, right-hand tops too light.
> Matching: layout and object count, camera path and timing, module position and orientation, board hue, notch position, chip arrangement, depth-of-field falloff towards the top.
> Fixes: leads brighter and the environment's all-round level raised so vertical metal faces pick up reflections; pins lengthened and brightened; table slightly darker and more neutral;
> contact decals tightened, darkened and shifted towards the shadow side; side parts back to one column of small grey parts, traces dimmed; gold paler with 0.8 mm fingers;
> focus plane moved 5% nearer; cone widened for the left side; placements nudged (five packages) and end yaw reduced.
> Not fixed: pin reflections in the table, softening of in-focus edges.

> Video 03 (chips V1), confirmation on the final render (after the three allowed rounds; no further changes made):
> Remaining differences: leads read as flat white bars rather than chrome with dark undersides; the flat-pack's near-side legs are longer, thinner and darker, and it has 14 side leads where the reference shows about 15;
> gold paler than the reference's peach-orange; memory-chip tops lighter with fainter pin rows and more legible marking; board brighter green with fainter traces and more prominent side parts;
> table contrast lower and more matte; a broader shadow band along the module's left edge; depth of field and overall softness weaker; 8-pin package seen more front-on with legs on both sides;
> left long package narrower in frame, right long package's lead tips more visible; bottom-left package larger and shifted right in the middle frame; dark tops more neutral navy than teal.
> Matching: layout and camera timing, module position/scale/tilt, notch and hole placement, package positions, amount of empty table, no particles or glow.

#### 04-V2-memory-chips

> Video 04 (chips V2, camera angle), round 1 on the final render: "Change clearly visible: yes. Everything else same concept and quality: yes."
> Remaining differences against the reference other than the angle: no visible depth of field (from straight above everything lies in the focus plane), table reads more matte with a weaker gradient and harder shadows offset down-left,
> leads less metallic, board darker with fainter traces, side parts larger and sparser, pin rows duller, gold paler, chip bodies bluer and flatter, start framing slightly tighter (three memory chips visible instead of four), crisper grade. Timing matches at all three frames.
> No fix required by the rule for Version 2 (both answers yes).

#### Check 11 – Version 2 distinctness

`qc/barrels-reference-V1-V2.png` and `qc/chips-reference-V1-V2.png` show reference | Version 1 | Version 2 at the start, middle and end. The barrels differ at a glance by colour (yellow and teal sky against turquoise and amber sky) with identical layout, light and motion. The chips differ at a glance by viewpoint (three-quarter view against plan view) with identical parts, palette, light and travel.

## 4. ZIP test (check 9)

Each ZIP was extracted into a fresh folder (`a temporary directory`), installed with `npm ci` (361 packages, no errors) and one 4K frame of each composition was rendered with the README's `npx remotion still … --scale=1 --gl=angle` command:

| Composition | Output | Result |
|---|---|---|
| `V1-hazard-barrels` frame 124 | 3840×2160 PNG | rendered |
| `V2-hazard-barrels` frame 124 | 3840×2160 PNG | rendered |
| `V1-memory-chips` frame 224 | 3840×2160 PNG | rendered |
| `V2-memory-chips` frame 224 | 3840×2160 PNG | rendered |

No missing files. A reduced sheet of the four frames is in `deliverables/qc/zip-test-4k-frames.png`. The ZIPs contain the source, `package.json` and `package-lock.json` (every dependency pinned to an exact version), `remotion.config.ts`, the font and its licence (barrels only; the chips project has no external assets), the look scripts, the look-dev comparison images, the installed agent skills and the README. They do not contain `node_modules`, `.git`, `out/` or the reference clips.

## 5. Render times

Measured on the build machine: 4 CPU cores, no GPU (ANGLE on software rasteriser), one browser tab.

| Project | 1080p per frame | 1080p whole video (measured) | 4K per frame (measured on consecutive frames) | 4K whole video (estimate) |
|---|---|---|---|---|
| hazard-barrels (250 frames) | about 7.5 s | 1894–2213 s (32–37 min) over four full renders | about 23.5 s | about 1 h 40 min |
| memory-chips (450 frames) | about 3.3 s | 1622–1708 s (27–28 min) over three full renders | about 13.2 s | about 1 h 40 min |

The first frame of a render costs more (bundling, procedural textures, shader compilation): about 20 s at 1080p, 30–55 s at 4K. With a GPU these times drop by a large factor; the 4K figures are for this machine only.

## 6. What could not be matched, and why

- **Softness of the references.** Both references are 898×506 stock previews, softened by scaling and compression. The renders have depth of field and a 180° motion blur but are visibly crisper in the focus plane, and the detail measure reads 20–40% low or high depending on the frame. Blurring the masters to imitate a preview would have reduced the value of the 4K compositions, so this was left.
- **Grain.** See section 2: the required dither alone exceeds the grain left in the references.
- **Barrels: paint and light balance.** By region average the hero drum's lit paint is within about 5% of the reference at the same hue (54°), but reviewers still read it as slightly greener and duller. The left stack is dimmer than in the reference (where it is as bright as the hero stack and picks up strong warm bounce light), and the thin stack visible between the left and hero stacks sits in shadow instead of sun. A stronger bounce term was tested and did not close the gap; a real fix needs a second warm light, which was out of time after the three review rounds.
- **Barrels: highlight shape and wear.** The reference's streaks are narrow and blown out and its paint shows dents and grime that break up the reflections. Ours are broader and cleaner. The enamel uses a clearcoat lobe and a normal map from procedural dents; matching the exact breakup would need a hand-authored wear map.
- **Barrels: lean and end frame.** The reference drums lean and splay irregularly; ours lean by a fixed 2.6° in the back rows only. At the end frame the hero markings sit about 10–15 px (2–3% of frame height) lower than the reference, the sky patch at the top right is plainer, and the lid rim there has no stripes.
- **Chips: metal and table.** The reference leads look like chrome with dark undersides and the table has a satin sheen with faint reflections of the parts. Ours use a standard metal material lit by a procedural studio environment, with no screen-space or planar reflections, so leads read flatter and the table more matte. Contact shadows are painted decals, not traced occlusion.
- **Chips: part details.** Package positions are within about 20–40 px of the reference in some frames, the flat-pack has 14 leads per side where the reference shows about 15, the 8-pin package is seen slightly more front-on, and the trace pattern is an invented layout that is fainter than the reference's.
- **Chips Version 2: look numbers.** From straight above, the table loses most of its view-dependent sheen, so the plan view is about 12% darker and more saturated than the reference frames, and no depth-of-field blur is visible because everything lies near the focus plane. That follows from the chosen change; the look settings are identical to Version 1.
- **Glow falloff and vignette measures** follow composition (where the brightest small highlight happens to be, what sits in the corners) more than light, and miss in most frames of every video.

