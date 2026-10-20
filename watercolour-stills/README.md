# Pure Watercolour — 35 background stills

Watercolour-only backgrounds (washes, blooms, glazes, splatters on cold-press
paper; no line art, objects or text), painted in code with **p5.js + p5.brush**
and rendered as **Remotion `<Still>` compositions** at **6000×3375** PNG.

18 compositions × colourways = 35 stills. Every still is fully seeded: no
`Math.random()`, no clock, so re-rendering gives a byte-identical PNG.

## Pinned versions

| package | version |
|---|---|
| remotion, @remotion/cli, @remotion/renderer, @remotion/bundler | 4.0.515 |
| react, react-dom | 19.2.3 |
| p5 | 1.11.13 |
| p5.brush | 1.1.4 (its peer range is `p5 ^1.11.0`); vendored in `src/vendor/` with one patch, see below |
| sharp (contact sheet) | 0.34.5 |
| typescript | 5.9.3 |

`package-lock.json` pins every transitive dependency too.

## Render

```bash
npm ci
npm run render                       # all 35 -> out/stills/*.png (6000x3375)
node scripts/render.mjs --only 1,6   # by composition number…
node scripts/render.mjs --only WC-03-GradedSky-OceanBlues   # …or by composition id
node scripts/render.mjs --preview 1920 --out out/preview    # quick 1920x1080 look
npm run contact-sheet                # out/ContactSheet.png (7x5 tiles, 640x360, labelled)
npm run verify                       # sizes, names, uniqueness, content, banding
node scripts/render.mjs --only 1,8,14 --out out/rerun && python3 scripts/verify.py --determinism out/rerun
npm run package                      # out/watercolour-stills.zip, out/watercolour-stills-project.zip
npm run studio                       # browse the compositions in Remotion Studio
```

Rendering needs a Chromium with WebGL2 + `EXT_color_buffer_float`. With no
GPU, Remotion's `swangle` (SwiftShader) backend is used; `remotion.config.ts`
and `scripts/render.mjs` pick up a Playwright Chromium at `/opt/pw-browsers`
when present, otherwise Remotion's own browser.

`verify.py` needs Python 3 with Pillow and NumPy.

## How it works

```
src/
  Root.tsx                 registers one <Still> per row of data/stills.ts
  WatercolourStill.tsx     paints (p5.brush), then composites (WebGL2); delayRender until done
  data/palettes.ts         pigment palettes (+ how much each granulates)
  data/stills.ts           the 35 rows: composition, palette, seed, density
  layouts/*.ts             the 18 compositions (one Layout each)
  engine/painter.ts        p5 WEBGL instance + p5.brush fills
  engine/effects.ts        blooms/backruns, drops, splatter, drips, salt, brush swatches, streaks
  engine/shapes.ts         seeded organic outlines (blobs, bands, ribbons, flow paths)
  engine/composite.ts      paper + pigment physics (see below)
  engine/color.ts          Beer–Lambert concentration (tints and deep accents)
```

1. **Paint.** A p5.js 1.11 instance in WEBGL mode with p5.brush, seeded with
   `brush.seed()`. Everything is a `brush.fill()` with bleed and texture:
   washes, wet-in-wet drops, glazes (layered transparent fills), bloom collars
   and pale cores, splatter droplets, drips, salt marks and brush swatches.
   p5.brush mixes colours with its Kubelka–Munk (spectral.js) shader, so
   overlapping fills glaze rather than cover.
2. **Composite** (`engine/composite.ts`, WebGL2), all in optical density:
   - procedural cold-press paper, warm white `#FAF7F0`: smooth-Voronoi tooth,
     mid-scale noise, fibres and gentle cockle, lit softly from the upper left;
     multiplied over the paint, so the tooth shows through every wash;
   - pigment settles into the dips of the tooth and thins on the peaks;
   - drying rims: density is raised by `(D / blur(D))^edge`, which darkens the
     inner edge of every wash and tightens its outer fringe; on the fringe the
     wash breaks up along the tooth;
   - granulation (blues, earths, Payne's grey: set per palette) as fine dark
     specks that collect in the grain, patchy across a wash;
   - triangular dither on output, so smooth gradients never band in 8 bits.
   If a still is painted below output size (`paintScale < 1`) the density is
   upscaled with a separable Lanczos-3 filter before the paper is applied.

### Add a palette (one data row)

Add an entry to `src/data/palettes.ts`:

```ts
RoseGold: { name: "Rose Gold", colors: ["#D8A0A0", "#C89060", "#E8C8A0"], granulation: 0.2 },
```

then use it in a row of `src/data/stills.ts`.

### Add a still (one data row)

Add a row to `src/data/stills.ts`:

```ts
{ n: 19, layout: "centreBloom", palette: "RoseGold", seed: 19101 },
```

It becomes the composition `WC-19-CentreBloom-RoseGold` and renders to
`WC_19_CentreBloom_RoseGold.png`. Optional fields: `density` (0.5–1.5, how
much paint the layout puts down) and `paintScale` (see Render times).

### Add a composition

Write a `Layout` (`label` for the file name, async `paint(ctx)` using
`ctx.painter.wash()` and the helpers in `engine/effects.ts`), register it in
`src/layouts/index.ts`, then add data rows. Keep fills of one colour together:
p5.brush runs one full-sheet blend pass each time the fill colour changes.

## Render times

Measured in this repo's cloud container: 4 vCPU, no GPU (SwiftShader WebGL via Remotion's `swangle`), one still at a time. **All 35 are painted natively at 6000×3375 (`PAINT_SCALE = 1`, no upscaling).** The first still (WC_01, BloomField) took about 146 s at 6K, under the 3-minute threshold, so the Lanczos 2× path was not needed. It is still there: set `paintScale: 0.5` on a row, or pass `--paint-scale 0.5`.

Total 66 min for 35 stills; per still 73–177 s (mean 113 s). Each total includes painting, compositing, the browser screenshot and PNG encoding.

| still | total | paint | composite | p5.brush fills |
|---|---:|---:|---:|---:|
| WC_01_BloomField_BlushPastel.png | 136 s | 98 s | 36 s | 51 |
| WC_01_BloomField_OceanBlues.png | 132 s | 95 s | 35 s | 51 |
| WC_02_CornerWashes_SageEucalyptus.png | 91 s | 53 s | 36 s | 76 |
| WC_02_CornerWashes_SunsetCoral.png | 87 s | 51 s | 34 s | 77 |
| WC_03_GradedSky_LavenderDusk.png | 107 s | 70 s | 35 s | 39 |
| WC_03_GradedSky_OceanBlues.png | 108 s | 72 s | 34 s | 39 |
| WC_04_HorizontalBands_SoftRainbow.png | 100 s | 64 s | 34 s | 21 |
| WC_04_HorizontalBands_TerracottaEarth.png | 87 s | 51 s | 35 s | 16 |
| WC_05_SplatterDrips_IndigoNight.png | 149 s | 114 s | 33 s | 561 |
| WC_05_SplatterDrips_SunsetCoral.png | 153 s | 116 s | 35 s | 562 |
| WC_06_CentreBloom_GoldenOchre.png | 79 s | 43 s | 34 s | 14 |
| WC_06_CentreBloom_LavenderDusk.png | 83 s | 45 s | 37 s | 14 |
| WC_07_EdgeBleedFrame_BlushPastel.png | 123 s | 88 s | 33 s | 57 |
| WC_07_EdgeBleedFrame_IndigoNight.png | 125 s | 90 s | 33 s | 57 |
| WC_08_LayeredGlazes_MintPeach.png | 73 s | 39 s | 32 s | 13 |
| WC_08_LayeredGlazes_OceanBlues.png | 82 s | 46 s | 34 s | 13 |
| WC_09_LooseDots_SageEucalyptus.png | 114 s | 79 s | 33 s | 56 |
| WC_09_LooseDots_SoftRainbow.png | 168 s | 133 s | 33 s | 61 |
| WC_10_BrushSwatches_BlushPastel.png | 95 s | 60 s | 34 s | 117 |
| WC_10_BrushSwatches_TerracottaEarth.png | 96 s | 60 s | 34 s | 123 |
| WC_11_SaltTexture_IndigoNight.png | 137 s | 100 s | 35 s | 243 |
| WC_11_SaltTexture_SageEucalyptus.png | 135 s | 100 s | 33 s | 249 |
| WC_12_GranulatingWash_OceanBlues.png | 77 s | 43 s | 32 s | 9 |
| WC_12_GranulatingWash_TerracottaEarth.png | 78 s | 43 s | 33 s | 9 |
| WC_13_PourDrip_LavenderDusk.png | 151 s | 116 s | 33 s | 25 |
| WC_13_PourDrip_SunsetCoral.png | 177 s | 141 s | 34 s | 29 |
| WC_14_MarbledBlend_GoldenOchre.png | 123 s | 88 s | 33 s | 30 |
| WC_14_MarbledBlend_MintPeach.png | 127 s | 94 s | 32 s | 30 |
| WC_15_AbstractHorizon_LavenderDusk.png | 113 s | 78 s | 32 s | 14 |
| WC_15_AbstractHorizon_SageEucalyptus.png | 113 s | 77 s | 34 s | 14 |
| WC_16_ConfettiDabs_GoldenOchre.png | 127 s | 92 s | 33 s | 143 |
| WC_16_ConfettiDabs_SoftRainbow.png | 161 s | 126 s | 33 s | 143 |
| WC_17_DiagonalSweep_BlushPastel.png | 77 s | 43 s | 33 s | 31 |
| WC_17_DiagonalSweep_IndigoNight.png | 76 s | 40 s | 33 s | 31 |
| WC_18_HalfPageWash_OceanBlues.png | 88 s | 53 s | 33 s | 21 |

Speed notes: each fill colour change costs p5.brush one full-sheet spectral blend pass (about 5–10 s at 6K on SwiftShader), so layouts group fills by colour. p5.brush's Canvas2D mask buffers are made CPU-backed (`willReadFrequently`). On a GPU-less renderer that alone cut painting time by more than 10×.

## The p5.brush patch

`src/vendor/p5.brush.js` is p5.brush 1.1.4's ES-module source with one change in `FillPolygon.trim`. The original removes one contiguous run of vertices from the middle of each layer polygon, which leaves a long straight chord across the shape. That chord showed as faceted inner layers and one-sided haze beside thin shapes. The patched version thins vertices evenly around the outline instead. The npm package stays a dependency (pinned) as the reference copy.

## Licences

- **p5.brush** 1.1.4 — MIT License, © 2023–2024 Alejandro Campos Uribe.
  <https://github.com/acamposuribe/p5.brush>. The full licence text ships in
  `node_modules/p5.brush/LICENSE.md` and is reproduced here:

  > Permission is hereby granted, free of charge, to any person obtaining a copy
  > of this software and associated documentation files (the "Software"), to deal
  > in the Software without restriction, including without limitation the rights
  > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  > copies of the Software, and to permit persons to whom the Software is
  > furnished to do so, subject to the following conditions:
  >
  > The above copyright notice and this permission notice shall be included in
  > all copies or substantial portions of the Software.
  >
  > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  > SOFTWARE.
- p5.js — LGPL-2.1. Remotion — Remotion License (free for individuals and
  small companies; see <https://remotion.dev/license>).
