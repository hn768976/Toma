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

**start (frame 45)** - 18 measures within target, 16 outside (lum_p1, lum_p5, pct_above_90, sat_mean, chroma_mean, glow_r25, glow_r10, contrast_mid, contrast_bot, black_bot, haze_far_near_contrast, grain_global_std, detail_laplacian_var, detail_fine, detail_medium, detail_coarse). Side-by-side: `lookdev/compare-start.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 40.28 | 63.69 | +58.1% | FAIL |
| lum_p5 | 62.26 | 77.34 | +24.2% | FAIL |
| lum_p50 | 88.51 | 90.55 | +2.3% | PASS |
| lum_p95 | 97.65 | 97.07 | -0.6% | PASS |
| lum_p99 | 98.39 | 98.44 | +0.1% | PASS |
| lum_mean | 85.91 | 89.53 | +4.2% | PASS |
| pct_above_90 | 31.15 | 67.28 | +116.0% | FAIL |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 16.26 | 12.66 | -22.2% | FAIL |
| chroma_mean | 14.41 | 11.76 | -18.4% | FAIL |
| hue_shadows | 194.14 | 195.71 | +1.6 deg | PASS |
| hue_midtones | 191.33 | 195.47 | +4.1 deg | PASS |
| hue_highlights | 193.87 | 195.15 | +1.3 deg | PASS |
| glow_peak | 98.14 | 98.70 | +0.6% | PASS |
| glow_peak_x | 23.57 | 52.34 | n/a | info |
| glow_peak_y | 77.78 | 75.23 | n/a | info |
| glow_r50 | 11.33 | 11.33 | +0.0% | PASS |
| glow_r25 | 86.07 | 67.19 | -21.9% | FAIL |
| glow_r10 | 87.50 | 67.19 | -23.2% | FAIL |
| contrast_top | 9.70 | 10.38 | +7.0% | PASS |
| black_top | 80.85 | 80.70 | -0.2% | PASS |
| mean_top | 87.35 | 89.34 | +2.3% | PASS |
| contrast_mid | 32.67 | 26.17 | -19.9% | FAIL |
| black_mid | 64.95 | 71.37 | +9.9% | PASS |
| mean_mid | 86.26 | 89.36 | +3.6% | PASS |
| contrast_bot | 46.59 | 27.22 | -41.6% | FAIL |
| black_bot | 51.45 | 70.85 | +37.7% | FAIL |
| mean_bot | 84.17 | 89.85 | +6.7% | PASS |
| haze_far_near_contrast | 0.21 | 0.38 | +83.2% | FAIL |
| grain_flat_std | 0.38 | 0.96 | +151.7% | PASS |
| grain_global_std | 22.44 | 16.80 | -25.1% | FAIL |
| detail_laplacian_var | 37.48 | 24.67 | -34.2% | FAIL |
| detail_fine | 16.98 | 13.33 | -21.5% | FAIL |
| detail_medium | 25.50 | 16.81 | -34.1% | FAIL |
| detail_coarse | 41.72 | 28.52 | -31.6% | FAIL |
| vignette_corner_centre | 1.04 | 1.04 | +0.1% | PASS |

**peak (frame 112)** - 11 measures within target, 23 outside (lum_p1, lum_p5, lum_p50, lum_mean, pct_above_90, sat_mean, chroma_mean, glow_r50, glow_r25, glow_r10, contrast_top, black_top, mean_top, contrast_mid, black_mid, mean_mid, contrast_bot, black_bot, mean_bot, detail_laplacian_var, detail_fine, detail_coarse, vignette_corner_centre). Side-by-side: `lookdev/compare-peak.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 26.25 | 43.06 | +64.1% | FAIL |
| lum_p5 | 33.01 | 50.49 | +52.9% | FAIL |
| lum_p50 | 70.49 | 83.80 | +18.9% | FAIL |
| lum_p95 | 95.29 | 97.82 | +2.7% | PASS |
| lum_p99 | 98.50 | 98.36 | -0.1% | PASS |
| lum_mean | 67.04 | 75.61 | +12.8% | FAIL |
| pct_above_90 | 10.49 | 34.28 | +226.9% | FAIL |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 30.71 | 22.63 | -26.3% | FAIL |
| chroma_mean | 20.83 | 16.67 | -20.0% | FAIL |
| hue_shadows | 200.27 | 197.88 | -2.4 deg | PASS |
| hue_midtones | 196.45 | 196.62 | +0.2 deg | PASS |
| hue_highlights | 191.89 | 194.72 | +2.8 deg | PASS |
| glow_peak | 100.00 | 98.53 | -1.5% | PASS |
| glow_peak_x | 3.39 | 34.51 | n/a | info |
| glow_peak_y | 65.28 | 93.06 | n/a | info |
| glow_r50 | 22.01 | 5.08 | -76.9% | FAIL |
| glow_r25 | 101.43 | 67.19 | -33.8% | FAIL |
| glow_r10 | 101.95 | 69.92 | -31.4% | FAIL |
| contrast_top | 53.19 | 42.38 | -20.3% | FAIL |
| black_top | 37.06 | 50.88 | +37.3% | FAIL |
| mean_top | 76.01 | 67.24 | -11.5% | FAIL |
| contrast_mid | 63.41 | 46.95 | -26.0% | FAIL |
| black_mid | 34.34 | 50.96 | +48.4% | FAIL |
| mean_mid | 67.20 | 80.93 | +20.4% | FAIL |
| contrast_bot | 65.66 | 51.35 | -21.8% | FAIL |
| black_bot | 28.49 | 46.64 | +63.7% | FAIL |
| mean_bot | 57.93 | 79.49 | +37.2% | FAIL |
| haze_far_near_contrast | 0.81 | 0.83 | +1.9% | PASS |
| grain_flat_std | 1.19 | 1.24 | +4.5% | PASS |
| grain_global_std | 49.30 | 44.56 | -9.6% | PASS |
| detail_laplacian_var | 166.73 | 121.66 | -27.0% | FAIL |
| detail_fine | 36.35 | 31.70 | -12.8% | FAIL |
| detail_medium | 60.24 | 61.08 | +1.4% | PASS |
| detail_coarse | 84.78 | 75.51 | -10.9% | FAIL |
| vignette_corner_centre | 1.00 | 0.89 | -11.3% | FAIL |

**settled (frame 337)** - 13 measures within target, 21 outside (lum_p1, lum_p5, lum_p50, pct_above_90, sat_mean, chroma_mean, glow_r50, glow_r25, glow_r10, contrast_top, black_mid, mean_mid, contrast_bot, black_bot, mean_bot, haze_far_near_contrast, grain_global_std, detail_laplacian_var, detail_fine, detail_medium, detail_coarse). Side-by-side: `lookdev/compare-settled.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 26.47 | 36.28 | +37.1% | FAIL |
| lum_p5 | 31.49 | 36.50 | +15.9% | FAIL |
| lum_p50 | 50.85 | 62.65 | +23.2% | FAIL |
| lum_p95 | 91.23 | 92.17 | +1.0% | PASS |
| lum_p99 | 96.23 | 95.98 | -0.3% | PASS |
| lum_mean | 56.14 | 61.69 | +9.9% | PASS |
| pct_above_90 | 6.43 | 7.51 | +16.8% | FAIL |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 42.91 | 34.43 | -19.8% | FAIL |
| chroma_mean | 26.68 | 22.06 | -17.3% | FAIL |
| hue_shadows | 199.40 | 197.88 | -1.5 deg | PASS |
| hue_midtones | 199.13 | 196.56 | -2.6 deg | PASS |
| hue_highlights | 197.03 | 191.98 | -5.0 deg | PASS |
| glow_peak | 97.94 | 96.30 | -1.7% | PASS |
| glow_peak_x | 0.00 | 72.66 | n/a | info |
| glow_peak_y | 91.44 | 46.06 | n/a | info |
| glow_r50 | 4.69 | 13.15 | +180.6% | FAIL |
| glow_r25 | 102.60 | 68.49 | -33.2% | FAIL |
| glow_r10 | 106.77 | 78.65 | -26.3% | FAIL |
| contrast_top | 56.03 | 49.44 | -11.8% | FAIL |
| black_top | 33.06 | 36.31 | +9.8% | PASS |
| mean_top | 50.86 | 47.86 | -5.9% | PASS |
| contrast_mid | 60.17 | 55.94 | -7.0% | PASS |
| black_mid | 31.60 | 36.76 | +16.3% | FAIL |
| mean_mid | 59.05 | 69.38 | +17.5% | FAIL |
| contrast_bot | 64.66 | 50.27 | -22.3% | FAIL |
| black_bot | 28.41 | 43.52 | +53.2% | FAIL |
| mean_bot | 58.97 | 69.04 | +17.1% | FAIL |
| haze_far_near_contrast | 0.87 | 0.98 | +13.5% | FAIL |
| grain_flat_std | 0.81 | 1.12 | +37.6% | PASS |
| grain_global_std | 58.46 | 48.44 | -17.1% | FAIL |
| detail_laplacian_var | 215.30 | 173.25 | -19.5% | FAIL |
| detail_fine | 41.82 | 35.25 | -15.7% | FAIL |
| detail_medium | 75.36 | 59.01 | -21.7% | FAIL |
| detail_coarse | 90.73 | 70.68 | -22.1% | FAIL |
| vignette_corner_centre | 0.77 | 0.73 | -4.4% | PASS |

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

**After 8B rounds 1 and 2** the look was moved towards what the step 8B reviewers described (translucent pale glass, high key, a smaller-scale denser city), so several numbers sit away from the reference: mid-tones are brighter (`lum_p50` about 63 vs 51 at the end), black levels in the lower thirds are higher, and saturation is lower (about 33 vs 43). Softness was pulled back in round 2, which brought the detail measures closer again. The reviewers' visual notes were given priority where they and the numbers disagreed; `src/look.ts` (`softness`, `shadowStrength`, `lift`, `saturation`) and `CONFIG.colors` are the levers.

## Finals

### Look over time (step 8A.7): reference vs each video, 5 frames

Frames 0, 112, 225, 337, 449 of each video (scaled to 768x432) against the same reference frames. For Version 2 the measures its camera change affects (haze thirds, glow position/falloff, vignette corners) are skipped.

**03-V1-city-growth** (cells: reference / ours / difference; **bold** = outside target)

| measure | f0 | f112 | f225 | f337 | f449 |
|---|---|---|---|---|---|
| lum_p1 | **78.8 / 88.4 / +12.2%** | **26.2 / 42.8 / +63.0%** | **25.7 / 35.8 / +39.3%** | **26.5 / 35.8 / +35.3%** | **26.4 / 35.8 / +35.7%** |
| lum_p5 | 83.2 / 89.0 / +6.9% | **33.0 / 50.0 / +51.5%** | **32.2 / 36.3 / +12.7%** | **31.5 / 36.2 / +15.0%** | **31.4 / 36.2 / +15.1%** |
| lum_p50 | 89.4 / 90.1 / +0.8% | **70.5 / 83.4 / +18.2%** | **51.8 / 63.2 / +22.1%** | **50.8 / 62.2 / +22.4%** | **50.8 / 62.2 / +22.4%** |
| lum_p95 | 91.6 / 90.4 / -1.3% | 95.3 / 97.3 / +2.1% | 92.7 / 95.1 / +2.6% | 91.2 / 91.7 / +0.5% | 90.8 / 91.7 / +1.0% |
| lum_p99 | 91.6 / 90.4 / -1.3% | 98.5 / 97.9 / -0.6% | 97.8 / 97.0 / -0.9% | 96.2 / 95.5 / -0.8% | 96.2 / 95.4 / -0.8% |
| lum_mean | 88.6 / 89.9 / +1.4% | **67.0 / 75.1 / +12.0%** | **57.2 / 63.6 / +11.2%** | 56.1 / 61.2 / +9.1% | 56.1 / 61.2 / +9.1% |
| pct_above_90 | **38.4 / 53.5 / +39.3%** | **10.5 / 29.4 / +180.7%** | **8.1 / 15.0 / +84.0%** | 6.4 / 7.1 / +9.8% | 6.4 / 6.9 / +9.0% |
| pct_below_5 | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% |
| sat_mean | **16.0 / 12.4 / -22.3%** | **30.7 / 22.9 / -25.4%** | **41.6 / 32.7 / -21.4%** | **42.9 / 34.9 / -18.6%** | **43.0 / 35.0 / -18.7%** |
| chroma_mean | **14.9 / 11.7 / -21.4%** | **20.8 / 16.7 / -19.6%** | **26.0 / 21.0 / -19.0%** | **26.7 / 22.2 / -16.8%** | **26.7 / 22.2 / -16.9%** |
| hue_shadows | 191.1 / 193.3 / +2.2 deg | 200.3 / 197.5 / -2.7 deg | 199.6 / 197.6 / -1.9 deg | 199.4 / 197.3 / -2.1 deg | 199.3 / 197.2 / -2.1 deg |
| hue_midtones | 191.2 / 199.6 / +8.4 deg | 196.4 / 195.7 / -0.8 deg | 199.3 / 196.7 / -2.6 deg | 199.1 / 196.3 / -2.8 deg | 199.1 / 196.0 / -3.1 deg |
| hue_highlights | 191.9 / 193.8 / +1.9 deg | 191.9 / 193.9 / +2.0 deg | 196.8 / 194.8 / -2.0 deg | 197.0 / 192.6 / -4.4 deg | 196.5 / 192.0 / -4.5 deg |
| glow_r50 | **41.9 / 26.4 / -37.0%** | **22.0 / 3.8 / -82.8%** | **2.7 / 4.6 / +66.7%** | **4.7 / 13.2 / +180.6%** | **4.7 / 13.2 / +180.6%** |
| glow_r25 | **48.4 / 68.8 / +41.9%** | **101.4 / 68.2 / -32.7%** | **42.7 / 95.8 / +124.4%** | **102.6 / 68.4 / -33.4%** | **102.6 / 68.4 / -33.4%** |
| glow_r10 | **50.8 / 71.6 / +41.0%** | **102.0 / 71.1 / -30.3%** | **107.4 / 95.8 / -10.8%** | **106.8 / 78.6 / -26.3%** | **106.9 / 78.6 / -26.4%** |
| contrast_top | **9.4 / 1.5 / -83.7%** | **53.2 / 42.5 / -20.1%** | 57.4 / 59.4 / +3.5% | **56.0 / 49.5 / -11.6%** | **56.0 / 49.5 / -11.7%** |
| contrast_mid | **4.5 / 1.5 / -67.1%** | **63.4 / 47.0 / -25.9%** | 59.6 / 58.0 / -2.7% | 60.2 / 55.9 / -7.1% | 60.2 / 55.9 / -7.1% |
| contrast_bot | **8.9 / 1.5 / -82.8%** | **65.7 / 51.3 / -21.9%** | **66.8 / 50.8 / -23.9%** | **64.7 / 50.3 / -22.1%** | **64.7 / 50.4 / -22.1%** |
| haze_far_near_contrast | 1.1 / 1.0 / -5.3% | 0.8 / 0.8 / +2.3% | **0.9 / 1.2 / +36.0%** | **0.9 / 1.0 / +13.5%** | **0.9 / 1.0 / +13.4%** |
| grain_flat_std | 0.0 / 0.5 / +574701.4% | 1.2 / 0.5 / -57.9% | 0.9 / 1.1 / +17.6% | 0.8 / 1.2 / +44.6% | 0.9 / 1.2 / +39.5% |
| detail_laplacian_var | 0.1 / 0.2 / +157.9% | **166.7 / 122.1 / -26.7%** | **173.6 / 210.2 / +21.1%** | **215.3 / 170.1 / -21.0%** | **246.4 / 172.7 / -29.9%** |
| detail_fine | 0.7 / 1.0 / +34.6% | **36.3 / 31.8 / -12.6%** | 38.5 / 39.1 / +1.5% | **41.8 / 35.0 / -16.2%** | **43.3 / 35.2 / -18.7%** |
| detail_medium | 0.9 / 0.7 / -20.1% | 60.2 / 61.0 / +1.3% | 71.0 / 67.0 / -5.6% | **75.4 / 58.9 / -21.8%** | **75.6 / 59.0 / -22.0%** |
| detail_coarse | 1.5 / 0.8 / -44.5% | **84.8 / 75.4 / -11.1%** | **94.6 / 75.9 / -19.8%** | **90.7 / 70.6 / -22.1%** | **90.6 / 70.6 / -22.1%** |
| vignette_corner_centre | **0.9 / 1.0 / +10.6%** | **1.0 / 0.9 / -11.4%** | 0.8 / 0.8 / +4.7% | 0.8 / 0.7 / -4.6% | 0.8 / 0.7 / -4.6% |

58 of 130 compared cells within target, 72 outside.

**04-V2-city-growth** (cells: reference / ours / difference; **bold** = outside target)

| measure | f0 | f112 | f225 | f337 | f449 |
|---|---|---|---|---|---|
| lum_p1 | **78.8 / 88.4 / +12.2%** | **26.2 / 47.9 / +82.4%** | **25.7 / 35.8 / +39.3%** | **26.5 / 35.8 / +35.3%** | **26.4 / 35.8 / +35.7%** |
| lum_p5 | 83.2 / 89.0 / +6.9% | **33.0 / 50.3 / +52.4%** | **32.2 / 36.3 / +12.7%** | **31.5 / 36.3 / +15.2%** | **31.4 / 36.3 / +15.4%** |
| lum_p50 | 89.4 / 89.8 / +0.5% | **70.5 / 89.0 / +26.2%** | **51.8 / 74.6 / +44.1%** | **50.8 / 63.6 / +25.2%** | **50.8 / 60.7 / +19.5%** |
| lum_p95 | 91.6 / 90.4 / -1.3% | 95.3 / 97.5 / +2.3% | 92.7 / 96.0 / +3.5% | 91.2 / 89.5 / -1.9% | 90.8 / 88.5 / -2.5% |
| lum_p99 | 91.6 / 90.4 / -1.3% | 98.5 / 98.0 / -0.5% | 97.8 / 97.2 / -0.6% | 96.2 / 94.7 / -1.5% | 96.2 / 94.7 / -1.5% |
| lum_mean | 88.6 / 89.8 / +1.4% | **67.0 / 81.2 / +21.1%** | **57.2 / 71.0 / +24.1%** | **56.1 / 62.2 / +10.8%** | 56.1 / 60.1 / +7.2% |
| pct_above_90 | **38.4 / 49.3 / +28.2%** | **10.5 / 34.0 / +224.6%** | **8.1 / 23.2 / +185.7%** | **6.4 / 4.6 / -27.8%** | **6.4 / 4.1 / -35.6%** |
| pct_below_5 | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% |
| sat_mean | **16.0 / 12.5 / -22.1%** | **30.7 / 17.9 / -41.8%** | **41.6 / 27.0 / -35.2%** | **42.9 / 34.5 / -19.7%** | **43.0 / 36.5 / -15.1%** |
| chroma_mean | **14.9 / 11.8 / -21.2%** | **20.8 / 14.1 / -32.2%** | **26.0 / 18.9 / -27.1%** | **26.7 / 22.6 / -15.2%** | **26.7 / 23.6 / -11.5%** |
| hue_shadows | 191.1 / 193.4 / +2.3 deg | 200.3 / 197.3 / -3.0 deg | 199.6 / 198.1 / -1.5 deg | 199.4 / 197.6 / -1.8 deg | 199.3 / 197.7 / -1.7 deg |
| hue_midtones | 191.2 / 199.6 / +8.4 deg | 196.4 / 194.1 / -2.3 deg | 199.3 / 195.0 / -4.4 deg | 199.1 / 196.0 / -3.2 deg | 199.1 / 196.4 / -2.7 deg |
| hue_highlights | 191.9 / 193.8 / +1.9 deg | 191.9 / 192.8 / +0.9 deg | 196.8 / 194.4 / -2.4 deg | 197.0 / 192.0 / -5.0 deg | 196.5 / 192.4 / -4.0 deg |
| glow_r50 | 41.9 / 54.6 / skipped | 22.0 / 69.4 / skipped | 2.7 / 46.5 / skipped | 4.7 / 40.6 / skipped | 4.7 / 2.7 / skipped |
| glow_r25 | 48.4 / 63.7 / skipped | 101.4 / 71.6 / skipped | 42.7 / 90.9 / skipped | 102.6 / 60.0 / skipped | 102.6 / 85.5 / skipped |
| glow_r10 | 50.8 / 71.0 / skipped | 102.0 / 72.5 / skipped | 107.4 / 91.7 / skipped | 106.8 / 64.1 / skipped | 106.9 / 86.8 / skipped |
| contrast_top | 9.4 / 1.5 / skipped | 53.2 / 46.3 / skipped | 57.4 / 59.7 / skipped | 56.0 / 50.1 / skipped | 56.0 / 49.1 / skipped |
| contrast_mid | 4.5 / 1.5 / skipped | 63.4 / 46.3 / skipped | 59.6 / 44.9 / skipped | 60.2 / 42.2 / skipped | 60.2 / 47.3 / skipped |
| contrast_bot | 8.9 / 1.5 / skipped | 65.7 / 47.9 / skipped | 66.8 / 48.2 / skipped | 64.7 / 46.3 / skipped | 64.7 / 46.5 / skipped |
| haze_far_near_contrast | 1.1 / 1.0 / skipped | 0.8 / 1.0 / skipped | 0.9 / 1.2 / skipped | 0.9 / 1.1 / skipped | 0.9 / 1.1 / skipped |
| grain_flat_std | 0.0 / 0.4 / +405932.6% | 1.2 / 0.5 / -54.5% | 0.9 / 1.1 / +22.5% | 0.8 / 1.1 / +32.6% | 0.9 / 1.1 / +27.9% |
| detail_laplacian_var | 0.1 / 0.2 / +173.6% | **166.7 / 126.5 / -24.1%** | **173.6 / 191.3 / +10.2%** | **215.3 / 135.7 / -37.0%** | **246.4 / 171.8 / -30.3%** |
| detail_fine | 0.7 / 1.0 / +40.1% | **36.3 / 32.1 / -11.6%** | 38.5 / 40.5 / +5.0% | **41.8 / 34.7 / -17.1%** | **43.3 / 36.8 / -15.2%** |
| detail_medium | 0.9 / 0.8 / -13.5% | 60.2 / 64.0 / +6.3% | 71.0 / 74.7 / +5.2% | **75.4 / 61.2 / -18.8%** | **75.6 / 61.2 / -19.0%** |
| detail_coarse | 1.5 / 0.7 / -50.3% | 84.8 / 78.3 / -7.6% | **94.6 / 75.4 / -20.4%** | **90.7 / 67.1 / -26.1%** | **90.6 / 67.1 / -26.0%** |
| vignette_corner_centre | 0.9 / 1.0 / skipped | 1.0 / 1.0 / skipped | 0.8 / 0.8 / skipped | 0.8 / 0.7 / skipped | 0.8 / 0.8 / skipped |

47 of 90 compared cells within target, 43 outside.

**Reading the look-over-time table.** White level and the absence of grain hold from first frame to last, and nothing flickers (see check 4). Outside target after the 8B fix passes: mid-tones and lower-third black levels are brighter than the reference, near-white area is larger early on, saturation is lower; the glow radii are not meaningful on a high-key frame (see above). Version 2 additionally differs in everything that depends on framing.

### Step 8A - technical checks

| # | check | 03-V1-city-growth.mp4 | 04-V2-city-growth.mp4 | result |
|---|---|---|---|---|
| 1 | Specs (1920x1080, h264, yuv420p, 30/1, 450 frames, no audio) | 1920x1080, h264, yuv420p, 30/1 fps, 450 frames, streams: 1 video | 1920x1080, h264, yuv420p, 30/1 fps, 450 frames, streams: 1 video | PASS |
| 2 | Duration = reference within one frame (33.3 ms) | 15.000000 s (reference 15.000000 s, diff 0.0 ms) | 15.000000 s (reference 15.000000 s, diff 0.0 ms) | PASS |
| 3 | Integrity (`ffmpeg -v error -i f -f null -`) | no decode errors | no decode errors | PASS |
| 4 | Frame scan (all 450 frames) + contact sheet | mean brightness 156-229/255, near-black frames: 0, frozen runs (first-last frame): [[347, 350], [351, 449]], largest brightness jump 1.47/255 at frame 112, largest frame difference 4.80/255 | mean brightness 152-229/255, near-black frames: 0, frozen runs (first-last frame): none, largest brightness jump 0.71/255 at frame 112, largest frame difference 10.93/255 | PASS |
| 5 | Loop | n/a - the reference does not loop | n/a | n/a |
| 6 | Determinism (cold-start frame = same frame in a full render, byte for byte) | cold still of frame 225 = frame 225 of a continuous 41-frame render (205-245, `--concurrency=2`): identical files (sha256 c12584c88d808922bdc4...). Two separate continuous 41-frame renders: 0 of 41 frames differ. MP4 frame 225 vs the cold PNG: PSNR 43.9 dB (H.264 loss only) | cold still of frame 225 = frame 225 of a continuous 41-frame render: identical files (sha256 202bc19b921e8f1b6a17...). MP4 frame 225 vs the cold PNG: PSNR 43.2 dB | PASS |
| 7 | Look over time | see table above | see table above | PARTIAL (hue and white level hold; mid-tones brighter and detail softer than the reference, see notes) |
| 8 | Banding / artefacts (levels x4) | frame 0 (empty opening ground, full frame) viewed at x4: faint concentric single-code-value contours of the vignette are visible; not visible at normal levels | frame 0 viewed at x4: the same faint contours | PASS with a note (contours only at x4) |
| 9 | ZIP test (fresh folder, `npm ci`, one 4K frame per composition) | `npm ci` 9 s, 0 vulnerabilities; `npx remotion still V1-city-growth out/V1-frame.png --frame=225 --scale=1 --gl=angle` -> 3840x2160 PNG, 19.9 s | `npx remotion still V2-city-growth out/V2-frame.png --frame=225 --scale=1 --gl=angle` -> 3840x2160 PNG, 21.8 s | PASS |

Notes on the checks:
- **Check 4, frozen runs.** Any frozen run in V1 is the end hold: the reference is static from frame ~345 to 449 and our camera also stops at frame 345 (11.5 s). V2 keeps moving by design. No black or blank frames (the first frames are the empty pale ground, as in the reference).
- **Check 6, method.** The MP4 is lossy, so the byte comparison is made on the PNG frames Remotion produces before encoding: a cold-start `remotion still` of the middle frame against the same frame taken from a continuous 41-frame render (frames 205-245, two tabs), not from the full 450-frame render.
- **Check 6, a bug found and fixed earlier.** The very first set of finals was not reproducible (19 of 41 frames differed between identical runs, up to 8/255 in up to 16 pixels) because the ground shader used `fwidth()` of the Voronoi edge distance, which is built in a data-dependent loop. It now uses `fwidth()` of the interpolated world position; thin boxes and coplanar streets were also removed as possible depth ties. All later renders, including the delivered ones, pass the check.
- **Check 8.** Scene and bloom targets are half-float; the final pass adds a +-1/255 dither. Since 8B round 1 the dither is a fixed pattern and the vignette is weaker (weaker again in round 2). On the empty opening ground the single-code-value steps of the vignette are still faintly visible at x4 after H.264 (CRF 16); they are not visible at normal levels. See `banding/` for the x4 crops of the delivered files.

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

### Step 8B round 2 (two fresh sub-agents, frames 45 / 225 / 449) and what changed - last fix pass

**V1 notes received:** 1 scale/density: reference shows hundreds of small buildings with the tallest towers 100-130 px high at 768x432 from a high, far camera; ours showed a third as many with towers 200-300 px, cropped by the frame ("toy block cluster"); 2 palette: reference desaturated cyan-teal (near-white low buildings, pale aqua glass, pale ground with faint green), ours saturated azure towers, mid-grey low buildings, strong turquoise ground; 3 roads near-black straight grid with prominent dashes instead of mid-grey without obvious markings; 4 opening cluster twice too large, towers cut off, roads crossing the whole frame, one tower already glass-filled, dark curved corners; 5 everything built at frame 225 and a noticeable late pull-back, where the reference still has unbuilt lots at the far coast and barely drifts; 6 water should be a muted dark teal-slate in the top 15-25 %; 7 (optional) wireframes dissolving upward, scattered Voronoi patches, glass with bright rims and darker caps. Instruction: no more blur - fix the crisp impression with scale, density, lower edge contrast and haze, and pull softness back.

**V2 notes received** (camera change clearly visible: yes; same concept and quality: no): a stray thin white spike at the top centre of frame 449; too much dark background (20 % at 225, 35 % at 449) and wide gaps between buildings; opening too large with roads to all edges and a solid blue tower; same palette / road / glass notes as V1.

**Changed:**
- Scale and density (V1 1, V2 b): street spacing 2.6-3.8 -> 2.0-2.9 units and up to 3x3 lots per block, so roughly twice as many buildings; both cameras raised and pulled back (V1 settles at distance 50.5 instead of 41, V2 ends at 43 and 30 deg instead of 39 and 23 deg) and V2 now tracks the island centre so the city fills the frame.
- Palette (V1 2, V2 d): saturation boost removed, glass emission moved from azure to pale aqua with weaker stripes, brighter rims and darker caps, low-rise roofs near white, ground a pale grey-green instead of turquoise.
- Roads (V1 3): mature streets mid-grey; the dashed centre lines are fainter and fade out as a street ages, so they only read in the opening.
- Opening (V1 4, V2 c): smaller framing (distance 35-37), the street front advances half as fast in the first two seconds so only the centre has streets at frame 45, core towers start 0.2 s later with a longer wireframe lead (no glass fill at frame 45), weaker vignette. The "dark curved corners" were water: the surroundings now start as the same pale ground and darken into water between 2.0 and 4.2 s (`waterReveal`), as the reference does.
- Timing (V1 5): the building front reaches the far coast at about 10.6 s instead of 9.1 s, so the far blocks are still empty plates at frame 225; the late camera move is reduced to a slight drift that stops at 11.5 s.
- Water (V1 6): muted teal-slate again (scene-linear 0.045 / 0.068 / 0.08), no gradient.
- Softness: pulled back from 0.75 to 0.4 with the smaller kernel, as instructed.
- V2 spike (V2 a): it was the bridge of the elevated road running straight away from the camera to the horizon; the V2 move now ends at azimuth 74 deg instead of 30 deg, so the bridge leaves the frame diagonally at the top left.
- Not done in this pass (also listed under "not matched"): curving streets, wireframes dissolving upward into dotted streaks, Voronoi cells scattered in patches along the streets.

### Render times

| Output | Per frame | Whole video (450 frames) |
|---|---|---|
| 1080p, the delivered files (`--concurrency=2`, 4-core machine, software GL) | 3.1 s (V1), 3.2 s (V2) | 23 min 02 s (V1), 24 min 02 s (V2) |
| 4K (`--scale=1`), estimated as 4x the pixels of the 1080p figure | about 12 s | about 92 min |
| 4K single cold still (includes bundling and browser start-up), measured in the ZIP test | 19.9 s / 21.8 s | |

All on a 4-core cloud machine with software GL (SwiftShader); a GPU machine will be many times faster. Earlier builds took 13 min (idle machine) to 28 min (shared) per 1080p video.

### ZIP test

`deliverables/city-growth-project.zip` (about 680 KB, 464 files): `src/` with both 4K compositions and `LookDev`, `package.json` + `package-lock.json` (exact versions), `remotion.config.ts`, `tsconfig.json`, eslint/prettier config, `scripts/`, `lookdev/measure-*.json`, `README.md`, the installed agent skills (`.agents/`, `skills-lock.json`). Left out: `node_modules`, `.git`, `out/`, the reference clip, the `.claude` symlink folder, and the `lookdev/compare-*.png` side-by-sides (they contain reference frames; they are in `deliverables/qc/B/lookdev/` instead). The project has no fonts, models or textures.

Test: extracted into a fresh folder, `npm ci` (9 s, 0 vulnerabilities), then the README's single-frame 4K commands for both compositions. Both produced a 3840x2160 PNG (mean brightness 161.8 and 180.1 of 255); log in `checks/zip-test.log`. Result: **PASS**.

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
- **8B round 2 leftovers.** Curving streets (ours is a bent grid of straight segments), wireframes that dissolve upward into vertical dotted streaks, and Voronoi cells scattered in irregular patches along the streets instead of a ring at the growth front. Mid-tones are still brighter than the reference measures and saturation is lower (see the look tables).
