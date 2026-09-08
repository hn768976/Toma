# Wave Map Stills

A still-image generator built in Remotion: a dot map of the world laid over a
rippling wave surface, lit from a single point and thrown out of focus
everywhere but one band. Everything is drawn to a 2D `<canvas>` — no 3D, no
Three.js.

**This project produces STILL IMAGES for stock illustration.** There is no
animation, no loop and no timing: the composition is registered with
`durationInFrames={1}` and rendered with `remotion still`.

- Composition id: **`WaveMap`**
- Output: **3840 × 2160 PNG** (4K, 16:9)

---

## Props

Three props drive everything.

| Prop | Type | Accepted values | Default |
| --- | --- | --- | --- |
| `seed` | `string` | any string — drives every random value in the piece | `"a01"` |
| `palette` | `string` | `blue`, `cyan`, `green`, `violet`, `amber`, `slate` | `"blue"` |
| `composition` | `string` | `c01` … `c12` | `"c01"` |

**The same seed reproduces the same image.** Every random value comes from
Remotion's `random()`, keyed by the `seed` prop plus a stable string path, so a
given `{seed, palette, composition}` triple always renders byte-for-byte the
same still. An unknown `palette` falls back to `blue` and an unknown
`composition` falls back to `c01`.

### The twelve compositions

Each entry sets the map viewport, the light position, the wave parameters, the
sharp-band position and angle, and the dot pitch. They live in
`src/lib/compositions.ts`.

| id | what it is |
| --- | --- |
| `c01` | world, light upper-right, gentle long waves, sharp band centre |
| `c02` | world drawn in closer, light upper-left, short choppy waves, sharp band lower-left |
| `c03` | Atlantic-centred, light centre-top, medium waves, sharp band across the middle horizontally |
| `c04` | Pacific-centred, light lower-right, long slow waves, sharp band diagonal |
| `c05` | Europe and Africa filling frame, light right edge, tight waves, sharp band on the left third |
| `c06` | Asia and Australia, light upper-centre, medium waves, sharp band upper half |
| `c07` | Americas, light left edge, long waves at a steep angle, sharp band right of centre |
| `c08` | world, very wide dot pitch — a coarse field with large gaps — light centred, minimal wave |
| `c09` | world, very fine dot pitch — a dense field — light lower-left, strong short waves |
| `c10` | Northern hemisphere band, light upper-right, waves running diagonally, sharp band narrow and central |
| `c11` | world tilted ~-8°, light upper-right, medium waves |
| `c12` | world pulled back, light off-frame to the upper-right so only its falloff is visible, long waves, sharp band lower-right |

### The six palettes

Defined in `src/lib/palettes.ts`, the only file in the project containing hex
colour literals. Each palette gives a background deep, background wash, ocean
dot, land dot, land bright, light core and accent colour.

`blue` · `cyan` · `green` · `violet` · `amber` · `slate`

---

## Rendering

```bash
npm install
```

One still:

```bash
npx remotion still WaveMap out/stills/wavemap-c01-blue.png \
  --props='{"seed":"c01-blue","palette":"blue","composition":"c01"}'
```

The whole batch — 24 stills, each composition in two palettes:

```bash
npm run batch                                          # all 24
node --experimental-strip-types scripts/render-batch.ts c03 c07   # a subset
CONCURRENCY=1 npm run batch                            # serially, on a small machine
```

Output lands in `out/stills/`, named `wavemap-<composition>-<palette>.png`
(e.g. `wavemap-c01-blue.png`). Each still's seed is `<composition>-<palette>`,
so every output is different and every one is reproducible.

The palette pairs (in `scripts/batch.ts`) are chosen so the set does not read as
twelve blues and twelve greens:

```
c01 → blue, amber      c07 → violet, green
c02 → cyan, violet     c08 → blue, slate
c03 → green, slate     c09 → amber, cyan
c04 → amber, blue      c10 → slate, violet
c05 → violet, cyan     c11 → green, blue
c06 → slate, green     c12 → cyan, amber
```

Then the contact sheet — all 24 tiled at reduced scale, four across and six
down, so each composition's two palettes sit side by side:

```bash
npm run contact-sheet     # writes out/contact-sheet.png
```

Preview the compositions interactively with `npm run dev`.

---

## Map data

Natural Earth **110m** country polygons, as redistributed in
[`world-atlas`](https://github.com/topojson/world-atlas), stored at
`public/ne-countries-110m.json` and fetched once at render time.

Natural Earth is in the **public domain** — no attribution or permission is
required for any use. See <https://www.naturalearthdata.com/about/terms-of-use/>.

Antarctica (and the Fr. S. Antarctic Lands) are omitted. The remaining polygons
are merged, projected with `d3-geo`'s `geoEquirectangular`, and rasterised once
into a coverage mask; a regular grid of screen positions is then sampled against
that mask, and the nodes that fall on land become the land dots.

---

## How it is put together

`src/WaveMap.tsx` mounts one `<canvas>` and a series of pass components, each of
which draws into it from a layout effect. React flushes sibling layout effects
in tree order, so the order the passes appear is the order they run in, and each
one is idempotent.

| pass | what it does |
| --- | --- |
| `<BackgroundPass>` | deep base plus a broad radial wash on the light and subtle mottling, computed at 1/8 resolution and upscaled |
| `<WaveField>` | evaluates the height field and displaces every dot vertically; derives crest-lit size and brightness |
| `<AccentCells>` | promotes ~2% of dots to the accent colour, as singles and short horizontal runs |
| `<DotMapSurface>` | draws every dot as a small square into one of four blur buffers |
| `<LightSource>` | a broad soft glow — deliberately with no hot core, so the light reads through its falloff and through the dots it lifts rather than as a bright point — plus faint ray streaks, on their own layer |
| `<FocusPass>` | blurs each of the four buffers exactly once on the way onto the frame |
| `<GrainPass>` | a fine seeded grain, laid down as a repeating tile |

The base dot set is generated once per composition (`useMemo` in `WaveMap`).

Depth of field uses four offscreen buffers bracketed by blur amount, each
blurred once — per-dot blurring would be unusable at 4K. Dots are assigned to a
bracket with a seeded dither, so the boundaries between brackets do not band.

---

## Project layout

```
src/
  WaveMap.tsx          the composition
  Root.tsx             registers WaveMap (durationInFrames 1, 3840x2160)
  components/          the render passes
  lib/                 palettes, compositions, projection, dots, wave, stage
scripts/
  batch.ts             the 24-still job list
  render-batch.ts      renders the batch
  contact-sheet.ts     tiles the batch into out/contact-sheet.png
public/
  ne-countries-110m.json
```
