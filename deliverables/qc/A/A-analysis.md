## Reference A → `teal-waves`

**Source:** `1564e7ae-istockphoto-2280468440-640_adpp_is.mp4`, 768×432, H.264, 60 fps, 2252 frames, no audio.
Short name chosen by me (the Inputs lines were left blank): `teal-waves`.

### Duration
- `ffprobe`: **37.533333 s**.
- At 30 fps: `round(37.533333 × 30)` = **1126 frames** = 37.533333 s. Difference from the reference: **0.000 s** (2252 frames at 60 fps is exactly 1126 at 30 fps).
- The reference is 60 fps; many consecutive frames are duplicates (frame-pair correlation 1.00), so its true motion cadence is about 30 fps or lower.

### 2D or 3D
**3D.** The surface is a displaced height field seen from a low, grazing camera with real perspective: crests occlude the troughs behind them, features shrink and compress vertically with distance, near features move faster than far ones (parallax), and blur depends on distance (shallow depth of field). None of that survives a flat 2D treatment.

### Does it loop?
**No.** First and last frame differ strongly (mean absolute difference 39/255). The composition does not loop.

### What it shows
- **Main element:** one continuous dark liquid/silk-like surface filling the frame; no horizon, no sky, no objects, no text or logos (the stock watermark is ignored).
- **Structure:** broad swells, mid-size chop, and many fine, wiry filament ripples that follow the flow and bunch along crests.
- **Colours (sampled by luminance band, three frames):** `#000000` (darkest 5 %), `#010305` (5–40 %), `#091e25` / `#0a222a` (40–60 %), `#235f6b` (60–80 %), `#60afbc` (80–95 %), `#9bd5df` (top 5 %). One hue family, teal to pale cyan, on pure black.
- **Background:** pure black (`lum_p5` = 0.00 in every measured frame; 37–41 % of pixels below 5 % brightness).
- **Motion and timing:** no beats. From the first frame to the last the surface drifts to the right (about 9–12 % of the frame width per second in the focus band, faster in the foreground) while its shape morphs continuously (frame-to-frame correlation falls to 0.73 after 0.5 s). The camera is locked off.

### Light, atmosphere and texture
Measured with `scripts/measure-look.py` on 5 frames (30 fps frames 0, 281, 563, 844, 1125; watermark rectangle masked). Luminance in % of full scale, hue in degrees, radii in % of frame width.

| measure | f0 | f281 | f563 | f844 | f1125 |
|---|---|---|---|---|---|
| lum_p1 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| lum_p5 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| lum_p50 | 9.45 | 10.22 | 11.02 | 12.01 | 11.76 |
| lum_p95 | 74.19 | 70.94 | 72.77 | 75.04 | 75.84 |
| lum_p99 | 81.64 | 79.39 | 80.91 | 83.54 | 81.65 |
| pct_above_90 | 0.01 | 0.00 | 0.00 | 0.01 | 0.00 |
| pct_below_5 | 41.33 | 37.00 | 40.13 | 39.80 | 38.93 |
| sat_mean | 61.58 | 63.88 | 56.62 | 55.58 | 60.07 |
| hue_shadows | 218.69 | 205.09 | 215.49 | 219.79 | 213.44 |
| hue_midtones | 194.32 | 193.74 | 193.98 | 193.74 | 193.62 |
| hue_highlights | 189.31 | 189.55 | 189.44 | 189.32 | 189.11 |
| glow_r50 | 9.77 | 4.82 | 21.61 | 16.54 | 17.19 |
| glow_r25 | 37.11 | 29.17 | 32.55 | 31.90 | 30.47 |
| glow_r10 | 73.96 | 99.87 | 95.44 | 76.56 | 79.17 |
| contrast_top | 77.29 | 72.45 | 72.61 | 77.09 | 77.91 |
| contrast_mid | 61.17 | 58.86 | 55.65 | 58.97 | 57.31 |
| contrast_bot | 16.27 | 17.70 | 21.21 | 25.83 | 28.27 |
| haze_far_near_contrast | 4.75 | 4.09 | 3.42 | 2.98 | 2.76 |
| grain_flat_std | 0.00 | 0.00 | 0.10 | 0.01 | 0.12 |
| detail_laplacian_var | 46.99 | 30.38 | 31.45 | 35.75 | 43.35 |
| vignette_corner_centre | 1.81 | 1.70 | 1.97 | 2.04 | 2.31 |

In words:
- **Light:** one source, behind the scene at the far end, grazing the surface. It never lights a wave face directly; it only catches surfaces seen edge-on, so crests and filaments read as thin rim lines and everything facing the camera is black. Colour is a cold teal-cyan (hue 189–194°), paler in the hottest highlights; the darkest tones lean slightly bluer (205–220°). Highlights stop at about 82–86 % luminance: nothing clips to white.
- **Hardness:** hard and specular in the focus band (lines one or two pixels wide at 432p), soft everywhere else because of defocus, not because of a soft light.
- **Glow:** no separate bloom layer is measurable. The "glow" is the defocused far field: the brightest spot is always in the top band and falls to 25 % within about 30–37 % of the frame width.
- **Haze, fog, dust, rays:** none. Depth is carried by brightness and focus only: the top third averages 45–49 % luminance with contrast 72–78, the middle third 15–18 %, the bottom third 4–5.5 %. The far field's black level is slightly lifted (2–6 %) by defocus, the middle and bottom reach true black.
- **Depth fade:** bright and soft at the top (far), sharp in a band a little above the middle, dark and heavily blurred at the bottom (near).
- **Texture:** no measurable film grain (flat-area high-pass σ ≈ 0.0–0.1 on a 0–1000 scale); what grit there is comes from H.264 compression. Surface detail exists at three scales: swells, chop, hair-fine filaments.
- **Vignette:** no lens vignette. The corner/centre ratio above 1 (1.7–2.3) is the bright top corners against the dark centre, i.e. scene content.

### Technology choice
- **three.js on WebGL 2 through `@remotion/three` (React Three Fiber `<ThreeCanvas>`), custom GLSL passes on half-float targets.** A 3D camera, occlusion and distance-based defocus are required, and the look is entirely a shading and lens problem, which custom passes control exactly.
- Not used, and why: `drei` and pmndrs `postprocessing` (nothing needed from them; depth of field, glow, grain and dither are a few short passes written for this scene, which also keeps one fixed pass order for determinism); `@remotion/noise` (the noise has to run per pixel on the GPU, so it is GLSL simplex noise); physics, d3, hand-drawn libraries (not applicable). No WebGPU.

### Version 2 choice
**A different colour palette** (warm ember: black → oxblood → amber → pale gold). The reference is a single-hue brightness ramp on pure black, so the palette is the one property that can change clearly while every shape, motion and lens decision stays identical. A new camera angle or move would change which crests catch the grazing light and where the focus band falls, which alters the look itself.

### Assumptions
- The stock-agency watermark is ignored and not reproduced.
- The wave pattern is procedural, so individual crests do not coincide with the reference frame for frame; character, scale, motion, light and lens are matched instead.
- The reference's softness is partly 432p compression. The 1080p/4K masters are kept a little softer than they could be (in-focus anti-aliasing blur of about 1.7 px at 1080p) so that fine-detail measures land near the reference when both are compared at 768×432.
