# Cloud Flight · Rainbow Rings · Sun Through Leaves · Data Grid · Ripple Rings

One Remotion 4 project, 8 compositions, all 3840×2160 at 30 fps, every pixel
computed from `useCurrentFrame()` alone.

| Composition id (Remotion) | Output name | Length | Engine |
|---|---|---|---|
| `CloudFlight-Day` | `CloudFlight_Day` | 450 f (15 s) story | raymarched volumetric clouds (`@remotion/three`, WebGL2) |
| `CloudFlight-Sunset` | `CloudFlight_Sunset` | 450 f (15 s) story | same |
| `CloudSea-Loop` | `CloudSea_Loop` | 600 f (20 s) loop | same |
| `RainbowRings-Spectrum` | `RainbowRings_Spectrum` | 600 f loop | full-screen fragment shader |
| `SunLeaves-Summer` | `SunLeaves_Summer` | 600 f loop | PixiJS 8 (WebGL2) |
| `SunLeaves-Autumn` | `SunLeaves_Autumn` | 600 f loop | PixiJS 8 |
| `DataGrid-Teal` | `DataGrid_Teal` | 600 f loop | three.js instanced lines + tag atlas |
| `RippleRings-Blue` | `RippleRings_Blue` | 600 f loop | full-screen fragment shader |

Remotion composition ids may not contain `_`, so ids use `-`; the data rows
(`src/data.ts`) and output files keep the `_` names.

## Setup

```bash
npm install
npx remotion studio          # preview (the Studio caps canvas resolution so clouds stay interactive)
```

**Chromium GL flag:** the project renders with ANGLE — `remotion.config.ts`
sets `Config.setChromiumOpenGlRenderer("angle")` (CLI equivalent: `--gl=angle`).
WebGL2 only; no WebGPU. With a GPU, ANGLE uses it; without one, Chromium falls
back to SwiftShader (software), which is what the timings below were measured on.

## 4K render commands

The config already sets H.264, CRF 16, `yuv420p`, PNG intermediates and `--gl=angle`.

```bash
npx remotion render CloudFlight-Day       out/CloudFlight_Day.mp4       --muted
npx remotion render CloudFlight-Sunset    out/CloudFlight_Sunset.mp4    --muted
npx remotion render CloudSea-Loop         out/CloudSea_Loop.mp4         --muted
npx remotion render RainbowRings-Spectrum out/RainbowRings_Spectrum.mp4 --muted
npx remotion render SunLeaves-Summer      out/SunLeaves_Summer.mp4      --muted
npx remotion render SunLeaves-Autumn      out/SunLeaves_Autumn.mp4      --muted
npx remotion render DataGrid-Teal         out/DataGrid_Teal.mp4         --muted
npx remotion render RippleRings-Blue      out/RippleRings_Blue.mp4      --muted
```

720p previews: add `--scale=0.3333333333333333` (gives exactly 1280×720).
For long cloud renders on a slow machine, `scripts/render-all.sh` renders
resumable PNG sequences (`scripts/render-seq.mjs`) and encodes them with ffmpeg.

## Stills (6000×3375)

```bash
npx remotion still CloudFlight-Day out/CloudFlight_Day_6k.png --frame=90 --scale=1.5625
```

(any composition id; 2160 × 1.5625 = 3375). Not rendered here.

## Cloud quality setting

Each cloud row has `steps` (default **96** = full quality): the budget of lit
samples inside cloud. Lower values take proportionally longer steps through the
volume. Override for every cloud row at render time without editing data:

```bash
npx remotion render CloudFlight-Day out/draft.mp4 --props='{"cloudSteps":48}'
```

Trade-off: 48 roughly halves in-cloud cost (empty-space skipping is unchanged)
but softens thin wisps and slightly increases edge grain; 96 is used for all
deliverables. See measured numbers below.

## Measured render times

Machine: 4 vCPU cloud container, **no GPU** — Chromium ran WebGL2 on
SwiftShader (software rasteriser behind ANGLE). Any machine with a GPU will be
dramatically faster; these numbers are a worst case.

| Composition | 720p, steady-state per frame (1 tab) | 720p full preview (wall clock) | 4K estimate on this machine |
|---|---|---|---|
| CloudFlight_Day | 18.7 s | 2 h 06 m (450 f) | ~380 s/frame → ~47 h |
| CloudFlight_Sunset | 18.8 s | 2 h 20 m (450 f) | ~380 s/frame → ~47 h |
| CloudSea_Loop | 6.1 s | 1 h 33 m (600 f, shared CPU) | ~130 s/frame → ~22 h |
| RainbowRings_Spectrum | 0.27 s | 1 m 47 s | ~2.5 s/frame → ~25 min |
| SunLeaves_Summer | 2.6 s | 27 m | ~12 s/frame → ~2 h (est.) |
| SunLeaves_Autumn | 2.7 s | 26 m | ~12 s/frame → ~2 h (est.) |
| DataGrid_Teal | 0.59 s | 3 m 55 s | ~5 s/frame → ~50 min (est.) |
| RippleRings_Blue | 0.31 s | 1 m 49 s | ~2.8 s/frame → ~28 min |

**Two real 4K frames, timed** (cold `npx remotion still`, includes ~15 s of
browser start and noise-volume build):

* `CloudFlight-Day` frame 60 (inside the cloud banks): **397 s**
* `CloudSea-Loop` frame 300: **147 s**

Cloud 4K estimates scale these by pixel count; the others scale the 720p cost
by 9× (shaders) or less (Pixi/three.js, partly CPU-bound) — estimates, not runs.

**Cloud quality setting:** a 4K cloud frame is far above 20 s here, so the
`steps` field (default 96) exists. Measured at 720p on frame 60: `steps 96` =
21.4 s/frame, `steps 48` = 16.9 s/frame (−21 %); mean pixel difference 1.0/255,
99th percentile 10/255 (thin wisps a little softer, edges slightly grainier).
The gain is modest because empty-space traversal and the 6-step light march
dominate, not the lit-sample budget. **Recommendation: render the clouds on a
GPU machine at `steps 96`;** use `cloudSteps: 48` only for drafts.


## How it is built

* **Clouds** (`src/clouds/`): 128³ Perlin-Worley + Worley-fBm base volume,
  32³ Worley detail, 32³ curl noise — all tileable, generated once from
  fixed seeds (`noise.ts`). Weather maps (coverage, top, dilated max-top for
  empty-space skipping) are baked once (`weather.ts`); the flight's hand-placed
  cumulus masses (banks, the wall the camera pushes through, exit wisps) are
  baked into a 3D texture (`CloudScene.tsx`). The shader (`cloudShader.ts`)
  marches up to 96 lit samples with Beer–Lambert extinction, a powder term,
  dual-lobe Henyey–Greenstein phase (g = 0.8 / −0.2) with multiple-scattering
  octaves, 6-step sun march, sky/ground ambient, Rayleigh-style three-stop sky,
  procedural hazy terrain with cloud shadows, aerial perspective. Jitter is
  blue noise fixed per pixel; a 3×3 filter in the final pass removes march
  speckle. No temporal anything.
* **Cloud Sea loop:** camera travels exactly one 2400 m tile in 600 frames; all
  noise used for cloud shape and terrain has z periods dividing 2400 m; detail
  evolution is sampled on a circle.
* **Rainbow Rings:** ring phase from radius, analytic AA via `fwidth`; 12 ring
  spacings per loop; nine OKLCh keys held then blended, one hue revolution.
* **Sun Through Leaves:** 500 leaf sprites from 4 Canvas2D silhouettes pre-blurred
  at 4 strengths, seeded layout/tints, cosine sway with 1/2/3 whole cycles per
  loop; sun core + halo + 11 rays whose strength follows leaf coverage at the
  sun; 60 bokeh discs; flare ghosts; half-float target then grade.
* **Data Grid:** ~1200 seeded axis-aligned segments (+ circuit-style bends),
  dots at line ends, 150 JetBrains Mono tags in a canvas atlas redrawn per frame
  (values change on periods dividing 600), camera on a closed ellipse; DoF via
  per-instance circle-of-confusion widening (lines/dots) and mip bias (tags).
* **Ripple Rings:** analytic height field (raised rings + dimple lattice),
  normals from the analytic gradient, key + rim + specular; 10 wavelengths per loop.

**Banding:** every chain renders to a half-float target; the final pass adds a
fixed-formula grain (≈1 %, from pixel position and frame, faded below 3 %
luminance) and ±1/255 blue-noise dither (64² void-and-cluster tile, offset per
frame by an R2 sequence). Nothing uses `Math.random()`; everything random comes
from `mulberry32` seeds at build time.

## Add a colourway (one data row)

Copy a row in `src/data.ts`, give it a new `id` (letters, digits, `_`), change
its colours/parameters. `Root.tsx` registers one composition per row
automatically (with `_` → `-` in the id). E.g. a winter Sun Leaves:

```ts
{ ...ROWS.find((r) => r.id === "SunLeaves_Summer")!, id: "SunLeaves_Frost",
  leaves: ["#5A7A8A", "#8AA8B8", "#C8DCE6", "#E6F0F4", "#FFFFFF"], sun: "#F4FAFF", seed: 7 }
```

## Fonts

`public/fonts/JetBrainsMono-Medium.woff2` — JetBrains Mono, SIL Open Font
License 1.1 (`public/fonts/OFL.txt`). No other text appears in any composition.

## Verification (run here on the 720p previews)

Scripts live in `scripts/verify/`.

| Check | Result |
|---|---|
| 1. ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, 15.0 s / 20.0 s | all 8 pass |
| 2. Loop: frame 600 vs 0 with `--props='{"loopCheck":true}'` (601 frames) | all 6 loops pixel-identical, byte-identical |
| 2b. Seam: step 599→0 vs a normal step 0→1 (mean abs diff) | equal for all 6 (e.g. Cloud Sea 2.00 vs 1.99) |
| 3. Middle frame rendered alone from cold vs the same frame from the full render | all 8 **byte-identical** |
| 4. Banding: frames decoded **from the mp4**, 3 vertical lines × 4 times | no bands: longest run of identical values in a smooth gradient ≤ 12 px (dithered) except one 13-px plateau at 238 inside the sun glow of Sun Leaves (soft-clipped highlight, no step) |
| 5. Contact sheets (8 frames for stories, 5 for loops) | `out/sheets/` — story beats and colour cycles present |
| 6. 2 s around the middle, frame-to-frame change | steady (no flicker/strobe); see `smoothness.txt` |

Banding notes: everything renders to half-float targets; dither ±1/255 blue
noise + ~1 % grain in the final pass. The first encodes showed x264 at CRF 16
flattening the dither in the cloud skies (flat runs of 17–23 px); encoding with
`-tune grain` (now in `remotion.config.ts` and `scripts/encode.sh`) fixed it.
Values ≤ 8/255 are excluded from the run count: the brief fades grain out
below 3 % luminance, so pure-black falloffs are flat by design.

## Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps, 450/600 frames, one data row each
- [x] Clouds: Perlin-Worley + Worley 3D noise built once (128³/32³), curl distortion, 96-step march with 6-step sun march, Beer–Lambert, powder, dual HG, ambient, Rayleigh-style sky, hazy terrain, fixed per-pixel blue-noise jitter, no temporal accumulation
- [x] Cloud Flight story: banks → near-whiteout (~5.5–6.5 s) → out above the layer → glide; Day and Sunset
- [x] Cloud Sea: one tile period per loop, evolution on a time circle — seamless
- [x] Rainbow Rings: 12 whole ring spacings per loop, OKLCh hue cycle once, nine held keys, `fwidth` AA
- [x] Sun Leaves: 500 pre-blurred sprites in 4 layers, whole-cycle sway, coverage-driven sun/rays, 60 bokeh, flare ghost; Summer + Autumn
- [x] Data Grid: ~1200 axis-aligned lines, 150 JetBrains Mono tags with values on periods dividing 600, closed camera path, DoF
- [x] Ripple Rings: source at (90 %, 76 %), 10 wavelengths per loop, dimple lattice, key/rim/specular
- [x] Half-float targets, dither, fixed-formula grain, no `Math.random()`, no clocks, `delayRender` for textures/fonts
- [x] Determinism verified byte-for-byte
- [ ] Look-match to references — see "Known differences" below

## Known differences from the references

After three rounds of independent visual comparison, these remain:

* **Clouds:** the reference at 3 s is almost all cloud with a milky veil; ours
  shows more open sky and land through gaps. At 12 s the reference has distinct
  towering cumulus; ours is a lower, lumpier deck with some spiky far tops.
  Independent "is this real footage?" reviews still call both versions CGI
  (lighting too even, grainy edges, a few stray small puffs, ground reads as water).
* **Ripple Rings:** reference is softer and glowier (blurred blobs, black gaps);
  ours reads as crisper embossed studs.
* **Data Grid:** still more long lines and fewer tiny far tags than the reference.
* **Sun Leaves:** reads as generated bokeh rather than a real canopy; Autumn
  leans amber-gold more than orange/red-brown.
* **Rainbow Rings:** close match (ring width, bevel, colours).

