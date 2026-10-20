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
| p5.brush | 1.1.4 (its peer range is `p5 ^1.11.0`) |
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

RENDER_TIMES_PLACEHOLDER

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
