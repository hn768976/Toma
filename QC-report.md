# QC report: two references -> four videos

| # | File | Composition | What it is |
|---|---|---|---|
| 01 | `01-V1-circuit-chip-beam.mp4` | `V1-circuit-chip-beam` | Reference A, matched |
| 02 | `02-V2-circuit-chip-beam.mp4` | `V2-circuit-chip-beam` | Reference A, **palette changed** (ember orange + gold) |
| 03 | `03-V1-golden-hourglass.mp4` | `V1-golden-hourglass` | Reference B, matched |
| 04 | `04-V2-golden-hourglass.mp4` | `V2-golden-hourglass` | Reference B, **camera movement changed** (push-in on an arc) |

Videos and project ZIPs are in `deliverables/`. Projects: `circuit-chip-beam-project.zip`,
`golden-hourglass-project.zip` (4K compositions, source, config, README). Paths in this report are
relative to the repository root; the supporting images and tables are in `qc/`.

**Short names.** The Inputs block of the brief still held its placeholders, so I named the references
myself: `circuit-chip-beam` (reference A, `...1083716650-preview.mp4`) and `golden-hourglass`
(reference B, `...1067717630-preview.mp4`).

**Headline result.** All technical checks pass for all four videos (specs, duration, integrity, frame
scan, determinism, ZIP test). The look and visual-match targets are **only partly met**: after three
look-dev rounds and three visual-match rounds per reference, between 2 and 14 of the 29 look measures are still
outside the +-10% target depending on the video and frame, and the independent reviewers still list visible
differences. Reference A is a close stylistic match; reference B is live-action macro footage of real
glass and is reproduced as a stylised CG hourglass, not a photoreal one. Details are in sections 3, 5 and 8.

---

## 1. Step 2 analysis

### Reference A: circuit-chip-beam

| | |
|---|---|
| Duration | 14.680 s (ffprobe), 25 fps, 367 frames, 596x336, no audio |
| Frames at 30 fps | round(14.680 x 30) = **440 frames** = 14.667 s. Difference 13.3 ms (under one frame) |
| 2D or 3D | **3D.** The camera dollies in, orbits about 40 degrees, drops from about 37 to 18 degrees elevation and rolls about 30 degrees; the die has thickness and the beam has parallax. That needs a real perspective camera |
| Loops? | **No.** First frame is a wide high view, last is a low rolled close-up |
| What it shows | A dark circuit board seen in perspective. A chip sits inside a glowing electric-blue square frame. Thin traces with 45-degree bends, small white and cyan parts, clusters of thin cyan bars. A column of fine teal light streaks rises from the die |
| Colours (sampled) | board `#141d2d` to `#1a2a49`, corners `#04050a`, lit board near the chip `#204d78`, frame glow `#1b375b` to white-blue core, beam `#0d6c85` / `#216e94`, die top under the beam `#0e5892`, traces `#172741` up to near-white |
| Timing beats | 0-1.0 s fast push-in on a small dim chip; ~0.6-1.2 s light runs out along the traces and the board flashes blue; ~0.8 s first streaks, ~2.5 s beam fully up; 1.0-2.3 s die rises; 2.5-4 s hold; 4-14.7 s slow orbit, descent and roll; from ~11 s the far board edge and black void enter top-left |
| Light | The only sources are in the scene: the neon frame (cool blue, soft, low, spilling a pool on the board) and the beam (teal, from above). No white light. Glow falls off smoothly; the board is otherwise near-black |
| Atmosphere | Blue haze pooled around the chip, a few soft out-of-focus teal dust dots, shallow depth of field (far and near board soften), strong vignette, fade to black at distance |
| Texture | Gritty, mottled board with fine relief and many tiny parts; hair-fine beam filaments; mild grain/compression noise; overall slightly soft |
| Technology | three.js (WebGL 2) for the scene, instanced geometry for traces/parts/streaks, custom GLSL materials, hand-written post chain (half-float MSAA target, bloom mips, depth-of-field blur, ACES, grade, vignette, grain, dither). No textures or models: everything is procedural and seeded |
| Version 2 | **Palette.** The reference already has a complete camera move, so a palette swap is the single change that is obvious at a glance and leaves the design intact |

### Reference B: golden-hourglass

| | |
|---|---|
| Duration | 16.950 s (ffprobe), 29.97 fps, 508 frames, 600x316 (1.90:1), no audio |
| Frames at 30 fps | round(16.950 x 30) = **509 frames** = 16.967 s. Difference 16.4 ms (under one frame) |
| 2D or 3D | **3D.** The reference camera is nearly static, so 2D was possible, but the cone of sand, the crater, the glass highlights and above all a Version 2 with camera movement need real geometry |
| Loops? | **No.** The sand runs out at about 13.8 s and the last 3 s show an empty upper bulb |
| What it shows | Live-action macro shot of an hourglass neck, right of centre, on a dark backdrop. Gold glitter sand in the upper bulb, a thin stream through the neck, a transparent lower bulb with a bright diagonal streak and 8-point star-filter glints |
| Colours (sampled) | backdrop `#242422` (matte, lifted black), lighter patch left `#323434`, lower-left `#2c2a29`; sand surface `#c0a378`, sand behind glass `#493628` to `#60432a`, stream `#a68454`, streak `#c0b39e`, glints `#e4d3b1` to white |
| Timing beats | 0-9 s level sinks slowly while the middle dips into a crater; 9-13 s the rim collapses faster and faster; ~13.75 s sand runs out and the stream's tail drops away; 13.8-17 s empty upper bulb with grains clinging to the glass. The framing drifts right by about 4% of the width over the clip |
| Light | Small warm sources from the right and behind (rim light, glints, streak), a softer warm front fill on the sand; cool grey-green backdrop against warm brown-black near the glass |
| Atmosphere | None to speak of (no fog); soft photographic bloom around highlights, shallow depth of field, blacks lifted to about 14% |
| Texture | Fine granular glitter sand, dusty glass with fibrous streak reflections, essentially no film grain (measured 0.0003-0.0007) |
| Technology | three.js (WebGL 2): lathe geometry for glass and sand rebuilt per frame from keyframes, custom GLSL for sand, glass, glints, same post chain as A (no depth pass). No live physics: the sand level is a deterministic function of the frame |
| Version 2 | **Camera movement.** The reference camera barely moves, so a slow push-in on an arc is the clearest single change and shows the scene is genuinely 3D |

Assumptions made instead of asking: the stock watermark is ignored; the hourglass is an original CG
model (no attempt to copy the real object's maker's details); B's 1.90:1 framing is fitted to the 16:9
width, so the videos show slightly more above and below.

#### Reference A (circuit-chip-beam): measure-look.py on 5 frames

| measure | 0.5s | 2.0s | 5.0s | 9.0s | 13.5s |
|---|---|---|---|---|---|
| lum_p1 | 0.028 | 0.032 | 0.032 | 0.034 | 0.006 |
| lum_p5 | 0.036 | 0.041 | 0.042 | 0.044 | 0.030 |
| lum_p50 | 0.091 | 0.126 | 0.118 | 0.142 | 0.136 |
| lum_p95 | 0.262 | 0.561 | 0.476 | 0.496 | 0.529 |
| lum_p99 | 0.503 | 0.711 | 0.642 | 0.665 | 0.651 |
| pct_above_90 | 0.049 | 0.107 | 0.110 | 0.137 | 0.103 |
| pct_below_5 | 14.120 | 10.073 | 10.173 | 7.817 | 8.931 |
| sat_mean | 0.588 | 0.679 | 0.670 | 0.707 | 0.735 |
| hue_shadows | 223.266 | 221.384 | 218.990 | 218.730 | 216.857 |
| hue_midtones | 222.644 | 216.153 | 215.199 | 214.148 | 213.413 |
| hue_highlights | 216.193 | 202.115 | 201.499 | 203.561 | 202.385 |
| glow_peak | 0.746 | 0.803 | 0.798 | 0.782 | 0.733 |
| glow_cx | 0.575 | 0.627 | 0.598 | 0.340 | 0.470 |
| glow_cy | 0.512 | 0.450 | 0.441 | 0.609 | 0.598 |
| glow_r50 | 3.667 | 10.333 | 7.667 | 6.333 | 11.667 |
| glow_r25 | 12.333 | 26.667 | 26.000 | 30.000 | 30.667 |
| glow_r10 | 39.667 | 55.667 | 50.667 | 63.000 | 46.667 |
| contrast_top | 0.121 | 0.463 | 0.426 | 0.413 | 0.440 |
| contrast_mid | 0.327 | 0.598 | 0.505 | 0.519 | 0.545 |
| contrast_bottom | 0.166 | 0.254 | 0.217 | 0.297 | 0.285 |
| contrast_far | 0.114 | 0.407 | 0.401 | 0.376 | 0.387 |
| contrast_near | 0.113 | 0.144 | 0.150 | 0.196 | 0.188 |
| mean_top | 0.088 | 0.178 | 0.181 | 0.188 | 0.182 |
| mean_mid | 0.160 | 0.291 | 0.238 | 0.275 | 0.269 |
| mean_bottom | 0.091 | 0.115 | 0.107 | 0.128 | 0.125 |
| grain | 0.006 | 0.009 | 0.009 | 0.013 | 0.009 |
| detail_lapvar | 63.189 | 136.194 | 92.707 | 143.726 | 100.279 |
| vignette_ratio | 0.100 | 0.080 | 0.108 | 0.103 | 0.074 |
| mean_lum | 0.113 | 0.194 | 0.175 | 0.197 | 0.192 |


#### Reference B (golden-hourglass): measure-look.py on 5 frames

| measure | 0.5s | 4.0s | 9.0s | 13.0s | 16.0s |
|---|---|---|---|---|---|
| lum_p1 | 0.139 | 0.139 | 0.139 | 0.139 | 0.139 |
| lum_p5 | 0.141 | 0.141 | 0.141 | 0.143 | 0.143 |
| lum_p50 | 0.172 | 0.174 | 0.176 | 0.176 | 0.173 |
| lum_p95 | 0.442 | 0.442 | 0.439 | 0.423 | 0.377 |
| lum_p99 | 0.669 | 0.669 | 0.684 | 0.689 | 0.666 |
| pct_above_90 | 0.159 | 0.170 | 0.200 | 0.227 | 0.242 |
| pct_below_5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| sat_mean | 0.154 | 0.156 | 0.160 | 0.156 | 0.145 |
| hue_shadows | 60.967 | 59.821 | 54.208 | 50.777 | 48.351 |
| hue_midtones | 28.769 | 27.917 | 29.675 | 28.939 | 26.632 |
| hue_highlights | 30.125 | 30.141 | 29.969 | 30.005 | 28.587 |
| glow_peak | 0.868 | 0.870 | 0.878 | 0.885 | 0.890 |
| glow_cx | 0.722 | 0.732 | 0.747 | 0.760 | 0.772 |
| glow_cy | 0.522 | 0.522 | 0.525 | 0.522 | 0.525 |
| glow_r50 | 2.667 | 2.667 | 3.000 | 3.000 | 3.000 |
| glow_r25 | 16.333 | 23.667 | 24.000 | 19.667 | 6.333 |
| glow_r10 | 77.333 | 78.333 | 79.667 | 81.000 | 82.000 |
| contrast_top | 0.355 | 0.345 | 0.311 | 0.259 | 0.272 |
| contrast_mid | 0.264 | 0.266 | 0.291 | 0.320 | 0.207 |
| contrast_bottom | 0.216 | 0.233 | 0.266 | 0.305 | 0.167 |
| contrast_far | 0.392 | 0.372 | 0.333 | 0.271 | 0.275 |
| contrast_near | 0.207 | 0.215 | 0.243 | 0.282 | 0.158 |
| mean_top | 0.227 | 0.227 | 0.225 | 0.212 | 0.211 |
| mean_mid | 0.199 | 0.200 | 0.203 | 0.206 | 0.196 |
| mean_bottom | 0.194 | 0.196 | 0.200 | 0.204 | 0.191 |
| grain | 0.000 | 0.001 | 0.001 | 0.001 | 0.001 |
| detail_lapvar | 67.514 | 67.642 | 69.544 | 67.062 | 71.704 |
| vignette_ratio | 1.106 | 1.163 | 1.296 | 1.398 | 1.440 |
| mean_lum | 0.206 | 0.208 | 0.210 | 0.207 | 0.199 |


Units: brightness values are sRGB luma 0..1; `glow_r*` is the distance from the brightest element at
which brightness falls to 50 / 25 / 10 %, in % of frame width; hues in degrees; `grain` is the
high-pass standard deviation in flat areas; `detail_lapvar` is Laplacian variance x 1e4;
`vignette_ratio` is corner / centre brightness. All images are normalised to 600 px wide before
measuring (the references are 596 / 600 px previews), and B is centre-cropped to 1.899:1.

---

## 2. What was built

- **One Remotion 4.0.545 project per reference**, scaffolded with `npx create-video@latest --blank`,
  skills installed with `npx remotion skills add` and `npx skills add CloudAI-X/threejs-skills`.
  All package versions are pinned exactly (`three` 0.187.0, `react` 19.3.1).
- **Compositions** 3840x2160, 30 fps: `V1-` / `V2-circuit-chip-beam` (440 frames),
  `V1-` / `V2-golden-hourglass` (509 frames), plus a 3-frame `LookDev` in each project.
- **V1 and V2 share everything** except the one change: `PALETTE_V1` / `PALETTE_V2` for A,
  `CAMERA_V1` / `CAMERA_V2` for B. Colours, counts, timings are in `src/config.ts`; every look
  setting is in `src/look.ts`.
- **Deviation from the brief's technology table:** I used three.js directly (a plain WebGL 2
  canvas) instead of `@remotion/three` + React Three Fiber, and a hand-written post chain instead of
  pmndrs `postprocessing`. Reason: the determinism rules forbid `useFrame`, and a custom multi-pass
  chain inside R3F needs it; drawing synchronously from `useCurrentFrame()` behind `delayRender()`
  keeps every pixel a function of the frame number only. No MCP servers, no WebGPU, no self-clocked
  animation libraries, no stock or AI-generated imagery; there are no external assets at all.
- **Rules for clean renders:** no `Math.random()` (seeded `mulberry32`), no `requestAnimationFrame` /
  `useFrame` / `Date.now()` / `useState`, half-float render targets, +-1/255 dither skipped on pure
  black and white, no audio. Neither reference loops, so the loop rules do not apply. Neither
  reference sits on a keyable pure black / green / white background (A fades to near-black with a
  vignette, B's backdrop is a lifted matte `#242422`), so the backdrops were matched, not forced to a key value.

---

## 3. Look table

Targets: each measure within +-10 % of the reference (hue within +-10 degrees). **x** marks a
measure outside target. Near-zero values also pass on a small absolute tolerance (listed in
`scripts/measure-look.py`), so a large percentage on a tiny number is not always a failure.

### 3.1 Look-dev stills (final look settings)

Side-by-side images (reference | ours | difference x2), in each project and in its ZIP:

- `circuit-chip-beam/lookdev/compare-start.png`, `compare-peak.png`, `compare-late.png` (0.5 s, 5.0 s, 13.5 s)
- `golden-hourglass/lookdev/compare-start.png`, `compare-peak.png`, `compare-late.png` (0.5 s, 9.0 s, 13.0 s)

#### circuit-chip-beam: look-dev stills (start / peak / late)

| measure | start ref / ours (diff) | peak ref / ours (diff) | late ref / ours (diff) |
|---|---|---|---|
| lum_p1 | 0.028 / 0.012 (-58.0%) | 0.032 / 0.043 (+35.1%) | 0.006 / 0.012 (+90.8%) |
| lum_p5 | 0.036 / 0.040 (+9.9%) | 0.042 / 0.053 (+26.7%) | 0.030 / 0.013 (-56.6%) |
| lum_p50 | 0.091 / 0.080 (-12.6%) | 0.118 / 0.107 (-9.7%) | 0.136 / 0.115 (-15.9%) **x** |
| lum_p95 | 0.262 / 0.217 (-17.2%) **x** | 0.476 / 0.505 (+6.2%) | 0.529 / 0.523 (-1.2%) |
| lum_p99 | 0.503 / 0.506 (+0.6%) | 0.642 / 0.688 (+7.1%) | 0.651 / 0.671 (+3.1%) |
| pct_above_90 | 0.049 / 0.048 (-2.0%) | 0.110 / 0.082 (-25.1%) | 0.103 / 0.091 (-12.0%) |
| pct_below_5 | 14.120 / 13.208 (-6.5%) | 10.173 / 3.254 (-68.0%) **x** | 8.931 / 11.406 (+27.7%) |
| sat_mean | 0.588 / 0.625 (+6.3%) | 0.670 / 0.636 (-5.2%) | 0.735 / 0.652 (-11.4%) **x** |
| hue_shadows | 223.266 / 223.705 (+0.4 deg) | 218.990 / 221.827 (+2.8 deg) | 216.857 / 221.946 (+5.1 deg) |
| hue_midtones | 222.644 / 221.924 (-0.7 deg) | 215.199 / 219.771 (+4.6 deg) | 213.413 / 219.834 (+6.4 deg) |
| hue_highlights | 216.193 / 217.487 (+1.3 deg) | 201.499 / 203.968 (+2.5 deg) | 202.385 / 205.427 (+3.0 deg) |
| glow_peak | 0.746 / 0.656 (-12.1%) **x** | 0.798 / 0.694 (-13.0%) **x** | 0.733 / 0.780 (+6.4%) |
| glow_cx | 0.575 / 0.560 (-2.6%) | 0.598 / 0.420 (-29.8%) **x** | 0.470 / 0.535 (+13.8%) |
| glow_cy | 0.512 / 0.512 (+0.0%) | 0.441 / 0.550 (+24.8%) **x** | 0.598 / 0.476 (-20.3%) **x** |
| glow_r50 | 3.667 / 2.667 (-27.3%) | 7.667 / 7.333 (-4.3%) | 11.667 / 11.000 (-5.7%) |
| glow_r25 | 12.333 / 15.000 (+21.6%) **x** | 26.000 / 28.667 (+10.3%) **x** | 30.667 / 23.667 (-22.8%) **x** |
| glow_r10 | 39.667 / 41.333 (+4.2%) | 50.667 / 54.333 (+7.2%) | 46.667 / 40.667 (-12.9%) **x** |
| contrast_top | 0.121 / 0.099 (-18.2%) | 0.426 / 0.466 (+9.3%) | 0.440 / 0.525 (+19.5%) **x** |
| contrast_mid | 0.327 / 0.317 (-3.1%) | 0.505 / 0.506 (+0.2%) | 0.545 / 0.552 (+1.3%) |
| contrast_bottom | 0.166 / 0.125 (-24.3%) **x** | 0.217 / 0.221 (+1.9%) | 0.285 / 0.223 (-21.6%) **x** |
| contrast_far | 0.114 / 0.104 (-9.5%) | 0.401 / 0.461 (+14.7%) **x** | 0.387 / 0.499 (+29.0%) **x** |
| contrast_near | 0.113 / 0.110 (-3.1%) | 0.150 / 0.171 (+14.0%) | 0.188 / 0.185 (-1.1%) |
| mean_top | 0.088 / 0.077 (-12.9%) | 0.181 / 0.178 (-1.5%) | 0.182 / 0.180 (-1.3%) |
| mean_mid | 0.160 / 0.134 (-16.3%) **x** | 0.238 / 0.204 (-14.2%) **x** | 0.269 / 0.199 (-26.0%) **x** |
| mean_bottom | 0.091 / 0.086 (-5.7%) | 0.107 / 0.127 (+18.8%) **x** | 0.125 / 0.129 (+2.9%) |
| grain | 0.006 / 0.005 (-16.9%) | 0.009 / 0.007 (-18.8%) **x** | 0.009 / 0.006 (-32.2%) **x** |
| detail_lapvar | 63.189 / 34.127 (-46.0%) **x** | 92.707 / 77.578 (-16.3%) **x** | 100.279 / 116.981 (+16.7%) **x** |
| vignette_ratio | 0.100 / 0.119 (+18.7%) | 0.108 / 0.155 (+43.4%) | 0.074 / 0.124 (+68.1%) |
| mean_lum | 0.113 / 0.099 (-12.5%) | 0.175 / 0.170 (-3.0%) | 0.192 / 0.169 (-11.9%) **x** |
| **outside target** | 6 of 29 | 10 of 29 | 12 of 29 |


#### golden-hourglass: look-dev stills (start / peak / late)

| measure | start ref / ours (diff) | peak ref / ours (diff) | late ref / ours (diff) |
|---|---|---|---|
| lum_p1 | 0.139 / 0.138 (-1.0%) | 0.139 / 0.138 (-1.0%) | 0.139 / 0.140 (+1.0%) |
| lum_p5 | 0.141 / 0.140 (-0.2%) | 0.141 / 0.140 (-0.2%) | 0.143 / 0.140 (-1.8%) |
| lum_p50 | 0.172 / 0.160 (-7.4%) | 0.176 / 0.159 (-9.4%) | 0.176 / 0.159 (-9.4%) |
| lum_p95 | 0.442 / 0.539 (+21.8%) **x** | 0.439 / 0.513 (+16.8%) **x** | 0.423 / 0.495 (+16.9%) **x** |
| lum_p99 | 0.669 / 0.759 (+13.3%) **x** | 0.684 / 0.762 (+11.3%) **x** | 0.689 / 0.768 (+11.5%) **x** |
| pct_above_90 | 0.159 / 0.020 (-87.4%) | 0.200 / 0.023 (-88.7%) | 0.227 / 0.026 (-88.4%) |
| pct_below_5 | 0.000 / 0.000 (+0.0%) | 0.000 / 0.000 (+0.0%) | 0.000 / 0.000 (+0.0%) |
| sat_mean | 0.154 / 0.171 (+11.2%) | 0.160 / 0.170 (+6.3%) | 0.156 / 0.170 (+8.7%) |
| hue_shadows | 60.967 / 47.209 (-13.8 deg) **x** | 54.208 / 45.965 (-8.2 deg) | 50.777 / 46.282 (-4.5 deg) |
| hue_midtones | 28.769 / 40.752 (+12.0 deg) **x** | 29.675 / 40.912 (+11.2 deg) **x** | 28.939 / 40.466 (+11.5 deg) **x** |
| hue_highlights | 30.125 / 31.741 (+1.6 deg) | 29.969 / 31.057 (+1.1 deg) | 30.005 / 30.630 (+0.6 deg) |
| glow_peak | 0.868 / 0.815 (-6.1%) | 0.878 / 0.826 (-6.0%) | 0.885 / 0.825 (-6.8%) |
| glow_cx | 0.722 / 0.675 (-6.5%) | 0.747 / 0.702 (-6.0%) | 0.760 / 0.713 (-6.1%) |
| glow_cy | 0.522 / 0.804 (+53.9%) **x** | 0.525 / 0.453 (-13.9%) | 0.522 / 0.465 (-10.9%) |
| glow_r50 | 2.667 / 2.000 (-25.0%) | 3.000 / 4.333 (+44.4%) **x** | 3.000 / 4.000 (+33.3%) |
| glow_r25 | 16.333 / 10.333 (-36.7%) **x** | 24.000 / 26.000 (+8.3%) | 19.667 / 26.333 (+33.9%) **x** |
| glow_r10 | 77.333 / 80.000 (+3.4%) | 79.667 / 76.000 (-4.6%) | 81.000 / 76.667 (-5.3%) |
| contrast_top | 0.355 / 0.479 (+34.7%) **x** | 0.311 / 0.382 (+22.7%) **x** | 0.259 / 0.372 (+43.3%) **x** |
| contrast_mid | 0.264 / 0.306 (+15.8%) **x** | 0.291 / 0.319 (+9.8%) | 0.320 / 0.319 (-0.3%) |
| contrast_bottom | 0.216 / 0.330 (+52.6%) **x** | 0.266 / 0.325 (+22.2%) **x** | 0.305 / 0.327 (+7.4%) |
| contrast_far | 0.392 / 0.502 (+27.9%) **x** | 0.333 / 0.387 (+16.2%) **x** | 0.271 / 0.374 (+38.2%) **x** |
| contrast_near | 0.207 / 0.304 (+47.0%) **x** | 0.243 / 0.295 (+21.2%) **x** | 0.282 / 0.294 (+4.5%) |
| mean_top | 0.227 / 0.251 (+10.5%) **x** | 0.225 / 0.234 (+3.6%) | 0.212 / 0.225 (+6.0%) |
| mean_mid | 0.199 / 0.197 (-1.0%) | 0.203 / 0.198 (-2.5%) | 0.206 / 0.198 (-3.9%) |
| mean_bottom | 0.194 / 0.192 (-1.0%) | 0.200 / 0.191 (-4.6%) | 0.204 / 0.192 (-5.9%) |
| grain | 0.000 / 0.001 (+358.9%) | 0.001 / 0.001 (+169.8%) | 0.001 / 0.001 (+125.7%) |
| detail_lapvar | 67.514 / 30.844 (-54.3%) **x** | 69.544 / 31.469 (-54.8%) **x** | 67.062 / 35.477 (-47.1%) **x** |
| vignette_ratio | 1.106 / 0.973 (-12.0%) **x** | 1.296 / 1.102 (-14.9%) **x** | 1.398 / 1.137 (-18.7%) **x** |
| mean_lum | 0.206 / 0.213 (+3.2%) | 0.210 / 0.208 (-1.0%) | 0.207 / 0.205 (-1.2%) |
| **outside target** | 14 of 29 | 10 of 29 | 8 of 29 |


### 3.2 Look over time: 5 frames of each final video against the same moments of its reference

#### 01-V1-circuit-chip-beam

| measure | 0.5s ref / ours (diff) | 2.0s ref / ours (diff) | 5.0s ref / ours (diff) | 9.0s ref / ours (diff) | 13.5s ref / ours (diff) |
|---|---|---|---|---|---|
| lum_p1 | 0.028 / 0.010 (-66.0%) | 0.032 / 0.040 (+23.7%) | 0.032 / 0.039 (+22.9%) | 0.034 / 0.008 (-76.7%) **x** | 0.006 / 0.008 (+27.3%) |
| lum_p5 | 0.036 / 0.036 (-1.6%) | 0.041 / 0.048 (+15.6%) | 0.042 / 0.047 (+12.7%) | 0.044 / 0.043 (-2.5%) | 0.030 / 0.008 (-71.7%) **x** |
| lum_p50 | 0.091 / 0.074 (-18.7%) | 0.126 / 0.101 (-19.9%) **x** | 0.118 / 0.102 (-14.0%) | 0.142 / 0.108 (-24.1%) **x** | 0.136 / 0.109 (-20.0%) **x** |
| lum_p95 | 0.262 / 0.213 (-18.9%) **x** | 0.561 / 0.494 (-11.9%) **x** | 0.476 / 0.500 (+5.0%) | 0.496 / 0.506 (+2.0%) | 0.529 / 0.518 (-2.1%) |
| lum_p99 | 0.503 / 0.500 (-0.5%) | 0.711 / 0.736 (+3.4%) | 0.642 / 0.682 (+6.2%) | 0.665 / 0.660 (-0.8%) | 0.651 / 0.665 (+2.2%) |
| pct_above_90 | 0.049 / 0.041 (-15.2%) | 0.107 / 0.117 (+9.2%) | 0.110 / 0.081 (-26.5%) | 0.137 / 0.079 (-41.9%) | 0.103 / 0.083 (-19.1%) |
| pct_below_5 | 14.120 / 19.358 (+37.1%) **x** | 10.073 / 5.917 (-41.3%) **x** | 10.173 / 6.199 (-39.1%) | 7.817 / 8.313 (+6.4%) | 8.931 / 13.230 (+48.1%) **x** |
| sat_mean | 0.588 / 0.647 (+10.1%) **x** | 0.679 / 0.654 (-3.7%) | 0.670 / 0.650 (-3.0%) | 0.707 / 0.657 (-7.0%) | 0.735 / 0.674 (-8.3%) |
| hue_shadows | 223.266 / 225.010 (+1.7 deg) | 221.384 / 222.676 (+1.3 deg) | 218.990 / 222.666 (+3.7 deg) | 218.730 / 222.759 (+4.0 deg) | 216.857 / 223.353 (+6.5 deg) |
| hue_midtones | 222.644 / 222.610 (-0.0 deg) | 216.153 / 221.113 (+5.0 deg) | 215.199 / 221.114 (+5.9 deg) | 214.148 / 221.257 (+7.1 deg) | 213.413 / 221.113 (+7.7 deg) |
| hue_highlights | 216.193 / 218.436 (+2.2 deg) | 202.115 / 205.330 (+3.2 deg) | 201.499 / 204.479 (+3.0 deg) | 203.561 / 205.868 (+2.3 deg) | 202.385 / 206.023 (+3.6 deg) |
| glow_peak | 0.746 / 0.651 (-12.7%) **x** | 0.803 / 0.742 (-7.6%) | 0.798 / 0.691 (-13.4%) **x** | 0.782 / 0.766 (-2.1%) | 0.733 / 0.776 (+5.9%) |
| glow_cx | 0.575 / 0.480 (-16.5%) **x** | 0.627 / 0.392 (-37.5%) **x** | 0.598 / 0.420 (-29.8%) **x** | 0.340 / 0.528 (+55.4%) **x** | 0.470 / 0.533 (+13.5%) |
| glow_cy | 0.512 / 0.533 (+4.0%) | 0.450 / 0.396 (-11.8%) | 0.441 / 0.550 (+24.8%) **x** | 0.609 / 0.550 (-9.7%) | 0.598 / 0.482 (-19.3%) **x** |
| glow_r50 | 3.667 / 8.000 (+118.2%) **x** | 10.333 / 5.333 (-48.4%) **x** | 7.667 / 7.333 (-4.3%) | 6.333 / 7.667 (+21.1%) **x** | 11.667 / 11.000 (-5.7%) |
| glow_r25 | 12.333 / 11.000 (-10.8%) | 26.667 / 25.667 (-3.8%) | 26.000 / 27.667 (+6.4%) | 30.000 / 24.000 (-20.0%) **x** | 30.667 / 23.000 (-25.0%) **x** |
| glow_r10 | 39.667 / 37.667 (-5.0%) | 55.667 / 50.333 (-9.6%) | 50.667 / 53.667 (+5.9%) | 63.000 / 43.000 (-31.7%) **x** | 46.667 / 38.333 (-17.9%) **x** |
| contrast_top | 0.121 / 0.099 (-18.5%) | 0.463 / 0.452 (-2.3%) | 0.426 / 0.466 (+9.3%) | 0.413 / 0.518 (+25.2%) **x** | 0.440 / 0.525 (+19.3%) **x** |
| contrast_mid | 0.327 / 0.316 (-3.4%) | 0.598 / 0.524 (-12.4%) **x** | 0.505 / 0.506 (+0.1%) | 0.519 / 0.508 (-2.1%) | 0.545 / 0.552 (+1.2%) |
| contrast_bottom | 0.166 / 0.125 (-24.5%) **x** | 0.254 / 0.215 (-15.4%) **x** | 0.217 / 0.221 (+2.0%) | 0.297 / 0.252 (-15.3%) **x** | 0.285 / 0.225 (-20.8%) **x** |
| contrast_far | 0.114 / 0.102 (-11.0%) | 0.407 / 0.438 (+7.8%) | 0.401 / 0.459 (+14.3%) **x** | 0.376 / 0.511 (+36.0%) **x** | 0.387 / 0.498 (+28.8%) **x** |
| contrast_near | 0.113 / 0.109 (-4.1%) | 0.144 / 0.183 (+27.0%) **x** | 0.150 / 0.170 (+12.9%) | 0.196 / 0.216 (+10.6%) | 0.188 / 0.186 (-0.8%) |
| mean_top | 0.088 / 0.072 (-17.7%) | 0.178 / 0.171 (-4.2%) | 0.181 / 0.174 (-4.0%) | 0.188 / 0.173 (-7.5%) | 0.182 / 0.175 (-3.9%) |
| mean_mid | 0.160 / 0.130 (-19.1%) **x** | 0.291 / 0.211 (-27.6%) **x** | 0.238 / 0.199 (-16.1%) **x** | 0.275 / 0.207 (-24.8%) **x** | 0.269 / 0.195 (-27.7%) **x** |
| mean_bottom | 0.091 / 0.081 (-10.7%) | 0.115 / 0.122 (+5.8%) | 0.107 / 0.123 (+14.5%) | 0.128 / 0.124 (-3.1%) | 0.125 / 0.124 (-0.8%) |
| grain | 0.006 / 0.005 (-18.1%) | 0.009 / 0.008 (-5.8%) | 0.009 / 0.007 (-20.0%) **x** | 0.013 / 0.008 (-35.1%) **x** | 0.009 / 0.007 (-30.2%) **x** |
| detail_lapvar | 63.189 / 33.114 (-47.6%) **x** | 136.194 / 75.773 (-44.4%) **x** | 92.707 / 75.538 (-18.5%) **x** | 143.726 / 108.633 (-24.4%) **x** | 100.279 / 113.732 (+13.4%) **x** |
| vignette_ratio | 0.100 / 0.109 (+9.0%) | 0.080 / 0.172 (+115.6%) **x** | 0.108 / 0.146 (+34.8%) | 0.103 / 0.083 (-18.8%) | 0.074 / 0.117 (+57.8%) |
| mean_lum | 0.113 / 0.094 (-16.5%) | 0.194 / 0.167 (-13.8%) **x** | 0.175 / 0.165 (-5.6%) | 0.197 / 0.168 (-14.6%) **x** | 0.192 / 0.164 (-14.3%) **x** |
| **outside target** | 9 of 29 | 12 of 29 | 7 of 29 | 13 of 29 | 13 of 29 |


#### 02-V2-circuit-chip-beam (palette changed: hue and saturation skipped)

| measure | 0.5s ref / ours (diff) | 2.0s ref / ours (diff) | 5.0s ref / ours (diff) | 9.0s ref / ours (diff) | 13.5s ref / ours (diff) |
|---|---|---|---|---|---|
| lum_p1 | 0.028 / 0.007 (-74.0%) **x** | 0.032 / 0.035 (+8.3%) | 0.032 / 0.034 (+5.8%) | 0.034 / 0.009 (-73.4%) **x** | 0.006 / 0.008 (+26.4%) |
| lum_p5 | 0.036 / 0.032 (-13.4%) | 0.041 / 0.044 (+5.7%) | 0.042 / 0.043 (+3.0%) | 0.044 / 0.038 (-14.2%) | 0.030 / 0.009 (-69.9%) **x** |
| lum_p50 | 0.091 / 0.068 (-25.3%) **x** | 0.126 / 0.097 (-23.0%) **x** | 0.118 / 0.097 (-17.8%) **x** | 0.142 / 0.106 (-25.4%) **x** | 0.136 / 0.108 (-20.9%) **x** |
| lum_p95 | 0.262 / 0.220 (-16.2%) **x** | 0.561 / 0.525 (-6.4%) | 0.476 / 0.541 (+13.7%) **x** | 0.496 / 0.547 (+10.3%) **x** | 0.529 / 0.550 (+3.9%) |
| lum_p99 | 0.503 / 0.508 (+1.1%) | 0.711 / 0.755 (+6.1%) | 0.642 / 0.700 (+9.0%) | 0.665 / 0.677 (+1.7%) | 0.651 / 0.706 (+8.5%) |
| pct_above_90 | 0.049 / 0.035 (-29.3%) | 0.107 / 0.143 (+33.5%) | 0.110 / 0.096 (-13.0%) | 0.137 / 0.101 (-26.4%) | 0.103 / 0.104 (+0.5%) |
| pct_below_5 | 14.120 / 26.661 (+88.8%) **x** | 10.073 / 10.175 (+1.0%) | 10.173 / 10.536 (+3.6%) | 7.817 / 11.177 (+43.0%) | 8.931 / 14.858 (+66.4%) **x** |
| sat_mean | 0.588 / 0.697 (+18.6%) (skipped) | 0.679 / 0.690 (+1.6%) (skipped) | 0.670 / 0.684 (+2.1%) (skipped) | 0.707 / 0.692 (-2.1%) (skipped) | 0.735 / 0.713 (-3.1%) (skipped) |
| hue_shadows | 223.266 / 15.162 (+151.9 deg) (skipped) | 221.384 / 15.458 (+154.1 deg) (skipped) | 218.990 / 15.797 (+156.8 deg) (skipped) | 218.730 / 15.848 (+157.1 deg) (skipped) | 216.857 / 15.625 (+158.8 deg) (skipped) |
| hue_midtones | 222.644 / 16.057 (+153.4 deg) (skipped) | 216.153 / 16.408 (+160.3 deg) (skipped) | 215.199 / 16.733 (+161.5 deg) (skipped) | 214.148 / 16.149 (+162.0 deg) (skipped) | 213.413 / 15.645 (+162.2 deg) (skipped) |
| hue_highlights | 216.193 / 16.860 (+160.7 deg) (skipped) | 202.115 / 24.850 (-177.3 deg) (skipped) | 201.499 / 25.989 (-175.5 deg) (skipped) | 203.561 / 25.024 (-178.5 deg) (skipped) | 202.385 / 24.897 (-177.5 deg) (skipped) |
| glow_peak | 0.746 / 0.652 (-12.6%) **x** | 0.803 / 0.769 (-4.2%) | 0.798 / 0.722 (-9.6%) | 0.782 / 0.773 (-1.1%) | 0.733 / 0.787 (+7.4%) |
| glow_cx | 0.575 / 0.485 (-15.7%) **x** | 0.627 / 0.392 (-37.5%) **x** | 0.598 / 0.420 (-29.8%) **x** | 0.340 / 0.532 (+56.4%) **x** | 0.470 / 0.535 (+13.8%) |
| glow_cy | 0.512 / 0.530 (+3.5%) | 0.450 / 0.399 (-11.2%) | 0.441 / 0.550 (+24.8%) **x** | 0.609 / 0.544 (-10.7%) | 0.598 / 0.476 (-20.3%) **x** |
| glow_r50 | 3.667 / 8.333 (+127.3%) **x** | 10.333 / 5.667 (-45.2%) **x** | 7.667 / 7.667 (+0.0%) | 6.333 / 9.000 (+42.1%) **x** | 11.667 / 11.000 (-5.7%) |
| glow_r25 | 12.333 / 11.333 (-8.1%) | 26.667 / 26.000 (-2.5%) | 26.000 / 28.333 (+9.0%) | 30.000 / 25.333 (-15.6%) **x** | 30.667 / 23.667 (-22.8%) **x** |
| glow_r10 | 39.667 / 32.667 (-17.6%) **x** | 55.667 / 49.667 (-10.8%) **x** | 50.667 / 39.667 (-21.7%) **x** | 63.000 / 42.667 (-32.3%) **x** | 46.667 / 38.333 (-17.9%) **x** |
| contrast_top | 0.121 / 0.102 (-15.5%) | 0.463 / 0.492 (+6.2%) | 0.426 / 0.523 (+22.8%) **x** | 0.413 / 0.565 (+36.8%) **x** | 0.440 / 0.561 (+27.7%) **x** |
| contrast_mid | 0.327 / 0.337 (+3.2%) | 0.598 / 0.559 (-6.6%) | 0.505 / 0.534 (+5.8%) | 0.519 / 0.535 (+2.9%) | 0.545 / 0.601 (+10.2%) **x** |
| contrast_bottom | 0.166 / 0.131 (-21.1%) **x** | 0.254 / 0.232 (-8.7%) | 0.217 / 0.240 (+11.0%) | 0.297 / 0.269 (-9.5%) | 0.285 / 0.240 (-15.6%) **x** |
| contrast_far | 0.114 / 0.100 (-12.9%) | 0.407 / 0.488 (+20.0%) **x** | 0.401 / 0.526 (+31.0%) **x** | 0.376 / 0.569 (+51.4%) **x** | 0.387 / 0.543 (+40.4%) **x** |
| contrast_near | 0.113 / 0.114 (+1.1%) | 0.144 / 0.196 (+36.1%) **x** | 0.150 / 0.182 (+21.2%) **x** | 0.196 / 0.229 (+16.8%) **x** | 0.188 / 0.194 (+3.5%) |
| mean_top | 0.088 / 0.067 (-23.4%) **x** | 0.178 / 0.177 (-0.7%) | 0.181 / 0.183 (+1.0%) | 0.188 / 0.182 (-3.0%) | 0.182 / 0.186 (+2.3%) |
| mean_mid | 0.160 / 0.128 (-20.3%) **x** | 0.291 / 0.219 (-24.8%) **x** | 0.238 / 0.206 (-13.1%) **x** | 0.275 / 0.214 (-22.4%) **x** | 0.269 / 0.201 (-25.5%) **x** |
| mean_bottom | 0.091 / 0.076 (-16.1%) | 0.115 / 0.120 (+3.9%) | 0.107 / 0.121 (+12.5%) | 0.128 / 0.125 (-2.8%) | 0.125 / 0.124 (-1.2%) |
| grain | 0.006 / 0.006 (-9.2%) | 0.009 / 0.009 (+6.6%) | 0.009 / 0.008 (-6.8%) | 0.013 / 0.009 (-30.8%) **x** | 0.009 / 0.007 (-24.3%) **x** |
| detail_lapvar | 63.189 / 38.845 (-38.5%) **x** | 136.194 / 93.815 (-31.1%) **x** | 92.707 / 92.009 (-0.8%) | 143.726 / 134.712 (-6.3%) | 100.279 / 140.000 (+39.6%) **x** |
| vignette_ratio | 0.100 / 0.095 (-5.5%) | 0.080 / 0.150 (+88.5%) **x** | 0.108 / 0.125 (+15.9%) | 0.103 / 0.072 (-29.6%) | 0.074 / 0.113 (+52.2%) |
| mean_lum | 0.113 / 0.091 (-20.0%) **x** | 0.194 / 0.172 (-11.8%) **x** | 0.175 / 0.170 (-3.0%) | 0.197 / 0.173 (-12.0%) **x** | 0.192 / 0.170 (-11.4%) **x** |
| **outside target** | 13 of 29 | 10 of 29 | 9 of 29 | 13 of 29 | 14 of 29 |


#### 03-V1-golden-hourglass

| measure | 0.5s ref / ours (diff) | 4.0s ref / ours (diff) | 9.0s ref / ours (diff) | 13.0s ref / ours (diff) | 16.0s ref / ours (diff) |
|---|---|---|---|---|---|
| lum_p1 | 0.139 / 0.136 (-1.8%) | 0.139 / 0.140 (+1.0%) | 0.139 / 0.136 (-1.8%) | 0.139 / 0.140 (+1.0%) | 0.139 / 0.140 (+1.0%) |
| lum_p5 | 0.141 / 0.140 (-0.2%) | 0.141 / 0.140 (-0.2%) | 0.141 / 0.140 (-0.2%) | 0.143 / 0.140 (-1.8%) | 0.143 / 0.140 (-1.8%) |
| lum_p50 | 0.172 / 0.156 (-9.6%) | 0.174 / 0.156 (-10.3%) | 0.176 / 0.155 (-12.1%) **x** | 0.176 / 0.156 (-11.5%) **x** | 0.173 / 0.152 (-12.0%) **x** |
| lum_p95 | 0.442 / 0.534 (+20.7%) **x** | 0.442 / 0.534 (+20.7%) **x** | 0.439 / 0.508 (+15.5%) **x** | 0.423 / 0.490 (+15.8%) **x** | 0.377 / 0.424 (+12.3%) **x** |
| lum_p99 | 0.669 / 0.752 (+12.4%) **x** | 0.669 / 0.763 (+14.0%) **x** | 0.684 / 0.757 (+10.6%) **x** | 0.689 / 0.762 (+10.6%) **x** | 0.666 / 0.605 (-9.2%) |
| pct_above_90 | 0.159 / 0.015 (-90.7%) | 0.170 / 0.022 (-87.0%) | 0.200 / 0.015 (-92.3%) | 0.227 / 0.020 (-91.2%) | 0.242 / 0.017 (-93.0%) |
| pct_below_5 | 0.000 / 0.000 (+0.0%) | 0.000 / 0.000 (+0.0%) | 0.000 / 0.000 (+0.0%) | 0.000 / 0.000 (+0.0%) | 0.000 / 0.000 (+0.0%) |
| sat_mean | 0.154 / 0.187 (+21.5%) | 0.156 / 0.186 (+19.1%) | 0.160 / 0.186 (+16.5%) | 0.156 / 0.186 (+19.2%) | 0.145 / 0.180 (+24.0%) |
| hue_shadows | 60.967 / 50.416 (-10.6 deg) **x** | 59.821 / 50.107 (-9.7 deg) | 54.208 / 49.633 (-4.6 deg) | 50.777 / 49.536 (-1.2 deg) | 48.351 / 48.093 (-0.3 deg) |
| hue_midtones | 28.769 / 39.247 (+10.5 deg) **x** | 27.917 / 39.464 (+11.5 deg) **x** | 29.675 / 39.682 (+10.0 deg) **x** | 28.939 / 39.485 (+10.5 deg) **x** | 26.632 / 42.075 (+15.4 deg) **x** |
| hue_highlights | 30.125 / 31.393 (+1.3 deg) | 30.141 / 31.541 (+1.4 deg) | 29.969 / 30.794 (+0.8 deg) | 30.005 / 30.395 (+0.4 deg) | 28.587 / 29.078 (+0.5 deg) |
| glow_peak | 0.868 / 0.809 (-6.8%) | 0.870 / 0.825 (-5.1%) | 0.878 / 0.821 (-6.5%) | 0.885 / 0.817 (-7.7%) | 0.890 / 0.736 (-17.2%) **x** |
| glow_cx | 0.722 / 0.675 (-6.5%) | 0.732 / 0.688 (-5.9%) | 0.747 / 0.702 (-6.0%) | 0.760 / 0.713 (-6.1%) | 0.772 / 0.745 (-3.5%) |
| glow_cy | 0.522 / 0.801 (+53.3%) **x** | 0.522 / 0.465 (-10.9%) | 0.525 / 0.456 (-13.3%) | 0.522 / 0.462 (-11.5%) | 0.525 / 0.472 (-10.2%) |
| glow_r50 | 2.667 / 2.000 (-25.0%) | 2.667 / 4.333 (+62.5%) **x** | 3.000 / 4.333 (+44.4%) **x** | 3.000 / 4.000 (+33.3%) | 3.000 / 2.000 (-33.3%) |
| glow_r25 | 16.333 / 10.333 (-36.7%) **x** | 23.667 / 27.333 (+15.5%) **x** | 24.000 / 25.667 (+6.9%) | 19.667 / 26.000 (+32.2%) **x** | 6.333 / 29.667 (+368.4%) **x** |
| glow_r10 | 77.333 / 79.667 (+3.0%) | 78.333 / 74.333 (-5.1%) | 79.667 / 76.000 (-4.6%) | 81.000 / 77.000 (-4.9%) | 82.000 / 79.667 (-2.8%) |
| contrast_top | 0.355 / 0.474 (+33.4%) **x** | 0.345 / 0.456 (+32.4%) **x** | 0.311 / 0.377 (+21.0%) **x** | 0.259 / 0.367 (+41.3%) **x** | 0.272 / 0.326 (+20.0%) **x** |
| contrast_mid | 0.264 / 0.301 (+13.9%) **x** | 0.266 / 0.315 (+18.6%) **x** | 0.291 / 0.314 (+8.1%) | 0.320 / 0.315 (-1.7%) | 0.207 / 0.190 (-7.8%) |
| contrast_bottom | 0.216 / 0.326 (+50.7%) **x** | 0.233 / 0.327 (+40.4%) **x** | 0.266 / 0.323 (+21.2%) **x** | 0.305 / 0.324 (+6.4%) | 0.167 / 0.160 (-4.3%) |
| contrast_far | 0.392 / 0.496 (+26.5%) **x** | 0.372 / 0.482 (+29.5%) **x** | 0.333 / 0.386 (+15.8%) **x** | 0.271 / 0.369 (+36.2%) **x** | 0.275 / 0.344 (+25.0%) **x** |
| contrast_near | 0.207 / 0.300 (+45.1%) **x** | 0.215 / 0.299 (+39.3%) **x** | 0.243 / 0.293 (+20.5%) **x** | 0.282 / 0.291 (+3.2%) | 0.158 / 0.140 (-11.1%) |
| mean_top | 0.227 / 0.248 (+9.0%) | 0.227 / 0.244 (+7.2%) | 0.225 / 0.230 (+2.1%) | 0.212 / 0.221 (+4.4%) | 0.211 / 0.217 (+2.5%) |
| mean_mid | 0.199 / 0.194 (-2.4%) | 0.200 / 0.196 (-2.0%) | 0.203 / 0.195 (-4.0%) | 0.206 / 0.195 (-5.4%) | 0.196 / 0.182 (-6.9%) |
| mean_bottom | 0.194 / 0.187 (-3.2%) | 0.196 / 0.187 (-4.3%) | 0.200 / 0.187 (-6.8%) | 0.204 / 0.187 (-8.1%) | 0.191 / 0.171 (-10.8%) **x** |
| grain | 0.000 / 0.000 (+48.3%) | 0.001 / 0.000 (-21.9%) | 0.001 / 0.001 (+59.2%) | 0.001 / 0.001 (-9.0%) | 0.001 / 0.001 (-10.3%) |
| detail_lapvar | 67.514 / 30.295 (-55.1%) **x** | 67.642 / 30.261 (-55.3%) **x** | 69.544 / 31.293 (-55.0%) **x** | 67.062 / 35.309 (-47.3%) **x** | 71.704 / 33.597 (-53.1%) **x** |
| vignette_ratio | 1.106 / 0.976 (-11.8%) **x** | 1.163 / 1.041 (-10.5%) **x** | 1.296 / 1.105 (-14.8%) **x** | 1.398 / 1.138 (-18.6%) **x** | 1.440 / 1.135 (-21.1%) **x** |
| mean_lum | 0.206 / 0.210 (+1.5%) | 0.208 / 0.209 (+0.6%) | 0.210 / 0.204 (-2.7%) | 0.207 / 0.201 (-3.0%) | 0.199 / 0.190 (-4.8%) |
| **outside target** | 13 of 29 | 12 of 29 | 11 of 29 | 9 of 29 | 10 of 29 |


#### 04-V2-golden-hourglass (camera movement changed: position- and framing-dependent measures skipped)

| measure | 0.5s ref / ours (diff) | 4.0s ref / ours (diff) | 9.0s ref / ours (diff) | 13.0s ref / ours (diff) | 16.0s ref / ours (diff) |
|---|---|---|---|---|---|
| lum_p1 | 0.139 / 0.136 (-1.8%) | 0.139 / 0.136 (-1.8%) | 0.139 / 0.136 (-1.8%) | 0.139 / 0.140 (+1.0%) | 0.139 / 0.140 (+1.0%) |
| lum_p5 | 0.141 / 0.140 (-0.2%) | 0.141 / 0.140 (-0.2%) | 0.141 / 0.140 (-0.2%) | 0.143 / 0.140 (-1.8%) | 0.143 / 0.140 (-1.8%) |
| lum_p50 | 0.172 / 0.152 (-11.8%) **x** | 0.174 / 0.152 (-12.6%) **x** | 0.176 / 0.156 (-11.3%) | 0.176 / 0.162 (-7.8%) | 0.173 / 0.168 (-2.9%) |
| lum_p95 | 0.442 / 0.433 (-2.1%) | 0.442 / 0.484 (+9.4%) | 0.439 / 0.540 (+22.9%) **x** | 0.423 / 0.571 (+34.9%) **x** | 0.377 / 0.531 (+40.6%) **x** |
| lum_p99 | 0.669 / 0.632 (-5.6%) | 0.669 / 0.694 (+3.7%) | 0.684 / 0.760 (+11.1%) **x** | 0.689 / 0.794 (+15.2%) **x** | 0.666 / 0.700 (+5.2%) |
| pct_above_90 | 0.159 / 0.008 (-94.7%) | 0.170 / 0.016 (-90.7%) | 0.200 / 0.017 (-91.6%) | 0.227 / 0.015 (-93.5%) | 0.242 / 0.034 (-86.1%) |
| pct_below_5 | 0.000 / 0.000 (+0.0%) | 0.000 / 0.000 (+0.0%) | 0.000 / 0.000 (+0.0%) | 0.000 / 0.000 (+0.0%) | 0.000 / 0.000 (+0.0%) |
| sat_mean | 0.154 / 0.182 (+18.3%) | 0.156 / 0.185 (+18.3%) | 0.160 / 0.196 (+22.6%) | 0.156 / 0.215 (+37.7%) **x** | 0.145 / 0.240 (+65.3%) **x** |
| hue_shadows | 60.967 / 50.844 (-10.1 deg) **x** | 59.821 / 50.383 (-9.4 deg) | 54.208 / 51.149 (-3.1 deg) | 50.777 / 50.758 (-0.0 deg) | 48.351 / 51.256 (+2.9 deg) |
| hue_midtones | 28.769 / 40.738 (+12.0 deg) **x** | 27.917 / 41.148 (+13.2 deg) **x** | 29.675 / 41.171 (+11.5 deg) **x** | 28.939 / 40.870 (+11.9 deg) **x** | 26.632 / 40.411 (+13.8 deg) **x** |
| hue_highlights | 30.125 / 29.166 (-1.0 deg) | 30.141 / 30.107 (-0.0 deg) | 29.969 / 30.971 (+1.0 deg) | 30.005 / 30.682 (+0.7 deg) | 28.587 / 29.406 (+0.8 deg) |
| glow_peak | 0.868 / 0.763 (-12.1%) (skipped) | 0.870 / 0.803 (-7.7%) (skipped) | 0.878 / 0.824 (-6.2%) (skipped) | 0.885 / 0.855 (-3.4%) (skipped) | 0.890 / 0.847 (-4.8%) (skipped) |
| glow_cx | 0.722 / 0.597 (-17.3%) (skipped) | 0.732 / 0.615 (-15.9%) (skipped) | 0.747 / 0.622 (-16.7%) (skipped) | 0.760 / 0.610 (-19.7%) (skipped) | 0.772 / 0.602 (-22.0%) (skipped) |
| glow_cy | 0.522 / 0.538 (+3.0%) (skipped) | 0.522 / 0.509 (-2.4%) (skipped) | 0.525 / 0.481 (-8.4%) (skipped) | 0.522 / 0.585 (+12.1%) (skipped) | 0.525 / 0.655 (+24.7%) (skipped) |
| glow_r50 | 2.667 / 3.333 (+25.0%) (skipped) | 2.667 / 4.000 (+50.0%) (skipped) | 3.000 / 4.333 (+44.4%) (skipped) | 3.000 / 4.667 (+55.6%) (skipped) | 3.000 / 2.667 (-11.1%) (skipped) |
| glow_r25 | 16.333 / 23.667 (+44.9%) (skipped) | 23.667 / 25.667 (+8.5%) (skipped) | 24.000 / 28.333 (+18.1%) (skipped) | 19.667 / 33.667 (+71.2%) (skipped) | 6.333 / 38.667 (+510.5%) (skipped) |
| glow_r10 | 77.333 / 66.333 (-14.2%) (skipped) | 78.333 / 67.333 (-14.0%) (skipped) | 79.667 / 68.000 (-14.6%) (skipped) | 81.000 / 68.667 (-15.2%) (skipped) | 82.000 / 69.667 (-15.0%) (skipped) |
| contrast_top | 0.355 / 0.347 (-2.3%) (skipped) | 0.345 / 0.396 (+15.0%) (skipped) | 0.311 / 0.425 (+36.4%) (skipped) | 0.259 / 0.432 (+66.5%) (skipped) | 0.272 / 0.415 (+52.7%) (skipped) |
| contrast_mid | 0.264 / 0.221 (-16.2%) (skipped) | 0.266 / 0.265 (-0.4%) (skipped) | 0.291 / 0.333 (+14.5%) (skipped) | 0.320 / 0.380 (+18.8%) (skipped) | 0.207 / 0.350 (+69.6%) (skipped) |
| contrast_bottom | 0.216 / 0.114 (-47.2%) (skipped) | 0.233 / 0.171 (-26.5%) (skipped) | 0.266 / 0.393 (+47.5%) (skipped) | 0.305 / 0.488 (+60.1%) (skipped) | 0.167 / 0.406 (+143.2%) (skipped) |
| contrast_far | 0.392 / 0.349 (-11.1%) (skipped) | 0.372 / 0.425 (+14.2%) (skipped) | 0.333 / 0.454 (+36.4%) (skipped) | 0.271 / 0.426 (+57.5%) (skipped) | 0.275 / 0.417 (+51.6%) (skipped) |
| contrast_near | 0.207 / 0.119 (-42.2%) (skipped) | 0.215 / 0.164 (-23.6%) (skipped) | 0.243 / 0.404 (+66.3%) (skipped) | 0.282 / 0.510 (+81.2%) (skipped) | 0.158 / 0.430 (+172.9%) (skipped) |
| mean_top | 0.227 / 0.220 (-3.1%) (skipped) | 0.227 / 0.233 (+2.6%) (skipped) | 0.225 / 0.256 (+13.4%) (skipped) | 0.212 / 0.269 (+26.8%) (skipped) | 0.211 / 0.304 (+44.1%) (skipped) |
| mean_mid | 0.199 / 0.182 (-8.5%) (skipped) | 0.200 / 0.188 (-6.1%) (skipped) | 0.203 / 0.196 (-3.3%) (skipped) | 0.206 / 0.204 (-1.0%) (skipped) | 0.196 / 0.202 (+3.1%) (skipped) |
| mean_bottom | 0.194 / 0.168 (-13.1%) (skipped) | 0.196 / 0.175 (-10.8%) (skipped) | 0.200 / 0.195 (-2.4%) (skipped) | 0.204 / 0.220 (+7.9%) (skipped) | 0.191 / 0.212 (+10.6%) (skipped) |
| grain | 0.000 / 0.000 (-49.9%) | 0.001 / 0.000 (-100.0%) | 0.001 / 0.001 (+36.0%) | 0.001 / 0.000 (-42.2%) | 0.001 / 0.001 (-20.6%) |
| detail_lapvar | 67.514 / 27.740 (-58.9%) (skipped) | 67.642 / 30.881 (-54.3%) (skipped) | 69.544 / 32.158 (-53.8%) (skipped) | 67.062 / 35.853 (-46.5%) (skipped) | 71.704 / 35.140 (-51.0%) (skipped) |
| vignette_ratio | 1.106 / 0.615 (-44.4%) (skipped) | 1.163 / 0.674 (-42.1%) (skipped) | 1.296 / 0.625 (-51.8%) (skipped) | 1.398 / 0.557 (-60.1%) (skipped) | 1.440 / 0.718 (-50.1%) (skipped) |
| mean_lum | 0.206 / 0.190 (-8.0%) | 0.208 / 0.198 (-4.4%) | 0.210 / 0.216 (+2.9%) | 0.207 / 0.231 (+11.4%) **x** | 0.199 / 0.239 (+20.0%) **x** |
| **outside target** | 3 of 29 | 2 of 29 | 3 of 29 | 5 of 29 | 4 of 29 |


**Reading these tables honestly:** the +-10 % target is not met across the board. Out of 29
measures per frame, the number outside target is:

| Video | 5 frames, measures outside target | Outside target in at least 3 of the 5 frames |
|---|---|---|
| 01 V1 chip | 9, 12, 7, 13, 13 | `mean_mid` (5/5), `detail_lapvar` (5/5), `glow_cx`, `contrast_bottom` (4/5), `lum_p50`, `pct_below_5`, `glow_r50`, `contrast_far`, `grain`, `mean_lum` (3/5) |
| 02 V2 chip (hue, saturation skipped) | 13, 10, 9, 13, 14 | `lum_p50`, `glow_r10`, `mean_mid` (5/5), `glow_cx`, `contrast_far`, `mean_lum` (4/5), `lum_p95`, `glow_r50`, `contrast_top`, `contrast_near`, `detail_lapvar` (3/5) |
| 03 V1 hourglass | 13, 12, 11, 9, 10 | `lum_p95`, `hue_midtones`, `contrast_top`, `contrast_far`, `detail_lapvar`, `vignette_ratio` (5/5), `lum_p99`, `glow_r25` (4/5), `lum_p50`, `contrast_bottom`, `contrast_near` (3/5) |
| 04 V2 hourglass (framing-dependent measures skipped) | 3, 2, 3, 5, 4 | `hue_midtones` (5/5), `lum_p95` (3/5) |

- *A:* the middle of the frame is darker than the reference (less blue haze pooled around the
  chip), the median is a little low, and fine detail and grain are below the reference's gritty texture.
- *B:* the real sand's glitter is far denser (`detail_lapvar`), my upper bulb and highlights are
  brighter than the reference's (`lum_p95`, `lum_p99`, `contrast_top`), the corners differ
  (`vignette_ratio`), and the backdrop midtones sit about 10 degrees more olive.
- *Stable over time:* the misses are the same kind from frame to frame, and the frame scan (4.A.4)
  found no flicker or jumps in light, haze or grain.

---

## 4. Step 8 checks

### 4.A Technical

| # | Check | 01 V1 chip | 02 V2 chip | 03 V1 hourglass | 04 V2 hourglass | Result |
|---|---|---|---|---|---|---|
| 1 | Resolution | 1920x1080 | 1920x1080 | 1920x1080 | 1920x1080 | PASS |
| 1 | Codec / pixel format | h264 / yuv420p | h264 / yuv420p | h264 / yuv420p | h264 / yuv420p | PASS |
| 1 | Frame rate | 30/1 | 30/1 | 30/1 | 30/1 | PASS |
| 1 | Frame count (counted by decoding) | 440 | 440 | 509 | 509 | PASS |
| 1 | Audio streams | 0 | 0 | 0 | 0 | PASS |
| 2 | Duration vs reference | 14.6667 s vs 14.6800 s (13.3 ms) | same | 16.9667 s vs 16.9503 s (16.4 ms) | same | PASS (under 33.3 ms) |
| 3 | Full decode `ffmpeg -v error ... -f null -` | 0 errors | 0 errors | 0 errors | 0 errors | PASS |
| 4 | Black frames (mean < 0.01) | 0 | 0 | 0 | 0 | PASS |
| 4 | Frozen / duplicated frame pairs | 0 | 0 | 0 | 0 | PASS |
| 4 | Brightness jumps (> 0.04 between frames) | 0 (max step 0.0095) | 0 (max 0.0107) | 0 (max 0.0013) | 0 (max 0.0013) | PASS |
| 4 | Flicker (alternating brightness steps) | 0 | 0 | 0 | 0 | PASS |
| 4 | Contact sheet, one frame per second, viewed | ok | ok | ok | ok | PASS |
| 5 | Loop | n/a | n/a | n/a | n/a | references do not loop |
| 6 | Determinism: cold-start frame vs same frame of a running render (PNG, byte compare) | identical (frame 220) | identical (frame 220) | identical (frame 254) | identical (frame 254) | PASS |
| 7 | Look over time | see 3.2 | see 3.2 | see 3.2 | see 3.2 | **PARTIAL**: stable, but not all measures within target |
| 8 | Banding / artefacts at levels x4 | none | none | none (faint H.264 block texture in the flat backdrop at x4) | same | PASS |
| 9 | ZIP test | see section 6 | | see section 6 | | PASS |
| - | File size | 77.3 MB | 75.5 MB | 13.3 MB | 15.5 MB | |

Notes on method:

- Check 4 is `scripts/scan-frames.py` (every frame decoded at 320x180).
- Check 6 compares lossless PNG frames, because the delivered H.264 is lossy and cannot be
  byte-compared: frame N rendered on its own with `remotion still` against frame N at the end of a
  `--sequence` render that started 6 frames earlier. SHA-256 of the pixel data matched in all four.
- Check 8 image: `qc/banding-x4.png`.
- Film grain was reduced in the chip project (0.035 -> 0.022) after the first full render came out
  at 135 MB at CRF 16; grain is expensive to encode and the lighter grain keeps each file under
  100 MB. This is one reason `grain` reads low for A in 3.2.

### 4.B Visual match by separate agents

Each reviewer was a fresh sub-agent given only the frames and the instruction from the brief.

**Step 4A look checks (3 rounds per reference, lighting / atmosphere / texture only)**

| Round | Reviewer's main points | What I changed |
|---|---|---|
| A-1 | Board too bright, saturated royal blue; beam azure not teal, too opaque; traces and white cubes too bright, orange accents and bokeh dots not in the reference; rim glow too thin; no depth of field; visible grain | Neutral board fill, parts flattened, accents recoloured teal, dust cut, frame widened and made bluer, bloom widened, depth of field and vignette up, grain down |
| A-2 | Still too blue and lifted (worst late); beam pale and milky; glow should be a hot core plus a fog pool at the beam foot; too much depth-of-field blur and bokeh; wants grit | Sampled region colours against the reference instead of guessing (board blue channel was 30-60 % high), cut the late blue fill, smaller haze, less blur, fewer dots, uneven trace brightness, hotter frame core |
| A-3 | Now too grey / charcoal with a milky chip top; beam too mint; frame too thick and white; wants a wide blue wash | Restored some blue in the board light and lift, removed the pale die-top fill, beam hue towards cyan, thinner frame, wider key falloff |
| B-1 | Background lifted olive with a wide glow; glass a milky tan fill; palette pale and cool; too many, too large, too white glints; streak a thick white bar; sand smooth and matte; light flat and frontal | Backdrop glow reduced, lower-bulb film removed, warmer sand / light / glints, glints cut to 8 and shrunk, streak thinned and broken up, key light moved to the right |
| B-2 | Glass has no rim highlights or fine reflections; sand smooth; top disc looks self-lit; glints haloed and too few; wants grain and sharpness | Added a thin amber silhouette line and fine glass lines, coarser brighter glitter with edge falloff, less top light, smaller tighter glints, more small ones |
| B-3 | Glass now only hairlines with no body; highlights too dim and orange; wants bigger haloed glints, paler champagne sand, cool haze on the left, softness | Brought back a faint film and a soft wide component in the streak, bigger glints with halo and more bloom, paler sand, cooler left backdrop, slight softness |

Reviewers disagreed with each other between rounds on grain (too much / too little), depth of field
and how blue the board should be; where they conflicted I went by the measured numbers.

**Step 8.10 visual match, Version 1 (3 rounds per reference, start / middle / end frames)**

| Round | Reviewer's main points | What I changed |
|---|---|---|
| A-V1-1 | Board reads as a 3D cityscape of raised blocks; die too tall (2-3x) and never brightens; outline a thick flat band; beam a parallel-sided pillar; too many bright bundled traces; no dark die at the start | Relief blocks flattened to a few millimetres, die height halved, die top brightens late, outline thinner with a hotter core, beam fans out as it rises with 1600 finer streaks, fewer chip traces, die and pins visible from frame 0, camera start given a slight roll |
| A-V1-2 | Board too clean and blue-tiled, wants grit and clusters of small bright parts; darks too bright and blue; die pale and translucent; beam pale | Added 150 clusters of small parts, stronger surface mottling, lower tile contrast, darker solid die with striped sides, more saturated and denser beam, less bloom |
| A-V1-3 (final video) | Still too clean and sharp versus the reference's soft, grainy, hazy look and dense micro-detail; beam too green-teal, wide and milky; die too tall and ribbed, flat in frame 1, top not glowing enough; outline bloom weaker; no floating bokeh dots; few dominant bright "hero" traces missing | **Not fixed** (three rounds used). Listed in section 8 |
| B-V1-1 | Lower bulb a flat triangle with radial rays; no neck or collar; sand drains too fast and too linearly; viewed too much from above; reference drifts right while mine is locked off; streak a "light sabre"; sand too orange | Rays removed, rounder wider lower bulb, a straight neck section, sand level re-timed with keyframes (middle sinks first, rim collapses late), camera elevation 20 -> 13 degrees, added the reference's slight rightward drift, streak made wavy and thinner, paler sand |
| B-V1-2 | Upper bulb never empties to a dark hollow; glass flat and vector-like; lower bulb fill too light; glints too big, sharp and few; whole image too crisp and saturated | Back-wall film cut so the emptied bulb goes dark, wider amber bands at the glass edges, lower-bulb film and fresnel reduced, narrower lower bulb, glints shrunk and 16 tiny ones added left of the stream, coarser glitter, softness up, saturation down |
| B-V1-3 (final video) | Framing, drift and timing now match. Still: glass reads as a flat illustration without real refraction or reflections; no thick neck / collar; sand is a smooth cone with glitter rather than dense grains; stream hard-edged and uniform; sparkles too crisp | **Not fixed** (three rounds used). Listed in section 8 |

**Step 8.10 visual match, Version 2**

| Video | Change clearly visible? | Same concept and quality otherwise? | Notes |
|---|---|---|---|
| 02 V2 chip, round 1 | **Yes** ("unmistakable in every frame") | Concept, composition, camera and timing: yes. Finish: **no** | V2-specific point: the brown board was lifted and hazy compared with V1's near-black. Fixed: V2 board fill and lift lowered to match V1's luminance, then re-rendered |
| 02 V2 chip, round 2 (final video) | **Yes** | Concept, layout, camera move and timing: yes. Finish: **no** | Remaining points are the ones V1 shares (clean sharp traces, weaker frame bloom, die body, no bokeh dots, darks still judged too bright). Not fixed |
| 04 V2 hourglass (final video) | **Yes** ("strong push-in and a perspective shift, while the reference barely drifts") | Concept: yes. Quality: **no** | Remaining points are the ones V1 shares (glass realism, sand texture, neck). The first V2 camera path (32 degree arc) was too close to V1 once V1 gained the reference's drift, so I replaced it with a wider move (60 degree arc, 9.6 -> 5.2 distance, 6 -> 28 degrees elevation) and re-rendered before this review |

So for both Version 2s the first answer is yes and the second is **not** a clean yes: the reviewers
accept the concept and the change, but hold V2 to the same finish gaps as V1.

**After delivery: shape feedback.** You pointed out that the hourglass did not look like the
reference's. Enlarged crops showed why: the reference is thick glass with a wide dark waist and
collar, a flat gold shoulder where the lower bulb begins and rounded flanks, while mine was one thin
surface pinching to an "X". The glass was rebuilt as an outer shell (`OUTER_PROFILE`) around an inner
cavity and the two stand-in collar blobs were removed. A fresh reviewer then judged shape only and
measured the first rebuild against the reference: waist about twice too tall (110 px against 55 px),
no hard break under the collar, lower bulb bell-curved instead of a straight cone (33-37 degrees
from vertical), upper bulb about 95 px too wide. The outline was set to those measurements and both
hourglass videos were re-rendered and re-checked. The 03 / 04 numbers in this report are from the re-rendered files; the Version 1 and
Version 2 reviewer rounds above were run on the earlier shape.

**Step 8.11 distinctness.** `qc/v1-v2-circuit-chip-beam.png` and `qc/v1-v2-golden-hourglass.png`
show V1 over V2 at three moments. The chip pair differs in colour at a glance with identical
geometry; the hourglass pair has the same palette and object with a different viewpoint in every
frame (low and wide at the start, close and looking down into the bulb at the end).

---

## 5. Look development record

Order followed: exposure and tone mapping (ACES, sRGB output) -> light -> atmosphere -> glow and
bloom -> texture -> lens, re-measuring after each change. The chip scene took about 14 measured
iterations before the first review and about 10 after; the hourglass about 12 and 8. Final settings
are in each project's `src/look.ts`.

- **Light.** A: no white light; a soft blue key from the frame (pulled 45 % towards a neutral where it
  lands on the board), a teal top light from the beam, a navy fill. B: warm key from front-right,
  warm fill, a separate top light for the sand surface, strip highlights on the glass.
- **Atmosphere.** A: exponential distance fade, a haze sprite around the chip, drifting dust that
  blurs with distance from focus, depth-of-field blur, vignette. B: none in the reference, so only
  bloom, slight softness and a faint cool-left / warm-right backdrop.
- **Glow.** Seven-level bloom chain with per-level weights (tight core plus wide halo), fed from a
  thresholded, Karis-weighted prefilter so thin HDR lines do not sparkle.
- **Texture.** A: three scales of surface noise, flat relief blocks, clusters of parts, uneven trace
  brightness. B: clumps / grains / single flakes in the sand, fibrous streak, dust film on the glass.
- **Grain.** Hash of (1080p-sized pixel cell, frame), faded out in black, so 4K and 1080p carry the
  same grain; then a +-1/255 dither.

---

## 6. ZIP test

Both ZIPs were extracted into a fresh folder, then `npm ci` and the README's 4K still commands were run:

| ZIP | `npm ci` | 4K frame, V1 | 4K frame, V2 |
|---|---|---|---|
| `circuit-chip-beam-project.zip` | ok | 3840x2160 written (frame 150) | 3840x2160 written (frame 150) |
| `golden-hourglass-project.zip` | ok | 3840x2160 written (frame 270) | 3840x2160 written (frame 270) |

No missing files. Each ZIP holds the source with both 4K compositions, `package.json`,
`package-lock.json`, `remotion.config.ts`, the scripts, the look-dev images and numbers, the
installed skills and the README. `node_modules`, `.git`, `out/` and the reference clips are left out.
There are no fonts, models, textures or data files to ship: the scenes are fully procedural.

A 4K frame measured against the matching 1080p frame differs only in `detail_lapvar` (+22 % for A,
+38 % for B: 4K is sharper); every other measure is within target, so the look holds at 4K.

---

## 7. Render times

Machine: 4 CPU cores, no GPU (WebGL through ANGLE on software rendering).

| Video | 1080p, measured | Notes |
|---|---|---|
| 01 V1 chip | 829 s for 440 frames (1.9 s/frame) | another render was running at the same time |
| 02 V2 chip | 520 s for 440 frames (**1.2 s/frame**) | rendered alone |
| 03 V1 hourglass | about 1.9-2.0 s/frame | rendered together with 04 |
| 04 V2 hourglass | about 1.9-2.0 s/frame | rendered together with 03 |

| Project | 4K, estimated | Basis |
|---|---|---|
| circuit-chip-beam | about **4.5 s/frame**, roughly 33 min per video | 8 frames at `--scale=1` took 39.4 s, 1 frame 7.9 s, single thread |
| golden-hourglass | about **4.1 s/frame**, roughly 35 min per video | 8 frames at `--scale=1` took 36.3 s, 1 frame 7.5 s, single thread |

Full 4K videos were not rendered, as instructed. The 4K figures are single-thread; default
concurrency should be somewhat faster, and a GPU much faster.

---

## 8. What could not be matched, and why

**Reference A (chip)**

- **Grit and micro-detail.** The reference board is dense with tiny irregular marks and a cracked,
  mottled surface. Mine is cleaner and more regular. More procedural clutter would close this; I
  stopped at the round limit.
- **Soft, hazy, grainy character.** Part of this is the 596 px preview's compression softness, which I
  chose not to bake into a 4K master. The measured grain is also below target after I lowered it to
  keep the files under 100 MB.
- **Beam.** Still wider and milkier than the reference's tight curtain of hair-fine streaks, and the
  hue is slightly greener.
- **Die.** Reads taller and more ribbed than the reference's thin slab, is nearly flat at the very
  start, and its top does not glow as strongly at the end.
- **A few bold "hero" traces and floating bokeh dots** from the reference are weak or absent.
- **Blacks.** Reviewers consistently judged my darks too bright while the measured medians say they
  are at or below the reference; I followed the measurements.

**Reference B (hourglass)**

- **Real glass.** The reference is live-action macro footage. After your note that the shape did not
  look like the reference, the glass was rebuilt as a thick-walled outer shell (short collared waist,
  hard break under the collar, near-straight cones, set from measurements of the reference) around an inner cavity that pinches to a pinhole, replacing
  the single thin surface that pinched to an "X". The outline now follows the reference; what is
  still missing is true refraction through the thick glass and its layered internal reflections, so
  it remains a stylised CG hourglass rather than a photoreal one.
- **Sand.** Real glitter sand has far denser fine sparkle than my three-scale procedural texture
  (`detail_lapvar` is 55-67 % below target), and the stream is too uniform and hard-edged.
- **Collar.** The dark waist now belongs to the glass itself, with a glint and a small red reflection,
  but it lacks the reference's dense internal reflections.
- **Glints** are placed by hand to match the reference's positions and twinkle on a seeded curve; they
  do not come from real reflections.
- **Framing.** 16:9 against the reference's 1.90:1: the width matches and there is a little more
  picture above and below.

**Both**

- The look targets (+-10 %) are met for most but not all measures (section 3), and none of the four
  videos got a clean pass from the independent reviewers on finish.
- The chip videos are 75-77 MB each at CRF 16.
