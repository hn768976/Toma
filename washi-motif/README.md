# Washi paper motif generator

A **still image** generator for stock illustration: traditional Japanese motifs
printed in gold and colour on textured handmade paper, arranged around the
frame's edges with the centre left open for copy.

There is no animation, no loop and no timing anywhere in this project.
`durationInFrames` is `1`. Everything is drawn once into a 2D `<canvas>` — no
3D, no Three.js.

- **Frame:** 3840 × 2560 (3:2), print-oriented.
- **Props:** exactly two — `composition` (one of eight named setups) and
  `palette` (one of six colour variations).

## Running it

```bash
npm install

npm run dev            # Remotion Studio

# one still
npx remotion still WashiMotif out/stills/washi-w01-goldWhite.png \
  --props='{"composition":"w01","palette":"goldWhite"}'

npm run batch          # all 16 stills + the contact sheet
npm run check:layout   # the open-centre / cropping guard
npm run lint           # tsc
```

`scripts/render-batch.sh` is a shell equivalent of `scripts/render-batch.ts`
for environments without a TypeScript loader.

Output: `out/stills/washi-<composition>-<palette>.png` and
`out/contact-sheet.png`.

## How it is put together

Everything that varies between images lives in data, and the renderer walks it.
**Adding a composition means adding an entry to `src/compositions.ts` — never
new code.**

| File | What lives there |
| --- | --- |
| `src/palettes.ts` | The six palettes. The **only** place hex literals appear. |
| `src/compositions.ts` | The eight compositions: motif, fill, placement, scale, rotation, ink, paper tone. Also the batch's palette pairing. |
| `src/paper.ts` | The washi sheet. |
| `src/motifs/shapes.ts` | The motif geometry. |
| `src/fills/treatments.ts` | The seven fill treatments. |
| `src/render/motif.ts` | Spec → pixels, the open-centre guard, and the per-instance draw. |
| `src/rng.ts` | The seeded random source. |

Components: `<PaperGround>`, `<MotifLayout>`, `<MotifShape>`, `<FillTreatment>`,
all mounted inside `<CanvasStage>`. Children do not draw themselves — they
register a draw callback with an order, and the stage runs the whole stack in
one pass once every child has registered. So the tree stays a real component
tree while the output is a single deterministic canvas pass.

### The paper ground

Built first, because it underlies everything and a flat fill will not do:

- a base tone, near-white or near-black per palette;
- **fibre texture** — ~4000 short strands, 15–90px at this resolution, random
  angles, 1–2px, very low contrast, plus a few hundred longer ones. Barely
  visible individually; collectively they are what separates washi from
  cartridge paper;
- **mottling** — broad soft tonal variation from overlapping radial falloffs,
  so no edge can show;
- a **grain** pass, ~2% per pixel;
- a slight overall gradient, one corner marginally brighter.

The sheet is rendered **once** into an offscreen canvas held by `useMemo` and
then blitted. Four thousand strands and ten million grain samples are not
something to redraw.

A composition declares its intended tone, but any composition can be rendered
in any palette, so the sheet also reads the paper colour itself — otherwise a
dark palette on a light composition gets near-white fibres and washes out.

### Motifs

`circle`, `ring`, `chrysanthemum`, `sakura`, `seigaiha`, `ringFlower`, `kumo`,
`dotCluster`. Each is a reusable path at any size and rotation.

- The **chrysanthemum**'s petals are identical and evenly spaced. That
  regularity is the motif; a jittered one reads as broken.
- The **sakura**'s notch and stamens are what make it a sakura rather than a
  generic flower. The notch is a nick, not a cleft — deeper and it reads as a
  heart.
- The **ring flower**'s petals are the negative spaces between overlapping
  circle outlines, not drawn shapes.
- The **kumo** is a union of overlapping subpaths under the non-zero rule, so
  its lobes merge into one silhouette.

### Fill treatments

`solid`, `stipple`, `lineFill`, `dotGrid`, `outline`, `metallic`, `woven`.

The **stipple** carries the set. Candidates come from a jittered grid and each
is kept with a probability taken from its position along the gradient
direction, so the shape fades across itself — printed gold leaf rather than a
halftone.

### The layout rule

Non-negotiable, and measured rather than eyeballed. Each composition declares
an `openCentre` (the central 52–60% of the frame) that no motif may enter.
Motifs cluster on the edges and corners, overlap freely, sit asymmetrically,
and are cropped by the frame — most of them mostly outside it.

`npm run check:layout` reports the minimum clearance and the cropped share for
every composition and exits non-zero if either rule is broken. The same check
runs inside `<MotifLayout>` and prints to the render log.

### Randomness

Every random value comes from Remotion's `random()`, seeded from the
composition name. `Math.random()` is never used, so a given composition always
produces the identical still, down to each fibre and each stipple dot.

## The eight compositions

| id | | palettes in the batch |
| --- | --- | --- |
| `w01` | Stipple circles — large stippled discs on all four edges, mostly cropped. The calmest. | `goldWhite`, `silverGold` |
| `w02` | Thin rings and dot clusters — sweeping outlines crossing at the corners. The most open. | `goldWhite`, `sakuraPink` |
| `w03` | Chrysanthemum row — top and bottom edges only, alternating line-fill and solid. The most formal. | `redGold`, `goldWhite` |
| `w04` | Ring flowers on dark — three corners over stippled discs. The only dark composition. | `goldBlack`, `indigoGold` |
| `w05` | Ring flowers on light — with woven and line-filled discs, four corners. Denser than w04. | `goldWhite`, `sakuraPink` |
| `w06` | Sakura corners — metallic blossoms on one diagonal, two corners empty. The boldest, and the fewest elements. | `goldWhite`, `redGold` |
| `w07` | Dual-tone stipple — two inks at equal weight. The second tone also gets a denser stipple, so it never collapses into w01. | `silverGold`, `goldWhite` |
| `w08` | Kumo clouds — one diagonal, three different treatments. | `goldWhite`, `indigoGold` |

## Palettes

`goldWhite`, `goldBlack`, `redGold`, `silverGold`, `indigoGold`, `sakuraPink`.
Each defines a paper base, a mottle tone, a fibre tone and three motif inks.
