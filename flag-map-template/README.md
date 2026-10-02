# 3D Flag Map — template (13 regions + 25 countries)

A 3D map tile of a country or region, extruded like a thick tile and topped
with its flag (or a colour fill for regions), stands on a light grid floor with
a faint dotted world map. Its name lies on the floor in front of it, a soft
flare glows at the top and the camera drifts slowly around it.

Remotion 4 + `@remotion/three` (react-three-fiber, three.js r180), WebGL2.
**38 compositions, 3840×2160, 30 fps, 360 frames (12 s).** One data row per
composition.

```
npm install
npx remotion studio          # preview any composition
```

## Compositions

Remotion composition IDs may only contain letters, digits and `-`, so the IDs
are `FlagMap-<id>` (e.g. `FlagMap-EuropeanUnion`); the render commands below
write the files as `FlagMap_<id>.mp4`.

Regions: `EuropeanUnion Africa Asia Europe NorthAmerica SouthAmerica Oceania
Antarctica MiddleEast SoutheastAsia SouthAsia LatinAmerica Nordics`

Countries: `USA China Japan Germany UK India France Italy Canada Brazil Russia
SouthKorea Australia Spain Mexico Indonesia Netherlands UAE Turkiye Switzerland
Argentina SouthAfrica Nigeria Egypt Pakistan`

## Render

`remotion.config.ts` already sets: ANGLE GL, PNG intermediate frames, H.264,
CRF 16, `yuv420p`, concurrency 4.

**4K, one composition**

```
npx remotion render FlagMap-EuropeanUnion out/FlagMap_EuropeanUnion.mp4 --gl=angle --crf=16 --pixel-format=yuv420p
```

**4K, all 38** (bash)

```
for id in EuropeanUnion Africa Asia Europe NorthAmerica SouthAmerica Oceania Antarctica MiddleEast SoutheastAsia SouthAsia LatinAmerica Nordics USA China Japan Germany UK India France Italy Canada Brazil Russia SouthKorea Australia Spain Mexico Indonesia Netherlands UAE Turkiye Switzerland Argentina SouthAfrica Nigeria Egypt Pakistan; do
  npx remotion render "FlagMap-$id" "out/FlagMap_$id.mp4" --gl=angle --crf=16 --pixel-format=yuv420p || break
done
```

(Faster: `npx remotion bundle --out-dir=build` once, then pass `build` as the
first argument: `npx remotion render build FlagMap-$id ...` so the project is not
re-bundled 38 times.)

**720p preview** (what was rendered here)

```
npx remotion render FlagMap-EuropeanUnion out/FlagMap_EuropeanUnion.mp4 --scale=0.3333333333333333
```

**Still, 6000×3375, frame 300**

```
npx remotion still FlagMap-EuropeanUnion out/FlagMap_EuropeanUnion_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375. The scene renders at the scaled
resolution: the canvas uses `devicePixelRatio`, so this is a true 6K render,
not an upscale.)

**Chromium GL flag.** WebGL2 needs `--gl=angle` in headless Chromium (set in
`remotion.config.ts` via `Config.setChromiumOpenGlRenderer('angle')`; pass it
explicitly when using the Node APIs: `chromiumOptions: {gl: 'angle'}`). On a
machine without a GPU, ANGLE falls back to SwiftShader (software); it works,
just slower. With a GPU, `--gl=angle-egl` or `--gl=vulkan` may be faster; check
that a test still matches before switching.

## Render time

__RENDER_TIME__

## Data and boundaries

- **Natural Earth Admin 0 countries, 1:50m** (public domain) for everything,
  except **1:10m** for Netherlands, Switzerland and UAE (too blocky at 50m).
- **Worldview:** Natural Earth **default** worldview, except **India** (drawn
  from Natural Earth's *India* worldview file) and **Pakistan** (from the
  *Pakistan* worldview file), so each country's map matches its own official
  map. Natural Earth publishes worldview files at 1:10m only, so these two are
  1:10m simplified to the same detail as the rest. Regions that contain India
  or Pakistan (Asia, South Asia) use the default worldview.
- **Main territory only:** contiguous USA (no Alaska/Hawaii), metropolitan
  France incl. Corsica, mainland + Frisian islands for the Netherlands, Spain
  without the Canaries, Japan's main islands (no Ryukyu/Bonin), Australia
  incl. Tasmania, South Africa without the Prince Edward Islands, etc. (each
  row's `within` box).
- **Islands:** polygons smaller than 0.3% of the shape's area are dropped
  (`minIsland`, lowered per row where small islands matter, e.g. EU, Indonesia,
  Oceania, Russia keeps Kaliningrad). `keepAllMembers` keeps the largest piece
  of every member even if tiny (Malta, Cyprus in the EU; Bahrain; Singapore;
  the Maldives).
- **Projection per shape:** conformal conic for mid/high latitudes,
  Mercator near the equator, azimuthal equal-area for continent-sized shapes
  that straddle the equator, and azimuthal equal-area **centred on the South
  Pole** for Antarctica. Shapes across the antimeridian (Russia, Oceania, North
  America's Aleutians) are re-centred before projecting (`centerLon`).
- **Regions** are merged with a TopoJSON topology (shared borders cancel
  exactly); the member borders come from the same topology and are drawn as
  faint lines on the top face.

### Region member lists

| Region | Members |
|--------|---------|
| European Union | AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE (27); plus Natural Earth's separately drawn Northern Cyprus and Åland (de-jure EU territory of Cyprus and Finland). Mainland and nearby islands only: no Canaries, Azores, Madeira, French overseas departments. |
| Africa | every Natural Earth feature with continent = Africa (54, incl. Western Sahara and Somaliland) |
| Asia | every feature with continent = Asia (Natural Earth puts Türkiye, Cyprus and the Caucasus here), **Russia excluded** so the shape stays readable (Natural Earth files Russia under Europe anyway) |
| Europe | every feature with continent = Europe; **Russia clipped at 60° E** (the Urals) so only European Russia is included; Svalbard, Franz Josef Land and Novaya Zemlya left out |
| North America | continent = North America: Canada, USA (incl. Alaska), Mexico, Central America, the Caribbean, Greenland |
| South America | ARG BOL BRA CHL COL ECU GUY PRY PER SUR URY VEN, plus French Guiana |
| Oceania | continent = Oceania: Australia, New Zealand, Papua New Guinea and the Pacific islands large enough to see (Fiji, Solomon Islands, Vanuatu, New Caledonia…) |
| Antarctica | ATA |
| Middle East | Gulf states SAU KWT BHR QAT ARE OMN, plus YEM IRQ IRN SYR LBN JOR ISR PSE TUR EGY |
| Southeast Asia | BRN KHM IDN LAO MYS MMR PHL SGP THA TLS VNM (11) |
| South Asia | IND PAK BGD LKA NPL BTN MDV AFG, plus the Siachen Glacier area Natural Earth draws separately |
| Latin America | MEX; Central America GTM BLZ SLV HND NIC CRI PAN; Spanish/Portuguese-speaking Caribbean CUB DOM PRI; South America as above. Haiti (French-speaking) is not included, per the definition used. |
| Nordic Countries | DNK FIN ISL NOR SWE (Åland included with Finland; Greenland and the Faroes are not) |

## Flags

See `FLAG_SOURCES.md`: 19 country flags + the EU flag are drawn in code from their
construction sheets; Mexico, Egypt, Spain, Brazil, Argentina and Canada use
public-domain Wikimedia Commons SVGs. **Saudi Arabia is left out on purpose**
(its flag's Shahada must not be cropped or distorted).

Mapping: planar UVs from the top view; the flag is scaled to **cover** the
shape's bounding box, and the row's `focus` (the emblem's position in the flag)
is placed on the shape's most interior point (or its bbox centre with
`anchor: 'center'`), clamped so the flag always covers.

## Look (shared by all 38 — `src/scene/layout.ts`, `FlagMapScene.tsx`, `shaders.ts`)

- Floor: albedo #E6E9EE under a cool studio light, grid (major + fine),
  dotted world map from Natural Earth land, haze and depth of field into the
  distance. Rendered display-referred (not tonemapped) so its colour is exact.
- Shape: extrusion depth 4% of its width; glossy top (clearcoat), matte sides
  in a darker shade of the main colour; PCSS soft shadow.
- Lighting: Poly Haven "Studio Small 03" HDRI (CC0) + a key light from the
  upper left. ACES tonemapping, sRGB.
- Label: Inter Medium, #2A2E35, lying on the floor, cap height ≈ 4.6% of frame
  height (≈ 5% with descenders), scaled down to the shape's width for long names.
- Camera: starts 42° above the floor, from the left; over 12 s it orbits 15°
  and rises to 62°, pushing in 10%.
- Timeline: floor + flare fade in 0–20; shape rises 10–50; label slides in
  30–60; glint sweeps once around frame 150.

Deviations from the brief, on purpose:
- The **camera rises** from 42° to 62° during the drift. The brief says it
  starts at about 40°; the reference's late frames are clearly steeper (≈ 60°),
  so the drift ends there.
- **No geometric bevel**: three.js bevels spike at the sharp concave vertices
  real coastlines have (fjords, narrow straits). The bevel's edge catch-light
  is painted into the top texture instead.
- The floor's rendered colour is darker than the #E6E9EE albedo (≈ #BEC5D1 in
  mid-frame), matching the reference's floor brightness.

## Determinism

Every value on screen comes from `useCurrentFrame()`:

- No `Math.random()` at render time (`src/lib/random.ts` has a module-level
  seeded `mulberry32` for anything random); grain and dither are an integer hash
  of pixel position and frame (`shaders.ts`).
- No `useFrame` clock, `Date.now()` or state driving visuals; the R3F render
  callback only reads the current frame number and applies it.
- No TAA, temporal AO or `AccumulativeShadows`. PCSS is patched into three's
  shader chunk at module load (not in an effect), so the first frame a worker
  renders is identical to the same frame inside a sequence.
- Geometry, textures and the shape are built once per composition.
- Map data, flags, font and HDRI load behind `delayRender`/`continueRender`.

## Checks

__CHECKS__

## How to add a country or region

**Country** — one row in `src/data/rows.ts`, plus its flag:

```ts
c('Chile', 'Chile', 'CHL', 'Chile', {x: 0.17, y: 0.25}),
```

and in `src/flags/flags.ts` add `Chile: {w: 3, h: 2, main: '#0039A6', source:
'code', svg: ...}` (draw it from its construction sheet, or put a public-domain
SVG in `public/flags/` and use `file:` instead of `svg:` — then list it in
`FLAG_SOURCES.md`).

`focus` is the point of the flag (0..1 from its top-left) that must stay
visible — the star, disc, emblem. Optional: `within` (lon/lat box for the main
territory), `minIsland`, `scale: '10m'` (very small countries; add the feature
to `scripts/extract-ne.mjs`), `worldview`, `centerLon` (shapes across the
antimeridian), `anchor: 'center'`.

**Region** — one row:

```ts
{id: 'CentralAsia', label: 'Central Asia', kind: 'region',
 members: ['KAZ', 'KGZ', 'TJK', 'TKM', 'UZB'], top: {fill: '#3A9AB8'}},
```

or `continent: 'Africa'` instead of `members`. The composition
`FlagMap-<id>` appears automatically.

## Project layout

```
src/data/rows.ts          the 38 rows (the template data)
src/flags/flags.ts        flags drawn in code + Wikimedia file references
src/geo/buildShape.ts     select → clip → antimeridian → project → merge → simplify
src/scene/                layout/timeline, textures, shaders, R3F scene, asset loading
src/sheets/               contact-sheet compositions (verification)
public/data/              Natural Earth extracts (+ SOURCES.md, licence)
public/flags/             public-domain Wikimedia flag SVGs
public/fonts/             Inter Medium (OFL)
public/hdri/              Poly Haven studio HDRI (CC0)
scripts/extract-ne.mjs    rebuilds public/data from raw Natural Earth downloads
scripts/contact-sheets.mjs renders the two verification sheets to out/
```
