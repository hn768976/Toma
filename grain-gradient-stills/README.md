# grain-gradient-stills

A Remotion project that renders **4K 16:9 still images** — soft, additively
mixed colour fields under heavy film grain, of the kind stock libraries file
under "grain gradient".

These are stills, not video. The composition is one frame long; there is no
animation, no loop and no timing anywhere in the project.

- **Composition id:** `GrainGradient`
- **Output:** 3840 × 2160 PNG
- **Reproducible:** the same `composition` and `palette` always produce the
  same image, byte for byte. All randomness runs through Remotion's `random()`
  seeded from the composition name, never `Math.random()`.

## Props

| Prop | Accepted values |
| --- | --- |
| `composition` | `g01` `g02` `g03` `g04` `g05` `g06` `g07` `g08` |
| `palette` | `cyanMagenta` `warmSpectrum` `crimsonGlow` `deepBlue` `violetBlue` `tealPurple` |

### Compositions

| id | arrangement | grain |
| --- | --- | --- |
| `g01` | Two poles, dark between and around, meeting in a broad transitional band | moderate |
| `g02` | Three parallel bands on a lower-left to upper-right diagonal, upper-left near black | heavy |
| `g03` | One wide horizontal band across the middle third with differently coloured ends | heavy |
| `g04` | A narrowing beam sweeping in from the lower-right, upper-left corner black | moderate |
| `g05` | A shallow curve across the lower half, rising to the right, upper half empty | moderate |
| `g06` | Six narrow vertical streaks at irregular positions, the busiest of the set | very heavy |
| `g07` | A full-frame diagonal transition corner to corner, the most saturated | heavy |
| `g08` | Four overlapping floods, no dark centre — the one that takes dark text | moderate |

## Rendering one still

```sh
npx remotion still GrainGradient out/stills/graingrad-g01-cyanMagenta.png \
  --props='{"composition":"g01","palette":"cyanMagenta"}'
```

Any composition and palette may be combined; the pairings below are simply the
ones the batch renders.

## Rendering the batch

Sixteen stills — each composition in two palettes:

```sh
npx tsx scripts/render-batch.ts                  # all sixteen, 4K, to out/stills
npx tsx scripts/render-batch.ts --scale=0.25     # quick low-resolution proofs
npx tsx scripts/render-batch.ts g02 g07          # only these compositions
npx tsx scripts/render-batch.ts --out=out/other  # somewhere other than out/stills
```

Files are named `graingrad-<composition>-<palette>.png`.

| composition | palettes |
| --- | --- |
| `g01` | `cyanMagenta`, `deepBlue` |
| `g02` | `warmSpectrum`, `tealPurple` |
| `g03` | `crimsonGlow`, `violetBlue` |
| `g04` | `deepBlue`, `cyanMagenta` |
| `g05` | `violetBlue`, `crimsonGlow` |
| `g06` | `warmSpectrum`, `violetBlue` |
| `g07` | `cyanMagenta`, `tealPurple` |
| `g08` | `tealPurple`, `deepBlue` |

## Contact sheet

After the batch, tile all sixteen into `out/contact-sheet.png`, each
composition's two palettes side by side:

```sh
npx tsx scripts/contact-sheet.ts
```

It stages the stills into `public/` for the render and clears them afterwards.

## How the image is built

`src/compositions.ts` holds every value that varies — blob positions, radii,
falloff shapes, blur, grain intensity, background darkness, edge falloff.
Adding a ninth composition is a data edit; the renderer walks the structure and
knows nothing about individual setups. `src/palettes.ts` is the only file
permitted a colour literal.

Three stages run in order over one unquantised float buffer:

1. **`<ColourField>`** draws each blob as a radial gradient inside a rotate and
   scale transform, composites them with `lighter` so overlaps *add* and
   produce the intermediate hues, then blurs the whole field heavily at full
   resolution.
2. **`<EdgeFalloff>`** darkens towards the edges asymmetrically, per edge and
   per named corner, and mixes in the background.
3. **`<GrainPass>`** lays in monochrome grain — coarser than the pixel grid,
   varying by region from a low-frequency field, heavier in the dark — and a
   sub-LSB dither.

Only after all three does the field get quantised to 8 bits. Two decisions in
there are load-bearing and both are commented at length in the source: the blur
is done in float rather than through `ctx.filter`, which decimates and upscales
past a small radius; and the grain goes in *before* the single rounding to
8 bits, because grain laid over an already-banded image cannot remove the bands
underneath it.

## Scripts

| command | does |
| --- | --- |
| `npm run dev` | Remotion Studio |
| `npm run batch` | renders the sixteen stills |
| `npm run contact-sheet` | renders the proof sheet |
| `npm run typecheck` | `tsc` |
