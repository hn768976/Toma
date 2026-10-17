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

MEASUREMENTS_PLACEHOLDER

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

VERIFY_PLACEHOLDER
