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

**start (frame 45)** - 22 measures within target, 12 outside. `lookdev/compare-start.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 40.28 | 55.05 | +36.7% | FAIL |
| lum_p5 | 62.26 | 63.95 | +2.7% | PASS |
| lum_p50 | 88.51 | 88.56 | +0.1% | PASS |
| lum_p95 | 97.65 | 97.74 | +0.1% | PASS |
| lum_p99 | 98.39 | 98.18 | -0.2% | PASS |
| lum_mean | 85.91 | 87.14 | +1.4% | PASS |
| pct_above_90 | 31.15 | 27.86 | -10.6% | FAIL |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 16.26 | 14.85 | -8.7% | PASS |
| chroma_mean | 14.41 | 13.23 | -8.2% | PASS |
| hue_shadows | 194.14 | 193.82 | -0.3 deg | PASS |
| hue_midtones | 191.33 | 192.75 | +1.4 deg | PASS |
| hue_highlights | 193.87 | 193.01 | -0.9 deg | PASS |
| glow_peak | 98.14 | 98.09 | -0.0% | PASS |
| glow_peak_x | 23.57 | 49.22 | n/a | info |
| glow_peak_y | 77.78 | 80.79 | n/a | info |
| glow_r50 | 11.33 | 61.98 | +447.1% | FAIL |
| glow_r25 | 86.07 | 63.02 | -26.8% | FAIL |
| glow_r10 | 87.50 | 63.54 | -27.4% | FAIL |
| contrast_top | 9.70 | 18.34 | +89.0% | FAIL |
| black_top | 80.85 | 71.85 | -11.1% | FAIL |
| mean_top | 87.35 | 86.68 | -0.8% | PASS |
| contrast_mid | 32.67 | 31.83 | -2.6% | PASS |
| black_mid | 64.95 | 65.91 | +1.5% | PASS |
| mean_mid | 86.26 | 87.62 | +1.6% | PASS |
| contrast_bot | 46.59 | 36.22 | -22.3% | FAIL |
| black_bot | 51.45 | 61.60 | +19.7% | FAIL |
| mean_bot | 84.17 | 87.20 | +3.6% | PASS |
| haze_far_near_contrast | 0.21 | 0.51 | +143.1% | FAIL |
| grain_flat_std | 0.38 | 1.23 | +222.6% | PASS |
| grain_global_std | 22.44 | 21.46 | -4.3% | PASS |
| detail_laplacian_var | 37.48 | 58.95 | +57.3% | FAIL |
| detail_fine | 16.98 | 18.35 | +8.0% | PASS |
| detail_medium | 25.50 | 19.37 | -24.1% | FAIL |
| detail_coarse | 41.72 | 39.94 | -4.3% | PASS |
| vignette_corner_centre | 1.04 | 0.97 | -7.1% | PASS |

**peak (frame 112)** - 20 measures within target, 14 outside. `lookdev/compare-peak.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 26.25 | 24.80 | -5.5% | PASS |
| lum_p5 | 33.01 | 35.25 | +6.8% | PASS |
| lum_p50 | 70.49 | 66.63 | -5.5% | PASS |
| lum_p95 | 95.29 | 96.42 | +1.2% | PASS |
| lum_p99 | 98.50 | 97.65 | -0.9% | PASS |
| lum_mean | 67.04 | 67.80 | +1.1% | PASS |
| pct_above_90 | 10.49 | 18.73 | +78.6% | FAIL |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 30.71 | 35.61 | +16.0% | FAIL |
| chroma_mean | 20.83 | 24.71 | +18.6% | FAIL |
| hue_shadows | 200.27 | 199.94 | -0.3 deg | PASS |
| hue_midtones | 196.45 | 197.61 | +1.2 deg | PASS |
| hue_highlights | 191.89 | 192.24 | +0.4 deg | PASS |
| glow_peak | 100.00 | 97.85 | -2.1% | PASS |
| glow_peak_x | 3.39 | 26.17 | n/a | info |
| glow_peak_y | 65.28 | 37.27 | n/a | info |
| glow_r50 | 22.01 | 17.06 | -22.5% | FAIL |
| glow_r25 | 101.43 | 81.64 | -19.5% | FAIL |
| glow_r10 | 101.95 | 81.64 | -19.9% | FAIL |
| contrast_top | 53.19 | 60.47 | +13.7% | FAIL |
| black_top | 37.06 | 35.56 | -4.0% | PASS |
| mean_top | 76.01 | 68.88 | -9.4% | PASS |
| contrast_mid | 63.41 | 53.80 | -15.2% | FAIL |
| black_mid | 34.34 | 43.46 | +26.6% | FAIL |
| mean_mid | 67.20 | 72.83 | +8.4% | PASS |
| contrast_bot | 65.66 | 65.71 | +0.1% | PASS |
| black_bot | 28.49 | 29.68 | +4.2% | PASS |
| mean_bot | 57.93 | 62.50 | +7.9% | PASS |
| haze_far_near_contrast | 0.81 | 0.92 | +13.6% | FAIL |
| grain_flat_std | 1.19 | 1.23 | +3.3% | PASS |
| grain_global_std | 49.30 | 43.40 | -12.0% | FAIL |
| detail_laplacian_var | 166.73 | 131.70 | -21.0% | FAIL |
| detail_fine | 36.35 | 32.04 | -11.8% | FAIL |
| detail_medium | 60.24 | 54.17 | -10.1% | FAIL |
| detail_coarse | 84.78 | 87.26 | +2.9% | PASS |
| vignette_corner_centre | 1.00 | 0.90 | -9.9% | PASS |

**settled (frame 337)** - 30 measures within target, 4 outside. `lookdev/compare-settled.png`

| measure | reference | ours | difference | status |
|---|---:|---:|---:|---|
| lum_p1 | 26.47 | 25.11 | -5.1% | PASS |
| lum_p5 | 31.49 | 28.61 | -9.1% | PASS |
| lum_p50 | 50.85 | 53.32 | +4.9% | PASS |
| lum_p95 | 91.23 | 92.66 | +1.6% | PASS |
| lum_p99 | 96.23 | 96.51 | +0.3% | PASS |
| lum_mean | 56.14 | 58.46 | +4.1% | PASS |
| pct_above_90 | 6.43 | 7.25 | +12.8% | PASS |
| pct_below_5 | 0.00 | 0.00 | +0.0% | PASS |
| sat_mean | 42.91 | 43.90 | +2.3% | PASS |
| chroma_mean | 26.68 | 28.20 | +5.7% | PASS |
| hue_shadows | 199.40 | 199.42 | +0.0 deg | PASS |
| hue_midtones | 199.13 | 200.52 | +1.4 deg | PASS |
| hue_highlights | 197.03 | 194.16 | -2.9 deg | PASS |
| glow_peak | 97.94 | 97.01 | -1.0% | PASS |
| glow_peak_x | 0.00 | 56.38 | n/a | info |
| glow_peak_y | 91.44 | 15.05 | n/a | info |
| glow_r50 | 4.69 | 4.30 | -8.3% | PASS |
| glow_r25 | 102.60 | 55.08 | -46.3% | FAIL |
| glow_r10 | 106.77 | 64.71 | -39.4% | FAIL |
| contrast_top | 56.03 | 58.03 | +3.6% | PASS |
| black_top | 33.06 | 35.51 | +7.4% | PASS |
| mean_top | 50.86 | 55.99 | +10.1% | FAIL |
| contrast_mid | 60.17 | 65.30 | +8.5% | PASS |
| black_mid | 31.60 | 28.92 | -8.5% | PASS |
| mean_mid | 59.05 | 63.27 | +7.1% | PASS |
| contrast_bot | 64.66 | 64.99 | +0.5% | PASS |
| black_bot | 28.41 | 25.89 | -8.9% | PASS |
| mean_bot | 58.97 | 56.88 | -3.6% | PASS |
| haze_far_near_contrast | 0.87 | 0.89 | +3.0% | PASS |
| grain_flat_std | 0.81 | 1.23 | +52.0% | PASS |
| grain_global_std | 58.46 | 54.24 | -7.2% | PASS |
| detail_laplacian_var | 215.30 | 230.62 | +7.1% | PASS |
| detail_fine | 41.82 | 39.90 | -4.6% | PASS |
| detail_medium | 75.36 | 67.17 | -10.9% | FAIL |
| detail_coarse | 90.73 | 94.74 | +4.4% | PASS |
| vignette_corner_centre | 0.77 | 0.71 | -7.4% | PASS |

