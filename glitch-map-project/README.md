# Glitch Country Map — Remotion template

A country silhouette drawing itself onto a heavily glitched field, filling with
scanlines, then solidifying. 3840×2160, 30fps, 360 frames (12s). Not a loop —
it builds from nothing to a solid map and holds.

**23 countries × 2 colourways = 46 compositions**, all configured and
4K-render-ready.

```bash
npm install
npx remotion studio
```

---

## The build sequence

| Frames | Beat |
|---|---|
| 0–70 | Glitch field only, with a `LOADING` ring at frame centre — two thin concentric circles and a counter beneath, counting up. Fades out by ~frame 70. |
| 60–170 | The country outline **traces on**: a bright stroke drawn along the border path, brighter at the leading point with a short trail behind it. |
| 150–260 | The fill arrives as **horizontal scanline stripes**, filling bottom to top with visible gaps. |
| 250–310 | The stripes **consolidate** — gaps close, the shape becomes continuous. |
| 300–360 | Hold on the solid map, glitch field still running beneath and over it. |

The trace window is fixed, so **every country completes its trace between frames
60 and 170** no matter how long its coastline is. A complex coastline simply
traces faster; it never takes three times as long as a simple one. The stroke is
driven by `stroke-dashoffset` against the path's exact measured length
(`measurePathLength` in `src/geo.ts`), not by a DOM `getTotalLength()` call — so
it is identical on every frame and every thread.

---

## Colourways

Geometry, timing and glitch behaviour are identical between them, so the two
read as a matched pair. Only `src/colourways.ts` changes.

| | `green` | `blue` |
|---|---|---|
| Background | `#030a04` (near-black, green cast) | `#030814` (near-black, navy cast) |
| Glitch bands | `#c8ff20` / `#7aff10` | `#20d8ff` / `#1080ff` |
| Outline | `#5bff2a` | `#38e6ff` |
| Fill | `#c8ff20` @ 70% | `#1080ff` @ 70% |

---

## Rendering

Compositions are defined at **3840×2160**. Composition ids are
`<CountryName>-GlitchMapGreen` / `<CountryName>-GlitchMapBlue`.

### 4K, one composition

```bash
npx remotion render src/index.ts Poland-GlitchMapGreen out/Poland_GlitchMapGreen.mp4
```

Substitute any id from the checklist below. Encoder settings — H.264, CRF 13,
`yuv420p`, bt709, no audio track — are already set in `remotion.config.ts`; no
flags needed.

### 4K, everything

```bash
npm run render-all
```

Renders all 46 into `out/` as `<CountryName>_GlitchMap<Colourway>.mp4`, sharing
one bundle and one browser across the batch instead of paying for both 46 times.
It prints a per-composition ms/frame as it goes. Useful flags:

```bash
node scripts/render-all.mjs --scale=0.5              # 1080p instead of 4K
node scripts/render-all.mjs --only=Poland,Indonesia  # a subset
node scripts/render-all.mjs --out=out/4k
```

### 1080p preview

```bash
npx remotion render src/index.ts Poland-GlitchMapGreen out/Poland_GlitchMapGreen.mp4 --scale=0.5
npx remotion still  src/index.ts Poland-GlitchMapGreen out/Poland_GlitchMapGreen.png --frame=340 --scale=0.5
```

`--scale=0.5` renders the 4K composition at half size. Every dimension in the
project is a fraction of `useVideoConfig()`, so the preview is the 4K frame,
scaled — not a different-looking build.

### Measured render cost at 4K

Measured on this build by rendering two segments of `Poland-GlitchMapGreen` at
`--scale=1` and differencing them, which cancels the fixed start-up cost:

| | |
|---|---|
| Machine | 4 vCPU, 14 GB, Remotion default concurrency |
| 20 frames | 29.7 s |
| 60 frames | 76.0 s |
| **Marginal cost per 4K frame** | **1.16 s** |
| Fixed overhead per composition | ~6.5 s (warm bundle) |
| **One full 360-frame 4K clip** | **~7 min** |
| All 46 compositions, serial | **~5.4 h** |

Per-frame cost is dominated by the glitch field, which is drawn on canvas at
full frame size every frame; it is close to flat across countries (Indonesia's
133-part outline cost ~8% more than Poland's single polygon at 1080p). Scale the
figures linearly by core count when scheduling the remaining batch.

### Bitrate

Per-frame glitch noise is expensive to compress. CRF is set to **13**. The 1080p
previews land at 74–91 Mbit/s and the bands hold their texture — checked by
pulling frames back out of the encoded files, not by trusting the setting. If a
4K encode shows the bands smearing into mush, raise the quality further
(`Config.setCrf(12)` or lower — lower CRF means higher quality).

There is **no audio track** on any output. Verified:

```
$ npx remotion ffprobe out/previews/Poland_GlitchMapGreen.mp4
  nb_streams=1   codec_type=video   pix_fmt=yuv420p   30/1   360 frames
```

---

## Map data

Geometry source: **[Natural Earth](https://www.naturalearthdata.com/), 1:50m
Cultural Vectors, Admin 0 – Countries.** Natural Earth is in the **public
domain** — no attribution is required, though crediting it is welcome. It
reaches this project through the [`world-atlas`](https://github.com/topojson/world-atlas)
npm package, which is a TopoJSON build of the same file.

`src/countries.ts` is the **single data file**: it holds both the country list
and the baked polygons. Regenerate it with `npm run bake`.

### Borders

Natural Earth's boundaries are reproduced **as published, unmodified**. No ring
is clipped, edited or redrawn, and no disputed boundary is adjusted in either
direction. Coordinates are rounded to 4 decimal places (~11 m), which is far
below one pixel at 3840×2160.

Two consequences of using Natural Earth's own admin-0 units, noted so they are
not mistaken for edits: Taiwan is a separate unit in Natural Earth, so it is not
drawn as part of China; and India is drawn on Natural Earth's de-facto
boundaries. Both are the published data, untouched.

The clip is descriptive: a silhouette and nothing more. No targeting graphics,
no conflict iconography, no labels.

### Territories

Where a country has non-contiguous territory, a part is either **kept whole or
dropped whole** — never cut. A dropped part is simply outside the framing, so no
partial, unfilled piece of the subject country can ever appear on screen.

`parts` below is parts drawn / parts in the Natural Earth unit.

| Country | Composition prefix | Projection | Parts | `territories` | `scaleOverride` |
|---|---|---|---|---|---|
| United States | `UnitedStates` | albersUsa | 127/127 | all (50 states; Alaska and Hawaii shown as the standard Albers USA composite insets) | 1 |
| China | `China` | mercator | 13/13 | all | 1 |
| India | `India` | mercator | 14/14 | all (includes Andaman & Nicobar and Lakshadweep) | 1 |
| Russia | `Russia` | conicEqualArea | 99/99 | all (incl. Kaliningrad, Franz Josef Land, Wrangel Island across the antimeridian) | 1 |
| Japan | `Japan` | mercator | 34/34 | all | 1 |
| Germany | `Germany` | mercator | 6/6 | all | 1 |
| United Kingdom | `UnitedKingdom` | mercator | 23/23 | all (Great Britain, Northern Ireland, Hebrides, Orkney, Shetland) | 1 |
| France | `France` | mercator | 3/10 | metropolitan France + Corsica; overseas departments out of frame | 1 |
| Brazil | `Brazil` | mercator | 17/17 | all | 1 |
| Canada | `Canada` | conicEqualArea | 141/141 | all (incl. the Arctic Archipelago) | 1 |
| Indonesia | `Indonesia` | mercator | 133/133 | all (full archipelago) | 1 |
| Mexico | `Mexico` | mercator | 16/16 | all | 1 |
| Turkey | `Turkey` | mercator | 3/3 | all (Anatolia + East Thrace) | 1 |
| Saudi Arabia | `SaudiArabia` | mercator | 4/4 | all | 1 |
| South Korea | `SouthKorea` | mercator | 11/11 | all (incl. Jeju) | 1 |
| Australia | `Australia` | mercator | 41/42 | mainland + Tasmania; Macquarie Island out of frame | 1 |
| Italy | `Italy` | mercator | 8/8 | all (incl. Sicily, Sardinia, Pantelleria, Lampedusa) | 1 |
| Spain | `Spain` | mercator | 5/12 | peninsula + Balearics + Ceuta/Melilla; Canary Islands out of frame | 1 |
| South Africa | `SouthAfrica` | mercator | 1/2 | mainland; Prince Edward Islands out of frame | 1 |
| Poland | `Poland` | mercator | 1/1 | all | 1 |
| United Arab Emirates | `UnitedArabEmirates` | mercator | 5/5 | all (incl. Gulf islands) | 1 |
| Egypt | `Egypt` | mercator | 1/1 | all | 1 |
| Argentina | `Argentina` | mercator | 4/4 | all (incl. Tierra del Fuego and Isla de los Estados) | 1 |
**`scaleOverride` is 1 for all 23** — every country auto-fits cleanly from its
projected bounding box, and none needed a nudge. It is there in the data row for
awkward shapes added later; see *Adding a country*.

Three countries needed a projection other than Mercator:

- **United States** — `geoAlbersUsa`, the standard composite. All 50 states are
  in frame, with Alaska and Hawaii as the conventional insets. Nothing is
  redrawn; the composite only places them.
- **Russia** and **Canada** — `geoConicEqualArea`. Mercator makes a country
  reaching past 80°N unrecognisable. Russia's geometry crosses the antimeridian
  (Chukotka, Wrangel Island); d3-geo clips on the sphere after the projection is
  rotated to the country's centroid, so it joins up correctly.

Everything else is `geoMercator`, rotated to the country's own spherical
centroid longitude.

### Framing

Auto-fit from the projected bounding box (`src/geo.ts`):

- the country's **longest dimension targets 62% of frame width**;
- clamped so the shape never exceeds 86% of frame width or 80% of frame height,
  which leaves a margin all round for the glitch field to read;
- `scaleOverride` multiplies the result, then a hard clamp (92% / 86%) keeps an
  override from pushing the shape off-frame;
- the bounding box centre lands at frame centre.

For a country whose shape is close to square, the height clamp binds before the
62% target — 62% of 3840 is wider than the frame is tall, so it has to. Wide
countries (Indonesia, Russia, Egypt) hit the 62% target exactly.

---

## Completion checklist

All 46 compositions opened and visually confirmed — outline traces cleanly, fill
resolves — at frames 45, 130, 200 and 340. Reproduce with:

```bash
npm run verify              # renders 4 frames from each of the 46
```

| Country | `green` | `blue` |
|---|---|---|
| United States | [x] | [x] |
| China | [x] | [x] |
| India | [x] | [x] |
| Russia | [x] | [x] |
| Japan | [x] | [x] |
| Germany | [x] | [x] |
| United Kingdom | [x] | [x] |
| France | [x] | [x] |
| Brazil | [x] | [x] |
| Canada | [x] | [x] |
| Indonesia | [x] | [x] |
| Mexico | [x] | [x] |
| Turkey | [x] | [x] |
| Saudi Arabia | [x] | [x] |
| South Korea | [x] | [x] |
| Australia | [x] | [x] |
| Italy | [x] | [x] |
| Spain | [x] | [x] |
| South Africa | [x] | [x] |
| Poland | [x] | [x] |
| United Arab Emirates | [x] | [x] |
| Egypt | [x] | [x] |
| Argentina | [x] | [x] |
**Rendered previews (1080p mp4 + still, both colourways):** Poland and Indonesia — chosen to
test the build rather than to flatter it. Poland is a single compact polygon;
Indonesia is 133 parts, which stresses both the outline trace and the fill. The
other 21 countries (42 compositions) ship configured and verified but
unrendered.

---

## Adding a country

It is a data row. There is no code to change.

1. Add an entry to `ROWS` in `scripts/bake-countries.mjs`:

   ```js
   {code: 'NO', name: 'Norway', ne: 'Norway', projection: 'mercator',
    territories: 'mainland + Lofoten; Svalbard and Jan Mayen out of frame',
    keep: {lon: [0, 32], lat: [56, 72]}},
   ```

   - `ne` must match the Natural Earth `name` property exactly. The bake fails
     loudly if it does not.
   - `keep` is optional. Without it, every part of the unit is drawn. With it,
     only parts whose bounding-box centre falls inside the window are drawn —
     parts are kept or dropped whole, never cut.
   - `projection`: `mercator` unless the country reaches past ~70° latitude
     (`conicEqualArea`) or is the US (`albersUsa`).
   - `territories` is the human-readable record of that decision, and is what
     the table above is generated from. Write it even when it is just `all`.

2. If the auto-fit leaves the shape too small or too large, set a
   `scaleOverride` in the same script:

   ```js
   const SCALE_OVERRIDE = {NO: 1.12};
   ```

3. Regenerate and check:

   ```bash
   npm run bake
   npm run lint
   npx remotion studio          # two new compositions appear
   ```

`src/Root.tsx` builds the compositions straight from `COUNTRIES`, so the green
and blue entries appear on their own.

---

## Project layout

```
src/
  countries.ts    GENERATED - the country list and the Natural Earth geometry,
                  in one file. Regenerate with `npm run bake`.
  colourways.ts   The two palettes.
  timing.ts       The build sequence, in frames.
  geo.ts          d3-geo projection, auto-fit, SVG path, exact path length.
  bands.ts        The glitch band model, shared by the field and the map tear.
  hash.ts         Seeded integer hash. No Math.random() anywhere at render time.
  glyphs.ts       5x7 dot-matrix glyphs for the LOADING counter and the
                  scattered digits. No font file to ship.
  GlitchField.tsx The canvas field: bands, noise, digits, blooms. Two instances,
                  one under the map and one over it.
  CountryMap.tsx  Outline trace, scanline fill, consolidation, band tearing.
  LoadingRing.tsx The LOADING ring and counter.
  GlitchMap.tsx   The template: {countryCode, colourway} -> the whole clip.
  Root.tsx        Registers 23 x 2 compositions from the data.
scripts/
  bake-countries.mjs  Natural Earth -> src/countries.ts.
  verify-all.mjs      Renders sample frames from all 46, sharing one browser.
  render-all.mjs      Renders all 46 to mp4, sharing one bundle.
previews/
  A 1080p still from each of the four rendered previews, for reference.
```

### Determinism

Remotion renders frames out of order across threads, so nothing may depend on
state carried between frames. Every glitch decision is a pure function of a
seeded hash of integers — `(slot, epoch)` for bands, `(x, y, frame)` for noise —
and `Math.random()` is never called at render time. Canvas layers draw in
`useLayoutEffect`, so the pixels are in place before the frame is captured.

---

## Licence

Project code: unlicensed/private, as delivered.
Map geometry: Natural Earth, public domain.
