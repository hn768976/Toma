# Washi paper generator

Two families of **still images**, from one engine:

- **the motif set** — eight bordered compositions that keep the centre open for
  copy (`WashiMotif`);
- **the surface set** — seventeen full-bleed textures: plain sheets, a seigaiha
  field, beaten gold leaf, watercolour washes, torn foil (`WashiSurface`).

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

# one surface
npx remotion still WashiSurface out/surfaces/washi-s04-goldLeaf.png \
  --props='{"surface":"s04"}'

npm run batch            # the motif set: 16 stills + the contact sheet
npm run batch:surfaces   # the surface set: 17 stills + the surface sheet
npm run check:layout     # the open-centre / cropping guard
npm run lint             # tsc
```

`scripts/render-batch.sh` is a shell equivalent of `scripts/render-batch.ts`
for environments without a TypeScript loader.

Output: `out/stills/washi-<composition>-<palette>.png`, `out/contact-sheet.png`,
`out/surfaces/washi-<surface>-<palette>.png` and `out/surface-sheet.png`.

## How it is put together

Everything that varies between images lives in data, and the renderer walks it.
**Adding a composition means adding an entry to `src/compositions.ts` — never
new code.**

| File | What lives there |
| --- | --- |
| `src/palettes.ts` | The six palettes. The **only** place hex literals appear. |
| `src/compositions.ts` | The eight bordered compositions: motif, fill, placement, scale, rotation, ink, paper tone. Also the batch's palette pairing. |
| `src/surfaces.ts` | The seventeen surfaces: ground kind and its parameters, plus any motifs laid over it. |
| `src/grounds.ts` | The four grounds: washi, cloth, metallic leaf, watercolour wash. |
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
- **fibre texture** — four passes, because real washi has several scales of
  fibre: a dense mat of very short pulp, ~13,000 characteristic strands of
  15–90px at random angles and 1–2px, ~1,400 long ones, and ~5,200 short thick
  **flecks** — bundles of fibre and bits of bark. The flecks are what the eye
  reads as handmade paper at a glance, and the only part of the texture that
  survives being seen from across a room. Nearly half the mid-length strands
  are laid inside clumps, because washi fibre bunches and an even scatter reads
  as digital noise. `longFibres: 0` gives an evenly felted machine sheet;
  above 1, a sheet that shows its bark;
- **mottling** — broad soft tonal variation from overlapping radial falloffs,
  so no edge can show;
- **cloudiness** — the mid-scale band between the mottling and the grain:
  coarse noise upscaled with smoothing. This is the band that survives
  downscaling, and without it the sheet looks flat in anything but a 1:1 crop;
- a **grain** pass, ~2% per pixel;
- a slight overall gradient, one corner marginally brighter.

Counts are per-sheet totals **scaled by area**, not fixed. Lengths scale with
the frame height, so if the counts did not scale with the area a half-size
contact-sheet tile would carry four times the fibre density of the still it
stands in for.

**Fibre tones are set by headroom, not by a fixed amount.** On an almost-white
sheet there is nowhere lighter to go, so a pale strand has to be white and the
contrast comes from the darker ones; on a coloured sheet — lime, vermilion,
navy — white is far too much and reads as a scatter of hard needles rather than
felted pulp. `makeSurface` in `src/paper.ts` is the single source of those
tones for every ground.

### Judging texture

A contact-sheet tile is a few hundred pixels wide and cannot show a fibre, so
tuning texture from one is guesswork. Three compositions exist for it:

```bash
npx remotion still PaperProof   out/proof.png                    # 1:1 washi crop
npx remotion still SurfaceProof out/proof.png --props='{"surface":"s03"}'
npx remotion still TextureProof out/proof.png \
  --props='{"surfaces":["s02","s05","s06","s11","s12","s14","s15","s16","s07"]}'
```

`TextureProof` tiles 1:1 crops of several surfaces at actual pixels — the
instrument for this, and the one that should be consulted before any texture
parameter is changed.

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

## The surface set

The companion product. The motif set keeps its centre open because it is made
to be typed over; a surface is the **material** — the sheet itself, edge to
edge — so there is no open-centre rule and the guard does not apply to it.

Each surface names the palette it was designed for, and `palette` is optional
on `WashiSurface` for that reason: defaulting it to a fixed name rendered every
surface in `s01`'s colours.

### Grounds

| kind | what it is |
| --- | --- |
| `washi` | The handmade sheet the motif set uses. `mottle` and `light` below 1 give an evenly formed sheet. |
| `cloth` | A woven board: fabric weave at right angles, chalk-dust smudges, a heavy vignette. |
| `metallic` | Beaten leaf: a directional sheen, creases running with it, an optional specular hotspot and sparkle. Still fibrous underneath, because leaf here is laid on washi. |
| `wash` | Watercolour: pigment blooms laid down with `multiply` so overlaps deepen, each a cluster of soft discs so its edge stays irregular, some with the darker rim watercolour dries to. |

The vignette is applied **after** the motifs, not under them — on a board or a
photographed sheet the falloff dims the pattern too.

### Surface motifs

Four motifs are built against the frame rather than against their own radius:

- **`seigaihaField`** — the wave-scale pattern over the whole sheet: rows of
  concentric top-half arcs on a half-offset grid. Every tile also gets its own
  faint tonal wash, which is what stops a field of identical arcs from looking
  printed.
- **`brushRing`** — a circle as a loaded brush leaves it: several wobbling
  strokes at slightly different radii, each stopping short of a full turn.
- **`foilSweep`** — everything to one side of a torn edge. The body is one
  polygon reaching well past the frame, so there is never a straight cut inside
  the picture, and the edge is three octaves of noise. `dryBrush` swaps the
  solid body for overlapping bands running *with* the stroke.
- **`splatter`** — flicked dots in a band, thrown along one direction.

### The seventeen

| id | | palette |
| --- | --- | --- |
| `s01` | Green board — woven cloth, chalk haze, heavy vignette | `boardGreen` |
| `s02` | Seigaiha field — wave scales over the whole sheet | `crimsonWave` |
| `s03` | Lime fibre paper — plain, dense even fibre | `limePaper` |
| `s04` | Gold leaf — strong diagonal sheen, heavy creasing | `goldLeaf` |
| `s05` | Vermilion paper — plain | `vermilionPaper` |
| `s06` | Navy paper — plain | `navyPaper` |
| `s07` | Peach wash — warm watercolour sky | `peachWash` |
| `s08` | Sumi and gold sweep — torn diagonal with splatter | `sumiGold` |
| `s09` | Amber wash — granulating stains | `amberWash` |
| `s10` | Gold discs — translucent discs over fibrous leaf | `goldLeaf` |
| `s11` | Cream discs — soft discs, each edged with a thin gold line | `creamPaper` |
| `s12` | Gold brush corners — torn gold in opposite corners | `shiroGold` |
| `s13` | Gold sheen — polished, one soft highlight, fine sparkle | `goldLeaf` |
| `s14` | White brush rings — overlapping, white on near-white | `shiroWhite` |
| `s15` | Sumi black paper — plain | `sumiBlack` |
| `s16` | Kraft paper — plain, heavily flecked | `kraftPaper` |
| `s17` | Sky wash — pale blue watercolour | `skyWash` |

Twenty-two palettes in total: the original six plus sixteen for the surfaces.
