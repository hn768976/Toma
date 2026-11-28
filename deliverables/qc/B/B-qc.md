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
- **Version 2 choice: a different camera movement.** The reference is defined by its restrained palette (changing it would fight the look that was just matched) and its camera stays at a similar distance throughout, so the move is the element that can change most visibly while the design stays identical. V2 starts as a straight-down plan view (the streets spread like a map), then cranes down and orbits the opposite way into a low three-quarter view across the skyline, still moving at the end.
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

**start (frame 45)** - 21 measures within target, 13 outside (lum_p1, pct_above_90, glow_r50, glow_r25, glow_r10, contrast_top, black_top, contrast_mid, contrast_bot, black_bot, haze_far_near_contrast, detail_laplacian_var, detail_fine). Side-by-side: `lookdev/compare-start.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 40.28 | 45.99 | +14.2% | FAIL |
| lum_p5 | 62.26 | 64.62 | +3.8% | PASS |
| lum_p50 | 88.51 | 87.98 | -0.6% | PASS |
| lum_p95 | 97.65 | 97.82 | +0.2% | PASS |
| lum_p99 | 98.39 | 98.27 | -0.1% | PASS |
| lum_mean | 85.91 | 86.32 | +0.5% | PASS |
| pct_above_90 | 31.15 | 24.45 | -21.5% | FAIL |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 16.26 | 16.96 | +4.3% | PASS |
| chroma_mean | 14.41 | 15.18 | +5.3% | PASS |
| hue_shadows | 194.14 | 195.01 | +0.9 deg | PASS |
| hue_midtones | 191.33 | 194.34 | +3.0 deg | PASS |
| hue_highlights | 193.87 | 194.78 | +0.9 deg | PASS |
| glow_peak | 98.14 | 98.16 | +0.0% | PASS |
| glow_peak_x | 23.57 | 44.79 | n/a | info |
| glow_peak_y | 77.78 | 78.01 | n/a | info |
| glow_r50 | 11.33 | 22.79 | +101.1% | FAIL |
| glow_r25 | 86.07 | 69.53 | -19.2% | FAIL |
| glow_r10 | 87.50 | 69.66 | -20.4% | FAIL |
| contrast_top | 9.70 | 25.23 | +160.0% | FAIL |
| black_top | 80.85 | 65.41 | -19.1% | FAIL |
| mean_top | 87.35 | 85.71 | -1.9% | PASS |
| contrast_mid | 32.67 | 38.94 | +19.2% | FAIL |
| black_mid | 64.95 | 58.97 | -9.2% | PASS |
| mean_mid | 86.26 | 84.84 | -1.6% | PASS |
| contrast_bot | 46.59 | 31.89 | -31.6% | FAIL |
| black_bot | 51.45 | 66.10 | +28.5% | FAIL |
| mean_bot | 84.17 | 88.19 | +4.8% | PASS |
| haze_far_near_contrast | 0.21 | 0.79 | +280.0% | FAIL |
| grain_flat_std | 0.38 | 1.28 | +237.4% | PASS |
| grain_global_std | 22.44 | 23.61 | +5.2% | PASS |
| detail_laplacian_var | 37.48 | 54.14 | +44.5% | FAIL |
| detail_fine | 16.98 | 19.10 | +12.4% | FAIL |
| detail_medium | 25.50 | 24.17 | -5.2% | PASS |
| detail_coarse | 41.72 | 42.18 | +1.1% | PASS |
| vignette_corner_centre | 1.04 | 1.03 | -1.0% | PASS |

**peak (frame 112)** - 25 measures within target, 9 outside (pct_above_90, sat_mean, chroma_mean, glow_r50, glow_r25, glow_r10, contrast_top, mean_top, mean_bot). Side-by-side: `lookdev/compare-peak.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 26.25 | 25.72 | -2.0% | PASS |
| lum_p5 | 33.01 | 33.66 | +1.9% | PASS |
| lum_p50 | 70.49 | 68.30 | -3.1% | PASS |
| lum_p95 | 95.29 | 95.12 | -0.2% | PASS |
| lum_p99 | 98.50 | 97.07 | -1.4% | PASS |
| lum_mean | 67.04 | 67.28 | +0.4% | PASS |
| pct_above_90 | 10.49 | 17.45 | +66.4% | FAIL |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 30.71 | 35.60 | +15.9% | FAIL |
| chroma_mean | 20.83 | 24.46 | +17.4% | FAIL |
| hue_shadows | 200.27 | 198.48 | -1.8 deg | PASS |
| hue_midtones | 196.45 | 197.32 | +0.9 deg | PASS |
| hue_highlights | 191.89 | 193.90 | +2.0 deg | PASS |
| glow_peak | 100.00 | 97.47 | -2.5% | PASS |
| glow_peak_x | 3.39 | 66.28 | n/a | info |
| glow_peak_y | 65.28 | 25.93 | n/a | info |
| glow_r50 | 22.01 | 3.91 | -82.2% | FAIL |
| glow_r25 | 101.43 | 78.12 | -23.0% | FAIL |
| glow_r10 | 101.95 | 78.12 | -23.4% | FAIL |
| contrast_top | 53.19 | 60.53 | +13.8% | FAIL |
| black_top | 37.06 | 33.74 | -9.0% | PASS |
| mean_top | 76.01 | 67.49 | -11.2% | FAIL |
| contrast_mid | 63.41 | 59.00 | -7.0% | PASS |
| black_mid | 34.34 | 36.62 | +6.6% | PASS |
| mean_mid | 67.20 | 68.58 | +2.1% | PASS |
| contrast_bot | 65.66 | 67.61 | +3.0% | PASS |
| black_bot | 28.49 | 27.37 | -3.9% | PASS |
| mean_bot | 57.93 | 65.99 | +13.9% | FAIL |
| haze_far_near_contrast | 0.81 | 0.90 | +10.5% | PASS |
| grain_flat_std | 1.19 | 1.16 | -2.3% | PASS |
| grain_global_std | 49.30 | 49.94 | +1.3% | PASS |
| detail_laplacian_var | 166.73 | 150.75 | -9.6% | PASS |
| detail_fine | 36.35 | 35.78 | -1.6% | PASS |
| detail_medium | 60.24 | 65.64 | +9.0% | PASS |
| detail_coarse | 84.78 | 90.66 | +6.9% | PASS |
| vignette_corner_centre | 1.00 | 0.91 | -8.6% | PASS |

**settled (frame 337)** - 28 measures within target, 6 outside (lum_p50, glow_r50, glow_r25, glow_r10, mean_top, detail_laplacian_var). Side-by-side: `lookdev/compare-settled.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 26.47 | 27.09 | +2.3% | PASS |
| lum_p5 | 31.49 | 32.06 | +1.8% | PASS |
| lum_p50 | 50.85 | 56.70 | +11.5% | FAIL |
| lum_p95 | 91.23 | 91.61 | +0.4% | PASS |
| lum_p99 | 96.23 | 93.96 | -2.4% | PASS |
| lum_mean | 56.14 | 57.81 | +3.0% | PASS |
| pct_above_90 | 6.43 | 7.32 | +13.9% | PASS |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 42.91 | 42.63 | -0.6% | PASS |
| chroma_mean | 26.68 | 27.43 | +2.8% | PASS |
| hue_shadows | 199.40 | 198.79 | -0.6 deg | PASS |
| hue_midtones | 199.13 | 198.36 | -0.8 deg | PASS |
| hue_highlights | 197.03 | 195.56 | -1.5 deg | PASS |
| glow_peak | 97.94 | 94.01 | -4.0% | PASS |
| glow_peak_x | 0.00 | 31.51 | n/a | info |
| glow_peak_y | 91.44 | 57.87 | n/a | info |
| glow_r50 | 4.69 | 2.34 | -50.0% | FAIL |
| glow_r25 | 102.60 | 69.79 | -32.0% | FAIL |
| glow_r10 | 106.77 | 71.74 | -32.8% | FAIL |
| contrast_top | 56.03 | 57.00 | +1.7% | PASS |
| black_top | 33.06 | 33.71 | +2.0% | PASS |
| mean_top | 50.86 | 56.59 | +11.3% | FAIL |
| contrast_mid | 60.17 | 60.35 | +0.3% | PASS |
| black_mid | 31.60 | 31.57 | -0.1% | PASS |
| mean_mid | 59.05 | 59.13 | +0.1% | PASS |
| contrast_bot | 64.66 | 62.54 | -3.3% | PASS |
| black_bot | 28.41 | 29.25 | +2.9% | PASS |
| mean_bot | 58.97 | 57.91 | -1.8% | PASS |
| haze_far_near_contrast | 0.87 | 0.91 | +5.2% | PASS |
| grain_flat_std | 0.81 | 1.17 | +44.6% | PASS |
| grain_global_std | 58.46 | 59.04 | +1.0% | PASS |
| detail_laplacian_var | 215.30 | 240.43 | +11.7% | FAIL |
| detail_fine | 41.82 | 42.63 | +1.9% | PASS |
| detail_medium | 75.36 | 73.26 | -2.8% | PASS |
| detail_coarse | 90.73 | 91.66 | +1.0% | PASS |
| vignette_corner_centre | 0.77 | 0.71 | -7.1% | PASS |

**Reading the look-dev numbers.** Hue is within 1-6 deg of the reference in all three bands on all three stills, the black level (lum_p1/p5) and white level (lum_p95/p99) are within target on the peak and settled stills, and the settled still passes 30 of 36 measures. What stays outside:
- `glow_r50/r25/r10` on every still. The measure walks outward from the single brightest spot; in a frame that is 60-90 % bright everywhere the profile never falls to 25 %/10 % in the reference (it reports the frame diagonal), so the value depends on where the brightest roof happens to sit, not on bloom. Bloom was matched by eye instead (tight, low strength).
- `pct_above_90`: ours has 5-7 points fewer near-white pixels on the start still and more on the peak still; this is how much white ground is in frame (layout/framing), the white level itself (p95/p99) matches.
- start still: `contrast_top`, `black_top`, `contrast_bot`, `black_bot`, `haze_far_near_contrast` - the reference frame has an empty top third and its only dark element (the ghost cluster and streets) sits in the lower half; ours places the ghost towers higher in frame and a corner of water is in view, so the per-third statistics differ although exposure and colour match.
- settled still: `lum_p50` 56.7 vs 50.8 and `mean_top` - our roofs and ground are a little lighter and there is slightly less water in the top third. `detail_laplacian_var` 241 vs 215 (12 % crisper; the reference is a 432p stock preview).

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

## Finals

### Look over time (step 8A.7): reference vs each video, 5 frames

Frames 0, 112, 225, 337, 449 of each video (scaled to 768x432) against the same reference frames. For Version 2 the measures its camera change affects (haze thirds, glow position/falloff, vignette corners) are skipped.

**03-V1-city-growth** (cells: reference / ours / difference; **bold** = outside target)

| measure | f0 | f112 | f225 | f337 | f449 |
|---|---|---|---|---|---|
| lum_p1 | 78.8 / 84.4 / +7.2% | 26.2 / 25.3 / -3.6% | 25.7 / 26.1 / +1.7% | 26.5 / 26.6 / +0.4% | 26.4 / 26.5 / +0.5% |
| lum_p5 | 83.2 / 84.6 / +1.7% | 33.0 / 33.2 / +0.7% | 32.2 / 30.9 / -4.0% | 31.5 / 31.6 / +0.4% | 31.4 / 31.6 / +0.6% |
| lum_p50 | 89.4 / 88.9 / -0.5% | 70.5 / 67.8 / -3.8% | 51.8 / 54.9 / +6.0% | **50.8 / 56.3 / +10.6%** | **50.8 / 56.2 / +10.7%** |
| lum_p95 | 91.6 / 90.4 / -1.3% | 95.3 / 94.6 / -0.7% | 92.7 / 91.7 / -1.1% | 91.2 / 91.2 / -0.0% | 90.8 / 91.1 / +0.4% |
| lum_p99 | 91.6 / 90.4 / -1.3% | 98.5 / 96.7 / -1.9% | 97.8 / 94.0 / -3.9% | 96.2 / 93.7 / -2.6% | 96.2 / 93.7 / -2.6% |
| lum_mean | 88.6 / 88.2 / -0.4% | 67.0 / 66.8 / -0.3% | 57.2 / 57.1 / -0.2% | 56.1 / 57.4 / +2.2% | 56.1 / 57.3 / +2.2% |
| pct_above_90 | **38.4 / 17.1 / -55.4%** | **10.5 / 16.8 / +59.7%** | 8.1 / 7.8 / -3.8% | 6.4 / 6.7 / +4.0% | 6.4 / 6.7 / +4.4% |
| pct_below_5 | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% |
| sat_mean | 16.0 / 16.1 / +0.7% | **30.7 / 36.0 / +17.3%** | 41.6 / 43.9 / +5.6% | 42.9 / 43.2 / +0.7% | 43.0 / 43.3 / +0.6% |
| chroma_mean | 14.9 / 15.1 / +1.1% | **20.8 / 24.6 / +18.0%** | 26.0 / 27.8 / +7.3% | 26.7 / 27.6 / +3.5% | 26.7 / 27.6 / +3.3% |
| hue_shadows | 191.1 / 193.3 / +2.2 deg | 200.3 / 198.2 / -2.1 deg | 199.6 / 198.5 / -1.1 deg | 199.4 / 198.5 / -0.9 deg | 199.3 / 198.4 / -1.0 deg |
| hue_midtones | 191.2 / 193.1 / +1.9 deg | 196.4 / 197.2 / +0.8 deg | 199.3 / 198.1 / -1.3 deg | 199.1 / 198.2 / -0.9 deg | 199.1 / 198.0 / -1.1 deg |
| hue_highlights | 191.9 / 194.8 / +2.9 deg | 191.9 / 193.6 / +1.7 deg | 196.8 / 195.5 / -1.3 deg | 197.0 / 195.8 / -1.2 deg | 196.5 / 195.3 / -1.2 deg |
| glow_r50 | 41.9 / 40.5 / -3.4% | **22.0 / 3.9 / -82.2%** | 2.7 / 2.7 / +0.0% | **4.7 / 2.2 / -52.8%** | **4.7 / 2.5 / -47.2%** |
| glow_r25 | 48.4 / 50.4 / +4.0% | **101.4 / 78.1 / -23.0%** | **42.7 / 63.0 / +47.6%** | **102.6 / 69.9 / -31.9%** | **102.6 / 69.5 / -32.2%** |
| glow_r10 | **50.8 / 58.9 / +15.9%** | **102.0 / 78.1 / -23.4%** | **107.4 / 78.6 / -26.8%** | **106.8 / 71.9 / -32.7%** | **106.9 / 71.6 / -33.0%** |
| contrast_top | **9.4 / 5.8 / -38.3%** | **53.2 / 60.3 / +13.4%** | 57.4 / 58.7 / +2.2% | 56.0 / 56.7 / +1.3% | 56.0 / 56.7 / +1.2% |
| contrast_mid | 4.5 / 4.9 / +9.3% | 63.4 / 58.8 / -7.3% | 59.6 / 60.9 / +2.1% | 60.2 / 60.3 / +0.3% | 60.2 / 60.4 / +0.3% |
| contrast_bot | **8.9 / 5.8 / -34.9%** | 65.7 / 67.4 / +2.6% | 66.8 / 63.3 / -5.2% | 64.7 / 62.4 / -3.5% | 64.7 / 62.5 / -3.4% |
| haze_far_near_contrast | 1.1 / 1.0 / -5.3% | 0.8 / 0.9 / +10.5% | 0.9 / 0.9 / +7.8% | 0.9 / 0.9 / +4.9% | 0.9 / 0.9 / +4.8% |
| grain_flat_std | 0.0 / 0.4 / +402592.4% | 1.2 / 0.8 / -34.5% | 0.9 / 0.7 / -21.0% | 0.8 / 0.9 / +7.5% | 0.9 / 0.5 / -37.3% |
| detail_laplacian_var | 0.1 / 0.2 / +137.7% | **166.7 / 148.3 / -11.1%** | **173.6 / 239.2 / +37.8%** | 215.3 / 236.5 / +9.9% | 246.4 / 239.7 / -2.7% |
| detail_fine | 0.7 / 1.0 / +32.5% | 36.3 / 35.6 / -2.0% | **38.5 / 43.0 / +11.5%** | 41.8 / 42.4 / +1.5% | 43.3 / 42.6 / -1.7% |
| detail_medium | 0.9 / 0.9 / -5.0% | 60.2 / 65.7 / +9.0% | 71.0 / 75.1 / +5.7% | 75.4 / 73.3 / -2.8% | 75.6 / 73.3 / -3.1% |
| detail_coarse | 1.5 / 1.0 / -29.9% | 84.8 / 90.6 / +6.9% | 94.6 / 93.8 / -0.8% | 90.7 / 91.7 / +1.0% | 90.6 / 91.7 / +1.2% |
| vignette_corner_centre | 0.9 / 0.9 / +5.6% | 1.0 / 0.9 / -8.5% | 0.8 / 0.7 / -6.7% | 0.8 / 0.7 / -7.3% | 0.8 / 0.7 / -7.3% |

106 of 130 compared cells within target, 24 outside.

**04-V2-city-growth** (cells: reference / ours / difference; **bold** = outside target)

| measure | f0 | f112 | f225 | f337 | f449 |
|---|---|---|---|---|---|
| lum_p1 | 78.8 / 84.4 / +7.2% | **26.2 / 33.1 / +26.0%** | **25.7 / 33.6 / +30.8%** | **26.5 / 30.0 / +13.3%** | 26.4 / 28.4 / +7.7% |
| lum_p5 | 83.2 / 84.6 / +1.7% | **33.0 / 38.6 / +16.8%** | 32.2 / 34.6 / +7.6% | 31.5 / 34.5 / +9.5% | 31.4 / 34.5 / +9.7% |
| lum_p50 | 89.4 / 88.8 / -0.7% | **70.5 / 86.1 / +22.2%** | 51.8 / 55.5 / +7.2% | 50.8 / 47.9 / -5.7% | 50.8 / 48.2 / -5.1% |
| lum_p95 | 91.6 / 90.4 / -1.3% | 95.3 / 96.7 / +1.5% | 92.7 / 93.3 / +0.7% | 91.2 / 88.6 / -2.9% | 90.8 / 88.5 / -2.5% |
| lum_p99 | 91.6 / 90.4 / -1.3% | 98.5 / 97.2 / -1.3% | 97.8 / 94.9 / -2.9% | 96.2 / 93.3 / -3.1% | 96.2 / 93.0 / -3.3% |
| lum_mean | 88.6 / 88.2 / -0.4% | **67.0 / 79.6 / +18.8%** | 57.2 / 59.2 / +3.6% | 56.1 / 53.5 / -4.8% | 56.1 / 53.7 / -4.2% |
| pct_above_90 | **38.4 / 15.2 / -60.4%** | **10.5 / 29.9 / +185.6%** | **8.1 / 11.5 / +41.3%** | **6.4 / 4.0 / -38.0%** | **6.4 / 3.9 / -38.8%** |
| pct_below_5 | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% | 0.0 / 0.0 / +0.0% |
| sat_mean | 16.0 / 16.2 / +1.1% | **30.7 / 21.9 / -28.8%** | 41.6 / 38.1 / -8.5% | 42.9 / 43.5 / +1.4% | 43.0 / 45.5 / +5.9% |
| chroma_mean | 14.9 / 15.1 / +1.4% | **20.8 / 16.8 / -19.1%** | **26.0 / 23.3 / -10.1%** | 26.7 / 26.0 / -2.7% | 26.7 / 28.1 / +5.2% |
| hue_shadows | 191.1 / 193.2 / +2.1 deg | 200.3 / 197.3 / -3.0 deg | 199.6 / 196.7 / -2.9 deg | 199.4 / 196.9 / -2.5 deg | 199.3 / 197.1 / -2.2 deg |
| hue_midtones | 191.2 / 193.3 / +2.1 deg | 196.4 / 193.7 / -2.8 deg | 199.3 / 198.5 / -0.8 deg | 199.1 / 198.2 / -0.9 deg | 199.1 / 197.8 / -1.3 deg |
| hue_highlights | 191.9 / 194.6 / +2.7 deg | 191.9 / 193.1 / +1.2 deg | 196.8 / 195.6 / -1.2 deg | 197.0 / 196.6 / -0.4 deg | 196.5 / 196.2 / -0.3 deg |
| glow_r50 | 41.9 / 39.8 / skipped | 22.0 / 81.5 / skipped | 2.7 / 3.4 / skipped | 4.7 / 2.5 / skipped | 4.7 / 3.0 / skipped |
| glow_r25 | 48.4 / 49.0 / skipped | 101.4 / 81.5 / skipped | 42.7 / 72.3 / skipped | 102.6 / 41.3 / skipped | 102.6 / 37.0 / skipped |
| glow_r10 | 50.8 / 53.9 / skipped | 102.0 / 81.5 / skipped | 107.4 / 83.1 / skipped | 106.8 / 52.0 / skipped | 106.9 / 68.0 / skipped |
| contrast_top | 9.4 / 5.8 / skipped | 53.2 / 63.1 / skipped | 57.4 / 57.7 / skipped | 56.0 / 46.5 / skipped | 56.0 / 40.3 / skipped |
| contrast_mid | 4.5 / 4.9 / skipped | 63.4 / 54.6 / skipped | 59.6 / 58.3 / skipped | 60.2 / 54.0 / skipped | 60.2 / 54.7 / skipped |
| contrast_bot | 8.9 / 5.8 / skipped | 65.7 / 57.0 / skipped | 66.8 / 59.7 / skipped | 64.7 / 59.5 / skipped | 64.7 / 60.1 / skipped |
| haze_far_near_contrast | 1.1 / 1.0 / skipped | 0.8 / 1.1 / skipped | 0.9 / 1.0 / skipped | 0.9 / 0.8 / skipped | 0.9 / 0.7 / skipped |
| grain_flat_std | 0.0 / 0.4 / +461273.1% | 1.2 / 1.0 / -18.1% | 0.9 / 0.9 / -0.9% | 0.8 / 0.9 / +12.5% | 0.9 / 0.9 / +9.6% |
| detail_laplacian_var | 0.1 / 0.2 / +149.9% | **166.7 / 111.9 / -32.9%** | **173.6 / 296.2 / +70.6%** | **215.3 / 175.6 / -18.4%** | **246.4 / 168.9 / -31.4%** |
| detail_fine | 0.7 / 1.0 / +35.9% | **36.3 / 32.5 / -10.6%** | **38.5 / 47.3 / +22.8%** | 41.8 / 40.6 / -2.9% | **43.3 / 38.1 / -12.0%** |
| detail_medium | 0.9 / 0.9 / -4.4% | 60.2 / 63.4 / +5.2% | **71.0 / 79.2 / +11.5%** | 75.4 / 68.3 / -9.4% | **75.6 / 63.0 / -16.7%** |
| detail_coarse | 1.5 / 1.0 / -32.9% | 84.8 / 83.8 / -1.1% | **94.6 / 83.1 / -12.2%** | **90.7 / 72.3 / -20.3%** | **90.6 / 70.3 / -22.5%** |
| vignette_corner_centre | 0.9 / 0.9 / skipped | 1.0 / 1.0 / skipped | 0.8 / 0.8 / skipped | 0.8 / 0.8 / skipped | 0.8 / 0.7 / skipped |

64 of 90 compared cells within target, 26 outside.

**Reading the look-over-time table.** Same pattern as the stills: hue, black level and white level hold from the first frame to the last; nothing flickers (largest frame-to-frame mean-brightness change 1.27/255 for V1 and 0.88/255 for V2, see check 4). Outside target: the glow radii (not meaningful on a high-key frame, see above), `pct_above_90` and the per-third means where the amount of white ground / water in frame differs from the reference framing, `sat_mean` at frame 112 (ours has more blue glass in frame at that moment) and `detail_laplacian_var` (ours is crisper than the 432p reference). Version 2 is expected to differ in everything that depends on framing; its hue, white level and grain stay with the reference.

### Step 8A - technical checks

| # | check | 03-V1-city-growth.mp4 | 04-V2-city-growth.mp4 | result |
|---|---|---|---|---|
| 1 | Specs (1920x1080, h264, yuv420p, 30/1, 450 frames, no audio) | 1920x1080, h264, yuv420p, 30/1 fps, 450 frames, streams: 1 video | 1920x1080, h264, yuv420p, 30/1 fps, 450 frames, streams: 1 video | PASS |
| 2 | Duration = reference within one frame (33.3 ms) | 15.000000 s (reference 15.000000 s, diff 0.0 ms) | 15.000000 s (reference 15.000000 s, diff 0.0 ms) | PASS |
| 3 | Integrity (`ffmpeg -v error -i f -f null -`) | no decode errors | no decode errors | PASS |
| 4 | Frame scan (all 450 frames) + contact sheet | mean brightness 144-224/255, near-black frames: 0, frozen runs (first-last frame): [[403, 406], [411, 449]], largest brightness jump 1.27/255 at frame 93, largest frame difference 6.05/255 | mean brightness 133-224/255, near-black frames: 0, frozen runs (first-last frame): none, largest brightness jump 0.88/255 at frame 140, largest frame difference 13.39/255 | PASS |
| 5 | Loop | n/a - the reference does not loop | n/a | n/a |
| 6 | Determinism (cold-start frame = same frame in a full render, byte for byte) | cold still of frame 225 = frame 225 of a continuous 41-frame render (205-245, `--concurrency=2`): identical files (sha256 d9be3b4c5e8b60ad8e7e...). Two separate continuous renders: 0 of 41 frames differ. MP4 frame 225 vs the cold PNG: PSNR 46.3 dB (H.264 loss only) | cold still of frame 225 = frame 225 of a continuous 41-frame render: identical files (sha256 2c4679ca80dd2e597a0b...). MP4 frame 225 vs the cold PNG: PSNR 42.8 dB | PASS |
| 7 | Look over time | see table above | see table above | PARTIAL (see table: hue/black/white level hold; framing-dependent measures differ) |
| 8 | Banding / artefacts (levels x4) | opening ground gradient (frame 0) and water (frame 449) at x4: single 8-bit code-value contours are faintly visible on the empty opening ground, no steps on the water; no aliasing on fine lines, no texture seams | same: faint single-code-value contours on the opening ground at x4, water smooth | PASS with a note (contours only at x4, see below) |
| 9 | ZIP test (fresh folder, `npm ci`, one 4K frame per composition) | `npm ci` 5 s, 0 vulnerabilities; `npx remotion still V1-city-growth out/V1-frame.png --frame=225 --scale=1 --gl=angle` -> 3840x2160 PNG, 10.4 s | `npx remotion still V2-city-growth out/V2-frame.png --frame=225 --scale=1 --gl=angle` -> 3840x2160 PNG, 12.1 s | PASS |

Notes on the checks:
- **Check 4, frozen runs.** V1 is static from frame 411 to 449 (and frames 403-406): this is the end hold. The reference is static from frame ~345 to 449; our camera also stops at frame 345 (11.5 s), the remaining sub-pixel changes until ~410 are the last pads weathering and the far end of the bridge drawing on. V2 has no frozen run (its camera keeps moving, by design). No black or blank frames (the first frames are the empty pale ground, as in the reference: mean 224/255 vs 228/255 in the reference).
- **Check 6, method.** The MP4 is lossy, so the byte comparison is made on the PNG frames Remotion produces before encoding: a cold-start `remotion still` of the middle frame against the same frame taken from a continuous multi-frame render started 20 frames earlier with two tabs.
- **Check 6, a bug found and fixed on the way.** The first set of finals was not reproducible: 19 of 41 frames differed between two identical renders, by up to 8/255 in up to 16 pixels, always on the ground at the frame edge. Cause: the ground shader used `fwidth()` of a value built inside a data-dependent loop (the Voronoi edge distance), whose derivative is not reproducible on this GL implementation. It now derives the pixel footprint from `fwidth()` of the interpolated world position. Two more potential sources of depth ties were removed at the same time (boxes are hidden until they have a real height; streets meeting at a junction sit on separate levels; camera near plane 0.4 -> 2.0). Both finals were re-rendered after the fix; the numbers in this report are from the re-rendered files.
- **Check 8.** Scene and bloom targets are half-float and the final pass adds a +-1/255 dither. On the pre-encode PNG the dither breaks the contours up; H.264 at CRF 16 smooths a per-frame dither on a completely flat area, so at x4 the single-code-value contours of the vignette are faintly visible on the empty opening ground (first ~10 frames). They are not visible at normal levels. A frame-independent dither pattern survives the encoder better (tested on an offline encode) and can be switched in at the next re-render.

Contact sheets (one frame per second): `checks/03-V1-city-growth-contact-sheet.png`, `checks/04-V2-city-growth-contact-sheet.png`. Stretched gradient crops: `banding/`. Raw outputs: `checks/`.

### Match frames for step 8B

`match/ref-<n>.png`, `match/v1-<n>.png`, `match/v2-<n>.png` for n = 0, 45, 112, 225, 337, 449, all 768x432. Frame 0 of the reference is an empty ground, so use **45, 225, 449** as start / middle / end.

### Render times

| Output | Per frame | Whole video (450 frames) |
|---|---|---|
| 1080p, `--concurrency=2`, machine lightly loaded (40-frame test) | about 1.7 s | about 13 min |
| 1080p, the delivered files (rendered while three other renders shared the 4 cores, load ~13) | 3.7 s (V1), 3.4 s (V2) | 27 min 37 s (V1), 25 min 08 s (V2) |
| 4K (`--scale=1`), estimated from the lightly loaded 1080p figure x4 pixels | about 7 s | about 50 min |
| 4K single frames, measured: 18.7 s per extra frame under heavy load (one tab); 10-12 s for a cold single still including browser start-up in the ZIP test | | |

All on a 4-core cloud machine with software GL (SwiftShader); a GPU machine will be many times faster.

### ZIP test

`deliverables/city-growth-project.zip` (681 KB, 463 files): `src/` with both 4K compositions and `LookDev`, `package.json` + `package-lock.json` (exact versions), `remotion.config.ts`, `tsconfig.json`, eslint/prettier config, `scripts/`, `lookdev/measure-*.json`, `README.md`, the installed agent skills (`.agents/`, `skills-lock.json`). Left out: `node_modules`, `.git`, `out/`, the reference clip, the `.claude` symlink folder, and the `lookdev/compare-*.png` side-by-sides (they contain reference frames; they are in `deliverables/qc/B/lookdev/` instead). The project has no fonts, models or textures.

Test: extracted into a fresh folder, `npm ci` (5 s, 0 vulnerabilities), then the README's single-frame 4K commands for both compositions. Both produced a 3840x2160 PNG (mean brightness 143.9 and 149.2 of 255); log in `checks/zip-test.log`. Result: **PASS**.

Unused packages were removed before packaging (`@react-three/drei`, `postprocessing`): the post chain is a small custom one and nothing imports them.

### What could not be matched, and why

- **The exact city.** The layout is an original procedural one, so streets, towers and the elevated roads are not in the same places as in the reference; proportions, density, growth order and timing are matched instead. The reference's hero tower with its stepped crown is replaced by a generic stepped glass tower with a mast.
- **Building detail.** The reference buildings are modelled meshes (setbacks, sloped roofs, facade relief, rooftop plant). Ours are stacked boxes with shader-drawn window bands, roof panels, parapets and a few roof boxes: the same reading at this scale, less variety up close.
- **Glass.** The reference glass is ray-traced-looking (real reflections of neighbours, translucency). Ours fakes it with a gradient, noise streaks and edge highlights; no true reflections or refraction.
- **Ambient occlusion.** The reference has soft contact shadows everywhere. Ours has a soft shadow map plus a height-based wall darkening, but no real AO pass (too slow on software GL), so narrow gaps are a little lighter than in the reference.
- **Glow falloff numbers.** Not matched and not meaningful on these frames (explained under the look tables).
- **Small props.** The cars on the elevated roads and the ramps/junction details of the reference's elevated roads are not reproduced.
- **End hold.** The reference is completely still from 11.5 s; ours is visually still from 11.5 s but the last sub-pixel changes finish at about 13.7 s.
- **Banding at x4** on the first empty frames (see check 8).
