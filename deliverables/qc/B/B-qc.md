# QC material - Reference B -> `city-growth`

## Step 2 - analysis of the reference

- **Duration:** `ffprobe`: 15.000000 s, 450 frames, 30/1 fps, 768x432, h264, no audio. Frame count at 30 fps = round(15.0 x 30) = **450** (the reference is already 30 fps, difference 0).
- **2D or 3D: 3D.** A perspective camera orbits and rises over extruded buildings that occlude each other, cast shadows and show parallax; vertical edges converge towards a nadir point about 3.2 half-frame-heights below the frame centre, which at a ~48 deg look-down angle corresponds to a vertical field of view of about 32 deg. Cannot be faked in 2D.
- **Loop:** no. Frame 0 is an empty pale ground, the last frame is the finished city (mean abs difference first/last frame > 60/255). Motion stops at frame ~345 (11.5 s) and the last 3.5 s are a static hold (frame-to-frame difference 0.0).
- **What it shows:** a stylised white-and-blue city growing outward from one street on a pale cyan island surrounded by dark teal water.
  - 0.0-0.3 s empty pale ground (centre `#dceff4`, corners `#a1d4e2`).
  - 0.3-1.3 s the first grey streets draw on from the centre (`#95b0bc`), white Voronoi "pebble" ground tiles spread around them.
  - 1.3-2.0 s the first towers appear as dotted construction-line ghosts and turn solid.
  - 2-5 s buildings rise ring by ring, elevated curved roads draw on, streets keep running ahead of the buildings; the camera drifts sideways, tilts down and pulls back slightly; the dark water (`#375f70`) comes into view beyond the coast.
  - 5-8.5 s the low-rise outskirts fill in up to the coast; 8.5-11.5 s the camera eases to rest; 11.5-15 s hold.
  - Colours sampled: lit ground `#d6edf3`/`#c9e9f0`, white tiles and roofs `#f6fbfd`, blue shadow on the ground `#5283ae`, young streets `#8fabb4`, mature streets `#325062`, glass towers `#146486`-`#4c9bc0`, low-rise walls `#4f7388`, tower concrete `#8fb3c6`, water `#2f596d`-`#3d6b81`.
- **Light, atmosphere and texture** (numbers below, measured with `scripts/measure-look.py --mask 285,170,480,260`):
  - Light: one hard-ish sun from the upper left/back of the view at roughly 40 deg elevation (shadows about 1.2x the object height, fairly sharp edges) plus a strong blue sky fill, so shadows are saturated blue rather than grey. The whole picture has a cyan-mint cast; whites sit at 96-98 % and are not clipped.
  - Atmosphere: very high key. The black level is lifted to a dark teal - the darkest 0.5 % of pixels are `#234557` (R ~5 %, G ~27 %, B ~34 %), there is no black anywhere (0 % of pixels below 5 %). Mild depth fade only (contrast top/mid/bottom thirds 56/60/65 in the settled view). A cyan-tinted vignette darkens the corners (frame 0: centre `#dceff4` -> corner `#a1d4e2`, i.e. red falls to ~0.73, green 0.89, blue 0.93 of the centre in display values). Slight soft bloom around the white areas. No fog, dust or light rays.
  - Texture: clean CG - no film grain (flat-area high-pass std 0.8-1.2 x10^-3, which is compression noise). Dense fine detail from window bands, roof panels and small buildings (Laplacian variance 170-250 x10^-4 once the city exists). Hue is constant: shadows/midtones/highlights 199/199/197 deg.
- **Technology:** three.js (WebGL 2) through `@remotion/three` / React Three Fiber: one instanced mesh for ~all boxes (buildings, podiums, roof details, pillars) with the growth done in the vertex shader, a second instanced mesh for the construction-line ghosts, shader-driven draw-on for streets and elevated roads, a procedural Voronoi ground, PCF shadow map, gradient-sky PMREM environment, and a small custom post chain (half-float 4x MSAA scene target -> bloom pyramid -> ACES + grade + vignette + dither). `@remotion/noise` bends the street grid and shapes the coast. Everything is generated from one `mulberry32` seed at module scope.
- **Version 2 choice: a different camera movement.** The reference is defined by its restrained palette (changing it would fight the look that was just matched) and its camera stays at a similar distance throughout, so the move is the element that can change most visibly while the design stays identical. V2 starts high and steep on the opposite side of the city (close to a plan view, the streets spread like a map), then cranes down and orbits the other way round into a low view across the skyline, still moving at the end.
- **Assumptions:** the stock watermark is ignored; the city layout is an original procedural one (no real landmark), so individual buildings and streets do not coincide with the reference - the growth order, proportions, timing and look are matched instead.

### Reference look numbers (5 frames)

| measure | f0 | f112 | f225 | f337 | f449 |
|---|---:|---:|---:|---:|---:|
| lum_p1 | 78.78 | 26.25 | 25.71 | 26.47 | 26.39 |
| lum_p5 | 83.22 | 33.01 | 32.18 | 31.49 | 31.44 |
| lum_p50 | 89.38 | 70.49 | 51.79 | 50.85 | 50.76 |
| lum_p95 | 91.61 | 95.29 | 92.72 | 91.23 | 90.80 |
| lum_p99 | 91.61 | 98.50 | 97.79 | 96.23 | 96.17 |
| pct_above_90 | 38.41 | 10.49 | 8.13 | 6.43 | 6.37 |
| pct_below_5 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| sat_mean | 15.98 | 30.71 | 41.62 | 42.91 | 43.01 |
| hue_shadows | 191.06 | 200.27 | 199.59 | 199.40 | 199.32 |
| hue_midtones | 191.20 | 196.45 | 199.32 | 199.13 | 199.07 |
| hue_highlights | 191.94 | 191.89 | 196.80 | 197.03 | 196.48 |
| glow_r50 | 41.93 | 22.01 | 2.73 | 4.69 | 4.69 |
| glow_r25 | 48.44 | 101.43 | 42.71 | 102.60 | 102.60 |
| glow_r10 | 50.78 | 101.95 | 107.42 | 106.77 | 106.90 |
| contrast_top | 9.42 | 53.19 | 57.38 | 56.03 | 56.00 |
| contrast_mid | 4.50 | 63.41 | 59.62 | 60.17 | 60.18 |
| contrast_bot | 8.92 | 65.66 | 66.75 | 64.66 | 64.68 |
| haze_far_near_contrast | 1.06 | 0.81 | 0.86 | 0.87 | 0.87 |
| grain_flat_std | 0.00 | 1.19 | 0.92 | 0.81 | 0.86 |
| detail_laplacian_var | 0.07 | 166.73 | 173.59 | 215.30 | 246.36 |
| vignette_corner_centre | 0.89 | 1.00 | 0.75 | 0.77 | 0.77 |

## Step 4A - look development stills (reference vs ours)

Key moments: **start = frame 45 (1.5 s)**, **peak = frame 112 (3.73 s)**, **settled = frame 337 (11.23 s)**.
Side-by-sides (reference | ours | difference x3): `lookdev/compare-start.png`, `lookdev/compare-peak.png`, `lookdev/compare-settled.png`.
Targets: +-10 % (hue +-10 deg); measures that sit near zero use the absolute floors listed in `scripts/measure-look.py`.

**start (frame 45)** - 23 measures within target, 11 outside (lum_p1, pct_above_90, glow_r50, glow_r25, glow_r10, contrast_top, black_top, contrast_bot, black_bot, haze_far_near_contrast, detail_laplacian_var). Side-by-side: `lookdev/compare-start.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 40.28 | 51.57 | +28.0% | FAIL |
| lum_p5 | 62.26 | 64.46 | +3.5% | PASS |
| lum_p50 | 88.51 | 89.69 | +1.3% | PASS |
| lum_p95 | 97.65 | 97.91 | +0.3% | PASS |
| lum_p99 | 98.39 | 98.72 | +0.3% | PASS |
| lum_mean | 85.91 | 86.64 | +0.9% | PASS |
| pct_above_90 | 31.15 | 44.14 | +41.7% | FAIL |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 16.26 | 16.02 | -1.5% | PASS |
| chroma_mean | 14.41 | 14.31 | -0.7% | PASS |
| hue_shadows | 194.14 | 196.63 | +2.5 deg | PASS |
| hue_midtones | 191.33 | 194.88 | +3.5 deg | PASS |
| hue_highlights | 193.87 | 194.84 | +1.0 deg | PASS |
| glow_peak | 98.14 | 98.86 | +0.7% | PASS |
| glow_peak_x | 23.57 | 40.36 | n/a | info |
| glow_peak_y | 77.78 | 77.55 | n/a | info |
| glow_r50 | 11.33 | 15.76 | +39.1% | FAIL |
| glow_r25 | 86.07 | 72.27 | -16.0% | FAIL |
| glow_r10 | 87.50 | 72.40 | -17.3% | FAIL |
| contrast_top | 9.70 | 24.13 | +148.8% | FAIL |
| black_top | 80.85 | 66.81 | -17.4% | FAIL |
| mean_top | 87.35 | 85.82 | -1.7% | PASS |
| contrast_mid | 32.67 | 35.78 | +9.5% | PASS |
| black_mid | 64.95 | 62.13 | -4.3% | PASS |
| mean_mid | 86.26 | 86.39 | +0.2% | PASS |
| contrast_bot | 46.59 | 34.26 | -26.5% | FAIL |
| black_bot | 51.45 | 64.09 | +24.6% | FAIL |
| mean_bot | 84.17 | 87.67 | +4.1% | PASS |
| haze_far_near_contrast | 0.21 | 0.70 | +238.3% | FAIL |
| grain_flat_std | 0.38 | 1.18 | +209.9% | PASS |
| grain_global_std | 22.44 | 23.05 | +2.7% | PASS |
| detail_laplacian_var | 37.48 | 32.12 | -14.3% | FAIL |
| detail_fine | 16.98 | 16.89 | -0.5% | PASS |
| detail_medium | 25.50 | 27.78 | +8.9% | PASS |
| detail_coarse | 41.72 | 44.64 | +7.0% | PASS |
| vignette_corner_centre | 1.04 | 1.05 | +1.0% | PASS |

**peak (frame 112)** - 16 measures within target, 18 outside (lum_p1, pct_above_90, chroma_mean, glow_r50, glow_r25, glow_r10, contrast_top, black_top, contrast_mid, black_mid, mean_mid, contrast_bot, black_bot, mean_bot, haze_far_near_contrast, detail_laplacian_var, detail_fine, vignette_corner_centre). Side-by-side: `lookdev/compare-peak.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 26.25 | 30.35 | +15.6% | FAIL |
| lum_p5 | 33.01 | 31.83 | -3.6% | PASS |
| lum_p50 | 70.49 | 75.91 | +7.7% | PASS |
| lum_p95 | 95.29 | 96.96 | +1.7% | PASS |
| lum_p99 | 98.50 | 97.91 | -0.6% | PASS |
| lum_mean | 67.04 | 71.88 | +7.2% | PASS |
| pct_above_90 | 10.49 | 26.55 | +153.1% | FAIL |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 30.71 | 33.72 | +9.8% | PASS |
| chroma_mean | 20.83 | 25.33 | +21.6% | FAIL |
| hue_shadows | 200.27 | 199.33 | -0.9 deg | PASS |
| hue_midtones | 196.45 | 198.08 | +1.6 deg | PASS |
| hue_highlights | 191.89 | 194.38 | +2.5 deg | PASS |
| glow_peak | 100.00 | 98.54 | -1.5% | PASS |
| glow_peak_x | 3.39 | 27.86 | n/a | info |
| glow_peak_y | 65.28 | 28.24 | n/a | info |
| glow_r50 | 22.01 | 79.69 | +262.1% | FAIL |
| glow_r25 | 101.43 | 80.21 | -20.9% | FAIL |
| glow_r10 | 101.95 | 82.42 | -19.2% | FAIL |
| contrast_top | 53.19 | 65.71 | +23.5% | FAIL |
| black_top | 37.06 | 30.52 | -17.7% | FAIL |
| mean_top | 76.01 | 69.76 | -8.2% | PASS |
| contrast_mid | 63.41 | 51.72 | -18.4% | FAIL |
| black_mid | 34.34 | 45.41 | +32.3% | FAIL |
| mean_mid | 67.20 | 75.50 | +12.4% | FAIL |
| contrast_bot | 65.66 | 56.93 | -13.3% | FAIL |
| black_bot | 28.49 | 39.95 | +40.2% | FAIL |
| mean_bot | 57.93 | 70.97 | +22.5% | FAIL |
| haze_far_near_contrast | 0.81 | 1.15 | +42.5% | FAIL |
| grain_flat_std | 1.19 | 1.22 | +2.6% | PASS |
| grain_global_std | 49.30 | 44.38 | -10.0% | PASS |
| detail_laplacian_var | 166.73 | 96.15 | -42.3% | FAIL |
| detail_fine | 36.35 | 30.49 | -16.1% | FAIL |
| detail_medium | 60.24 | 64.22 | +6.6% | PASS |
| detail_coarse | 84.78 | 84.32 | -0.5% | PASS |
| vignette_corner_centre | 1.00 | 0.89 | -10.5% | FAIL |

**settled (frame 337)** - 14 measures within target, 20 outside (lum_p1, lum_p50, lum_mean, pct_above_90, glow_r50, glow_r25, glow_r10, contrast_top, contrast_mid, black_mid, mean_mid, contrast_bot, black_bot, mean_bot, haze_far_near_contrast, grain_global_std, detail_laplacian_var, detail_fine, detail_medium, vignette_corner_centre). Side-by-side: `lookdev/compare-settled.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 26.47 | 30.43 | +15.0% | FAIL |
| lum_p5 | 31.49 | 30.99 | -1.6% | PASS |
| lum_p50 | 50.85 | 66.81 | +31.4% | FAIL |
| lum_p95 | 91.23 | 93.74 | +2.8% | PASS |
| lum_p99 | 96.23 | 95.84 | -0.4% | PASS |
| lum_mean | 56.14 | 64.32 | +14.6% | FAIL |
| pct_above_90 | 6.43 | 11.39 | +77.2% | FAIL |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 42.91 | 39.52 | -7.9% | PASS |
| chroma_mean | 26.68 | 27.31 | +2.4% | PASS |
| hue_shadows | 199.40 | 198.92 | -0.5 deg | PASS |
| hue_midtones | 199.13 | 195.38 | -3.8 deg | PASS |
| hue_highlights | 197.03 | 192.32 | -4.7 deg | PASS |
| glow_peak | 97.94 | 96.48 | -1.5% | PASS |
| glow_peak_x | 0.00 | 66.93 | n/a | info |
| glow_peak_y | 91.44 | 46.76 | n/a | info |
| glow_r50 | 4.69 | 24.09 | +413.9% | FAIL |
| glow_r25 | 102.60 | 73.18 | -28.7% | FAIL |
| glow_r10 | 106.77 | 73.18 | -31.5% | FAIL |
| contrast_top | 56.03 | 62.55 | +11.6% | FAIL |
| black_top | 33.06 | 30.46 | -7.9% | PASS |
| mean_top | 50.86 | 55.94 | +10.0% | PASS |
| contrast_mid | 60.17 | 52.62 | -12.5% | FAIL |
| black_mid | 31.60 | 41.74 | +32.1% | FAIL |
| mean_mid | 59.05 | 70.86 | +20.0% | FAIL |
| contrast_bot | 64.66 | 54.72 | -15.4% | FAIL |
| black_bot | 28.41 | 38.80 | +36.6% | FAIL |
| mean_bot | 58.97 | 67.21 | +14.0% | FAIL |
| haze_far_near_contrast | 0.87 | 1.14 | +31.9% | FAIL |
| grain_flat_std | 0.81 | 1.17 | +44.2% | PASS |
| grain_global_std | 58.46 | 47.74 | -18.3% | FAIL |
| detail_laplacian_var | 215.30 | 116.22 | -46.0% | FAIL |
| detail_fine | 41.82 | 32.77 | -21.6% | FAIL |
| detail_medium | 75.36 | 65.65 | -12.9% | FAIL |
| detail_coarse | 90.73 | 85.50 | -5.8% | PASS |
| vignette_corner_centre | 0.77 | 0.69 | -10.1% | FAIL |

**Reading the look-dev numbers (stills of the delivered build).** Hue is within target in all three bands on all three stills and white level (lum_p95/p99) matches. Outside target:
- `glow_r50/r25/r10` on every still. The measure walks outward from the single brightest spot; in a frame that is 60-90 % bright everywhere the profile never falls to 25 %/10 % in the reference (it reports the frame diagonal), so the value depends on where the brightest roof sits, not on bloom. Bloom was matched by eye.
- start still: `pct_above_90`, per-third contrast and black levels - the reference frame has an empty top third and its dark elements in the lower half; ours frames the first cluster slightly differently.
- peak and settled stills: mid-tones and black levels are brighter than the reference and fine detail is lower - see the 8B round 1 note below.

**Look check round 1 (fresh sub-agent, run by the coordinator) and what was changed for it:**
1-2. Shadows too dark/navy, long and hard -> sun raised from 40 to 62 deg elevation and its share cut (intensity 8.6 -> 4.55), hemisphere fill made paler and less blue, shadow strength 1.0 -> 0.78 (see-through shadows), softer PCF (radius 1.6 -> 5 on a 2048 map), plus a contact-shading term that darkens walls towards the ground.
3. Monochrome blue cast -> near-neutral, slightly warm albedos (silver-grey low-rise walls, near-white roofs, grey streets), glass moved from indigo towards cyan, teal-green park accents kept.
4. Flat glass -> glass now has a dark teal body with a base-to-top gradient, noise-driven tonal variation, tall reflected-sky streaks, pale mullions, light edges and a white cap.
5. Clipped roofs / wide halo -> roof albedo lowered and varied, bloom threshold 0.82 -> 1.0 and strength 0.28 -> 0.16; fresh ground pads start white so the centre block reads hotter at the start.
6-7. Contrast/haze -> distance fog added (FogExp2 0.005, pale cyan), ghosts made darker and crisper with no fade at the base, lift lowered slightly.
8. Background -> stronger, earlier tinted vignette; water made a less saturated teal.
9. Streets -> neutral grey that darkens with age instead of steel blue.
10. Texture -> denser window bands and roof panels, bevelled ground tiles (highlight on the sun side, small shadow behind), 2-4 roof boxes per building.
11. Softness -> a small fixed-size lens softness in the final pass (no grain added).
Coordinator notes: city rebuilt at a smaller scale - street spacing 3.5-5.3 -> 2.6-3.8 units, narrower streets, 2-3 lots per block side, lean towers (footprint <= 1.6, height 3.6-9.5) - so the settled view shows several hundred small buildings instead of ~60.

**After 8B round 1** the look was deliberately moved towards what the step 8B reviewers described (translucent glass, high key, softer, hazier), so the stills above are from the final build and several numbers moved away from the reference: the picture is now brighter in the mid-tones (settled `lum_p50` about 67 vs 51, `black_mid/bot` about 40 vs 30) and softer (`detail_laplacian_var` about half the reference at the settled moment). Hue stays within target on every still. These are the measured cost of following the reviewers' visual notes; `src/look.ts` (`softness`, `shadowStrength`, `lift`) and `CONFIG.colors` bring them back if a closer numeric match is preferred.

## Finals

### Look over time (step 8A.7): reference vs each video, 5 frames

Frames 0, 112, 225, 337, 449 of each video (scaled to 768x432) against the same reference frames. For Version 2 the measures its camera change affects (haze thirds, glow position/falloff, vignette corners) are skipped.

**03-V1-city-growth** (cells: reference / ours / difference; **bold** = outside target)

| measure | f0 | f112 | f225 | f337 | f449 |
|---|---|---|---|---|---|
| lum_p1 | **78.8 / 87.0 / +10.4%** | **26.2 / 29.8 / +13.7%** | **25.7 / 29.9 / +16.4%** | **26.5 / 30.0 / +13.5%** | **26.4 / 30.0 / +13.8%** |
| lum_p5 | 83.2 / 87.4 / +5.0% | 33.0 / 31.4 / -5.0% | 32.2 / 31.4 / -2.4% | 31.5 / 30.6 / -2.9% | 31.4 / 30.6 / -2.8% |
| lum_p50 | 89.4 / 90.3 / +1.0% | 70.5 / 75.3 / +6.9% | **51.8 / 67.4 / +30.2%** | **50.8 / 66.3 / +30.4%** | **50.8 / 66.3 / +30.5%** |
| lum_p95 | 91.6 / 90.7 / -1.0% | 95.3 / 96.5 / +1.3% | 92.7 / 94.2 / +1.6% | 91.2 / 93.3 / +2.3% | 90.8 / 93.2 / +2.7% |
| lum_p99 | 91.6 / 90.7 / -1.0% | 98.5 / 97.4 / -1.1% | 97.8 / 95.5 / -2.3% | 96.2 / 95.3 / -1.0% | 96.2 / 95.2 / -1.0% |
| lum_mean | 88.6 / 89.7 / +1.2% | 67.0 / 71.4 / +6.5% | **57.2 / 66.6 / +16.4%** | **56.1 / 63.9 / +13.7%** | **56.1 / 63.8 / +13.7%** |
| pct_above_90 | **38.4 / 62.7 / +63.2%** | **10.5 / 25.6 / +144.2%** | **8.1 / 15.6 / +91.3%** | **6.4 / 11.0 / +70.5%** | **6.4 / 10.9 / +70.4%** |
| pct_below_5 | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% |
| sat_mean | 16.0 / 14.5 / -9.2% | **30.7 / 34.1 / +11.1%** | 41.6 / 40.4 / -2.9% | 42.9 / 40.1 / -6.6% | 43.0 / 40.1 / -6.7% |
| chroma_mean | 14.9 / 13.8 / -7.8% | **20.8 / 25.4 / +22.1%** | **26.0 / 29.9 / +15.4%** | 26.7 / 27.5 / +3.0% | 26.7 / 27.4 / +2.8% |
| hue_shadows | 191.1 / 194.2 / +3.2 deg | 200.3 / 198.9 / -1.4 deg | 199.6 / 198.7 / -0.9 deg | 199.4 / 198.4 / -1.0 deg | 199.3 / 198.4 / -0.9 deg |
| hue_midtones | 191.2 / 194.4 / +3.2 deg | 196.4 / 197.7 / +1.3 deg | 199.3 / 196.2 / -3.1 deg | 199.1 / 195.4 / -3.8 deg | 199.1 / 195.1 / -3.9 deg |
| hue_highlights | 191.9 / 193.2 / +1.2 deg | 191.9 / 193.3 / +1.4 deg | 196.8 / 194.7 / -2.1 deg | 197.0 / 192.3 / -4.7 deg | 196.5 / 191.9 / -4.6 deg |
| glow_r50 | **41.9 / 64.6 / +54.0%** | **22.0 / 79.8 / +262.7%** | **2.7 / 27.9 / +919.0%** | **4.7 / 24.2 / +416.7%** | **4.7 / 24.1 / +413.9%** |
| glow_r25 | **48.4 / 69.3 / +43.0%** | **101.4 / 80.3 / -20.8%** | **42.7 / 83.7 / +96.0%** | **102.6 / 73.3 / -28.6%** | **102.6 / 73.2 / -28.7%** |
| glow_r10 | **50.8 / 72.5 / +42.8%** | **102.0 / 82.6 / -19.0%** | **107.4 / 84.8 / -21.1%** | **106.8 / 73.3 / -31.3%** | **106.9 / 73.2 / -31.5%** |
| contrast_top | **9.4 / 3.5 / -63.2%** | **53.2 / 65.5 / +23.2%** | **57.4 / 64.0 / +11.6%** | **56.0 / 62.4 / +11.4%** | **56.0 / 62.4 / +11.4%** |
| contrast_mid | 4.5 / 3.0 / -32.3% | **63.4 / 51.7 / -18.5%** | **59.6 / 53.3 / -10.5%** | **60.2 / 53.0 / -11.9%** | **60.2 / 53.0 / -11.9%** |
| contrast_bot | **8.9 / 3.5 / -61.1%** | **65.7 / 57.0 / -13.3%** | **66.8 / 56.4 / -15.5%** | **64.7 / 54.7 / -15.4%** | **64.7 / 54.8 / -15.3%** |
| haze_far_near_contrast | 1.1 / 1.0 / -5.3% | **0.8 / 1.2 / +42.1%** | **0.9 / 1.1 / +32.0%** | **0.9 / 1.1 / +31.7%** | **0.9 / 1.1 / +31.6%** |
| grain_flat_std | 0.0 / 0.5 / +485131.0% | 1.2 / 1.3 / +13.7% | 0.9 / 1.3 / +42.6% | 0.8 / 1.1 / +37.5% | 0.9 / 1.1 / +26.7% |
| detail_laplacian_var | 0.1 / 0.1 / +101.9% | **166.7 / 96.1 / -42.4%** | **173.6 / 107.7 / -38.0%** | **215.3 / 115.3 / -46.4%** | **246.4 / 116.3 / -52.8%** |
| detail_fine | 0.7 / 0.9 / +17.8% | **36.3 / 30.5 / -16.0%** | **38.5 / 31.7 / -17.7%** | **41.8 / 32.7 / -21.9%** | **43.3 / 32.8 / -24.4%** |
| detail_medium | 0.9 / 0.6 / -29.5% | 60.2 / 64.3 / +6.7% | 71.0 / 65.7 / -7.5% | **75.4 / 65.6 / -12.9%** | **75.6 / 65.6 / -13.2%** |
| detail_coarse | 1.5 / 0.6 / -57.7% | 84.8 / 84.3 / -0.5% | 94.6 / 87.0 / -8.0% | 90.7 / 85.6 / -5.7% | 90.6 / 85.5 / -5.6% |
| vignette_corner_centre | 0.9 / 1.0 / +8.4% | **1.0 / 0.9 / -10.5%** | 0.8 / 0.8 / +1.1% | **0.8 / 0.7 / -10.4%** | **0.8 / 0.7 / -10.3%** |

65 of 130 compared cells within target, 65 outside.

**04-V2-city-growth** (cells: reference / ours / difference; **bold** = outside target)

| measure | f0 | f112 | f225 | f337 | f449 |
|---|---|---|---|---|---|
| lum_p1 | **78.8 / 87.0 / +10.4%** | **26.2 / 34.0 / +29.5%** | **25.7 / 30.0 / +16.8%** | **26.5 / 30.0 / +13.5%** | **26.4 / 30.0 / +13.8%** |
| lum_p5 | 83.2 / 87.2 / +4.8% | **33.0 / 42.7 / +29.2%** | 32.2 / 30.4 / -5.4% | 31.5 / 30.4 / -3.4% | 31.4 / 30.6 / -2.6% |
| lum_p50 | 89.4 / 90.3 / +1.0% | **70.5 / 87.6 / +24.3%** | **51.8 / 67.3 / +29.9%** | 50.8 / 54.7 / +7.6% | 50.8 / 52.6 / +3.6% |
| lum_p95 | 91.6 / 90.7 / -1.0% | 95.3 / 97.3 / +2.1% | 92.7 / 93.6 / +0.9% | 91.2 / 91.3 / +0.0% | 90.8 / 90.3 / -0.5% |
| lum_p99 | 91.6 / 90.7 / -1.0% | 98.5 / 97.5 / -1.0% | 97.8 / 95.5 / -2.3% | 96.2 / 94.2 / -2.1% | 96.2 / 94.2 / -2.0% |
| lum_mean | 88.6 / 89.6 / +1.2% | **67.0 / 80.7 / +20.4%** | **57.2 / 63.4 / +10.9%** | 56.1 / 55.8 / -0.7% | 56.1 / 54.8 / -2.3% |
| pct_above_90 | **38.4 / 61.4 / +60.0%** | **10.5 / 41.0 / +291.3%** | **8.1 / 13.1 / +61.4%** | 6.4 / 6.1 / -4.5% | **6.4 / 5.2 / -18.4%** |
| pct_below_5 | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% |
| sat_mean | 16.0 / 14.5 / -9.0% | **30.7 / 22.1 / -28.0%** | 41.6 / 38.3 / -7.9% | 42.9 / 46.2 / +7.8% | **43.0 / 48.1 / +11.9%** |
| chroma_mean | 14.9 / 13.8 / -7.6% | **20.8 / 17.7 / -15.2%** | 26.0 / 25.0 / -3.9% | 26.7 / 28.5 / +6.8% | **26.7 / 30.0 / +12.4%** |
| hue_shadows | 191.1 / 194.3 / +3.2 deg | 200.3 / 198.1 / -2.2 deg | 199.6 / 198.5 / -1.1 deg | 199.4 / 198.6 / -0.8 deg | 199.3 / 198.5 / -0.8 deg |
| hue_midtones | 191.2 / 194.3 / +3.1 deg | 196.4 / 195.3 / -1.1 deg | 199.3 / 196.3 / -3.1 deg | 199.1 / 198.5 / -0.6 deg | 199.1 / 198.8 / -0.3 deg |
| hue_highlights | 191.9 / 193.1 / +1.1 deg | 191.9 / 191.1 / -0.8 deg | 196.8 / 193.8 / -3.0 deg | 197.0 / 194.6 / -2.4 deg | 196.5 / 195.4 / -1.1 deg |
| glow_r50 | 41.9 / 65.5 / skipped | 22.0 / 31.5 / skipped | 2.7 / 8.2 / skipped | 4.7 / 14.5 / skipped | 4.7 / 2.9 / skipped |
| glow_r25 | 48.4 / 70.8 / skipped | 101.4 / 80.3 / skipped | 42.7 / 105.2 / skipped | 102.6 / 55.6 / skipped | 102.6 / 36.3 / skipped |
| glow_r10 | 50.8 / 74.5 / skipped | 102.0 / 80.6 / skipped | 107.4 / 105.2 / skipped | 106.8 / 66.4 / skipped | 106.9 / 66.4 / skipped |
| contrast_top | 9.4 / 3.5 / skipped | 53.2 / 56.8 / skipped | 57.4 / 64.1 / skipped | 56.0 / 51.9 / skipped | 56.0 / 46.4 / skipped |
| contrast_mid | 4.5 / 3.0 / skipped | 63.4 / 52.2 / skipped | 59.6 / 62.1 / skipped | 60.2 / 61.5 / skipped | 60.2 / 60.3 / skipped |
| contrast_bot | 8.9 / 3.5 / skipped | 65.7 / 54.9 / skipped | 66.8 / 53.2 / skipped | 64.7 / 52.5 / skipped | 64.7 / 51.8 / skipped |
| haze_far_near_contrast | 1.1 / 1.0 / skipped | 0.8 / 1.0 / skipped | 0.9 / 1.2 / skipped | 0.9 / 1.0 / skipped | 0.9 / 0.9 / skipped |
| grain_flat_std | 0.0 / 0.5 / +480043.8% | **1.2 / 2.6 / +120.7%** | 0.9 / 1.0 / +13.1% | 0.8 / 0.9 / +6.9% | 0.9 / 1.1 / +30.4% |
| detail_laplacian_var | 0.1 / 0.1 / +106.0% | **166.7 / 106.2 / -36.3%** | **173.6 / 99.6 / -42.6%** | **215.3 / 95.6 / -55.6%** | **246.4 / 83.6 / -66.0%** |
| detail_fine | 0.7 / 0.9 / +18.5% | **36.3 / 31.5 / -13.4%** | **38.5 / 32.8 / -14.9%** | **41.8 / 30.5 / -27.0%** | **43.3 / 30.0 / -30.7%** |
| detail_medium | 0.9 / 0.7 / -27.5% | **60.2 / 67.3 / +11.6%** | 71.0 / 67.2 / -5.5% | **75.4 / 62.6 / -17.0%** | **75.6 / 61.1 / -19.3%** |
| detail_coarse | 1.5 / 0.6 / -58.4% | 84.8 / 83.3 / -1.8% | **94.6 / 80.5 / -15.0%** | **90.7 / 74.9 / -17.4%** | **90.6 / 74.9 / -17.3%** |
| vignette_corner_centre | 0.9 / 1.0 / skipped | 1.0 / 1.0 / skipped | 0.8 / 0.7 / skipped | 0.8 / 0.7 / skipped | 0.8 / 0.8 / skipped |

57 of 90 compared cells within target, 33 outside.

**Reading the look-over-time table.** Hue, white level and the absence of grain hold from the first frame to the last, and nothing flickers (see check 4). Outside target after the 8B round 1 changes: mid-tones are brighter than the reference (`lum_p50`, per-third means and black levels), near-white area is larger (`pct_above_90`), and fine detail is lower because of the added softness (`detail_*`, `grain_global_std`); the glow radii are not meaningful on a high-key frame (see above). Version 2 additionally differs in everything that depends on framing.

### Step 8A - technical checks

| # | check | 03-V1-city-growth.mp4 | 04-V2-city-growth.mp4 | result |
|---|---|---|---|---|
| 1 | Specs (1920x1080, h264, yuv420p, 30/1, 450 frames, no audio) | 1920x1080, h264, yuv420p, 30/1 fps, 450 frames, streams: 1 video | 1920x1080, h264, yuv420p, 30/1 fps, 450 frames, streams: 1 video | PASS |
| 2 | Duration = reference within one frame (33.3 ms) | 15.000000 s (reference 15.000000 s, diff 0.0 ms) | 15.000000 s (reference 15.000000 s, diff 0.0 ms) | PASS |
| 3 | Integrity (`ffmpeg -v error -i f -f null -`) | no decode errors | no decode errors | PASS |
| 4 | Frame scan (all 450 frames) + contact sheet | mean brightness 162-228/255, near-black frames: 0, frozen runs (first-last frame): [[347, 350], [351, 354], [355, 449]], largest brightness jump 1.21/255 at frame 33, largest frame difference 5.38/255 | mean brightness 138-228/255, near-black frames: 0, frozen runs (first-last frame): none, largest brightness jump 1.56/255 at frame 33, largest frame difference 13.93/255 | PASS |
| 5 | Loop | n/a - the reference does not loop | n/a | n/a |
| 6 | Determinism (cold-start frame = same frame in a full render, byte for byte) | cold still of frame 225 = frame 225 of a continuous 41-frame render (205-245, `--concurrency=2`): identical files (sha256 f50b7ef4e07260165540...). Two separate continuous 41-frame renders: 0 of 41 frames differ. MP4 frame 225 vs the cold PNG: PSNR 45.6 dB (H.264 loss only) | cold still of frame 225 = frame 225 of a continuous 41-frame render: identical files (sha256 9564d6e983cb264d0456...). MP4 frame 225 vs the cold PNG: PSNR 45.3 dB | PASS |
| 7 | Look over time | see table above | see table above | PARTIAL (hue and white level hold; mid-tones brighter and detail softer than the reference, see notes) |
| 8 | Banding / artefacts (levels x4) | frame 0 (empty opening ground, centre 960x540) viewed at x4: no contour rings visible; frame 449 water crop saved | x4 crops saved, not viewed separately (frame 0 is the same empty ground and the same final pass as V1) | PASS (V1 viewed; V2 by construction) |
| 9 | ZIP test (fresh folder, `npm ci`, one 4K frame per composition) | `npm ci` 11 s, 0 vulnerabilities; `npx remotion still V1-city-growth out/V1-frame.png --frame=225 --scale=1 --gl=angle` -> 3840x2160 PNG, 25.3 s | `npx remotion still V2-city-growth out/V2-frame.png --frame=225 --scale=1 --gl=angle` -> 3840x2160 PNG, 21.7 s | PASS |

Notes on the checks:
- **Check 4, frozen runs.** Any frozen run in V1 is the end hold: the reference is static from frame ~345 to 449 and our camera also stops at frame 345 (11.5 s). V2 keeps moving by design. No black or blank frames (the first frames are the empty pale ground, as in the reference).
- **Check 6, method.** The MP4 is lossy, so the byte comparison is made on the PNG frames Remotion produces before encoding: a cold-start `remotion still` of the middle frame against the same frame taken from a continuous 41-frame render (frames 205-245, two tabs), not from the full 450-frame render.
- **Check 6, a bug found and fixed earlier.** The very first set of finals was not reproducible (19 of 41 frames differed between identical runs, up to 8/255 in up to 16 pixels) because the ground shader used `fwidth()` of the Voronoi edge distance, which is built in a data-dependent loop. It now uses `fwidth()` of the interpolated world position; thin boxes and coplanar streets were also removed as possible depth ties. All later renders, including the delivered ones, pass the check.
- **Check 8.** Scene and bloom targets are half-float; the final pass adds a +-1/255 dither. Since 8B round 1 the dither is a fixed pattern (it survives H.264 on flat areas, a per-frame one is smoothed away) and the vignette is weaker, which is what was asked for the light opening. See `banding/` for the x4 crops of the delivered files.

Contact sheets (one frame per second): `checks/03-V1-city-growth-contact-sheet.png`, `checks/04-V2-city-growth-contact-sheet.png`. Stretched gradient crops: `banding/`. Raw outputs: `checks/`.

### Match frames for step 8B

`match/ref-<n>.png`, `match/v1-<n>.png`, `match/v2-<n>.png` for n = 0, 45, 112, 225, 337, 449, all 768x432. Frame 0 of the reference is an empty ground, so use **45, 225, 449** as start / middle / end.

### Step 8B round 1 (two fresh sub-agents, run by the coordinator on frames 45 / 225 / 449) and what changed

**V1 notes received (most important first):** 1 towers opaque saturated boxes with a hard window grid instead of translucent pale glass with vertical highlights and bloom; 2 too contrasty (dark streets, dark grey buildings) where the reference is high-key and hazy; 3 uniformly crisp, no depth haze; 4 an even forest of similar towers with repeated stepped caps instead of mostly low white blocks plus a few large glass towers (biggest right of centre); 5 circular coast, little water, no bridge; 6 highway a closed ring instead of a thin S-curve from the bridge; 7 opening cluster too large on a bluer, vignetted background; 8 wireframes too dense and dark, no solid parts yet; 9 only a few straight streets, no lane dots; 10 Voronoi shards too large/numerous and still visible on the final ground, which should be smooth with aqua-green tints; 11 towers at full height before the ground is built; 12 camera barely moves between frames 225 and 449; 13 turquoise-green ground glow missing.

**V2 notes received** (camera change clearly visible: yes; same concept and quality: no): glass look and soft glow missing; low-rise too grey; ground glow missing and cracked tiles visible late; frame 45 shows flat hatched squares instead of the tall wireframe block (plan view hides it); lane streaks missing; tiles too large; streets too thick and dark, elevated roads too faint; water too light/grey; vignette with faint banding rings on the light opening; remove the central antenna; coast less scalloped.

**Changed for it (both versions share everything but the camera):**
- Glass (V1 1, V2 1): glass towers are now a separate alpha-blended instanced mesh (see-through, a slim core visible inside), pale cyan-to-azure with soft vertical highlight bands instead of a window grid, light edges and caps; bloom threshold lowered and strength raised.
- High key (V1 2, V2 3): low-rise walls and roofs near white, streets mid-grey with ageing to a lighter dark, shadows paler (strength 0.78 -> 0.7 after trials at 0.5), contact shading reduced; water made a deeper teal-navy without a gradient.
- Softness / haze (V1 3, V2 2): lens softness 0.45 -> 0.75 with a wider kernel, distance fog kept at 0.005.
- Composition (V1 4, V2 11): layout rewritten: a compact first cluster of towers in the centre, six landmark glass towers placed by hand (`CONFIG.heroTowers`, the largest right of centre), few other towers, everything else low white blocks; stepped crowns and the antenna removed (plain shafts, an occasional single setback).
- Coast / bridge / highway (V1 5-6): coast back to a smooth irregular outline, island shifted so more water shows; the ring road replaced by one thin S-curve that comes in from a long bridge over the water and passes the centre, plus one joining arc; decks lighter so they read.
- Opening (V1 7-11, V2 5-7): streets run ahead of everything (street front twice as fast early), block plates and tower podiums form before the towers, core towers rise 1.35-1.8 s so some are part-built at frame 45; wireframe lines thinner and lighter; Voronoi shards 0.58 -> 0.36 units, in a narrow band at the perimeter only, and they close into smooth ground that turns turquoise-green as the city matures; dashed centre lines on the avenues; weaker vignette, fixed-pattern dither.
- Camera (V1 12): Version 1 keeps orbiting and pulling back from 7.5 s to 11.5 s (azimuth 64 -> 82 deg, distance 32 -> 41), revealing more water. Version 2 now starts steep (72 deg) instead of straight down so the wireframe towers read at frame 45, then cranes and orbits the other way as before.
- Not done: rounded street corners (V1 9), street-level light streaks beyond the lane dashes, a re-layout to match the reference's exact coast shape.

### Render times

| Output | Per frame | Whole video (450 frames) |
|---|---|---|
| 1080p, the delivered files (`--concurrency=2`, 4-core machine, software GL) | 3.4 s (V1), 3.3 s (V2) | 25 min 40 s (V1), 24 min 46 s (V2) |
| 4K (`--scale=1`), estimated as 4x the pixels of the 1080p figure | about 14 s | about 103 min |
| 4K single cold still (includes bundling and browser start-up), measured in the ZIP test | 25.3 s / 21.7 s | |

All on a 4-core cloud machine with software GL (SwiftShader); a GPU machine will be many times faster. Earlier builds, rendered while three other renders shared the cores, took 25-28 min per 1080p video.

### ZIP test

`deliverables/city-growth-project.zip` (about 680 KB, 464 files): `src/` with both 4K compositions and `LookDev`, `package.json` + `package-lock.json` (exact versions), `remotion.config.ts`, `tsconfig.json`, eslint/prettier config, `scripts/`, `lookdev/measure-*.json`, `README.md`, the installed agent skills (`.agents/`, `skills-lock.json`). Left out: `node_modules`, `.git`, `out/`, the reference clip, the `.claude` symlink folder, and the `lookdev/compare-*.png` side-by-sides (they contain reference frames; they are in `deliverables/qc/B/lookdev/` instead). The project has no fonts, models or textures.

Test: extracted into a fresh folder, `npm ci` (11 s, 0 vulnerabilities), then the README's single-frame 4K commands for both compositions. Both produced a 3840x2160 PNG (mean brightness 167.0 and 160.0 of 255); log in `checks/zip-test.log`. Result: **PASS**.

Unused packages were removed before packaging (`@react-three/drei`, `postprocessing`): the post chain is a small custom one and nothing imports them.

### What could not be matched, and why

- **The exact city.** The layout is an original procedural one, so streets, towers and the elevated roads are not in the same places as in the reference; proportions, density, growth order and timing are matched instead. Landmark towers are plain glass shafts.
- **Building detail.** The reference buildings are modelled meshes (setbacks, sloped roofs, facade relief, rooftop plant). Ours are stacked boxes with shader-drawn window bands, roof panels, parapets and a few roof boxes: the same reading at this scale, less variety up close.
- **Glass.** The reference glass is ray-traced-looking (real reflections of neighbours, translucency). Ours fakes it with a gradient, noise streaks and edge highlights; no true reflections or refraction.
- **Ambient occlusion.** The reference has soft contact shadows everywhere. Ours has a soft shadow map plus a height-based wall darkening, but no real AO pass (too slow on software GL), so narrow gaps are a little lighter than in the reference.
- **Glow falloff numbers.** Not matched and not meaningful on these frames (explained under the look tables).
- **Small props.** The cars on the elevated roads and the ramps/junction details of the reference's elevated roads are not reproduced.
- **Numeric look match after 8B round 1.** Following the reviewers' notes made the picture brighter in the mid-tones and softer than the reference measures (see the look tables); visual notes and numbers pulled in different directions here and the visual notes were given priority.
- **Rounded street corners** and the exact coast / bridge geometry of the reference.
- **Glass sorting.** The translucent towers are one instanced mesh without per-tower depth sorting; where two glass towers overlap, the rear one can be hidden rather than seen through.
