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

Measured on the build machine: 4 vCPUs, **no GPU** (Chromium's ANGLE falls
back to SwiftShader, i.e. WebGL on the CPU), `FlagMap-EuropeanUnion`, PNG
frames, startup time subtracted:

| Resolution | One worker | Full 12 s clip, 4 workers |
|-----------|-----------|---------------------------|
| 720p (`--scale=0.333…`) | **0.69 s / frame** | 4 min 01 s (EU), 4 min 33 s (USA), incl. encoding |
| 1080p (`--scale=0.5`) | 1.44 s / frame | — |
| **4K (estimate)** | **≈ 5.5 s / frame** | ≈ 30–35 min per composition, ≈ 20 h for all 38 |

Time grows linearly with pixel count (720p → 1080p: 2.25× pixels, 2.1×
time), so 4K (9× the pixels of 720p) is extrapolated, not measured — 4K was
not rendered here. SwiftShader already uses every core, so more Remotion
concurrency barely helps on a CPU-only machine. With a real GPU (`--gl=angle`
on a GPU host, or `--gl=angle-egl`/`vulkan`), expect roughly 0.5–1 s per 4K
frame, mostly screenshot and PNG encoding.

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

- Floor: albedo #E6E9EE under a cool studio light, soft-glow grid (major + fine),
  faint mottling and light streaks,
  dotted world map from Natural Earth land, haze and depth of field into the
  distance. Rendered display-referred (not tonemapped) so its colour is exact.
- Shape: extrusion depth 4% of its width; glossy top (clearcoat), matte sides
  in a darker shade of the main colour; PCSS soft shadow.
- Lighting: Poly Haven "Studio Small 03" HDRI (CC0) + a key light from the
  upper left. ACES tonemapping, sRGB.
- Label: Inter Medium, #2A2E35, lying on the floor with a faint contact
  shadow, cap height ≈ 5% of frame height, scaled down to the shape's width for
  long names.
- Camera: 24° vertical field of view (a fairly long lens, as in the reference).
  Starts 42° above the floor, 14° to the left; over 12 s it orbits to 5° right
  (19° in all, ending with the reference's slight clockwise roll), rises to
  58° and pushes in 10%.
- Depth of field: the sharp zone runs from the label to the back of the shape,
  recomputed every frame from the camera position; the far and near floor and
  the frame corners soften.
- Timeline: floor + flare fade in 0–20; shape rises 10–50; label slides in
  30–60; glint sweeps once around frame 150.

Deviations from the brief, on purpose:
- The **camera rises** from 42° to 58° during the drift, and the orbit is 19°
  rather than 15°. The brief says it starts at about 40° from the left; the
  reference's late frames are steeper and seen slightly from the right.
- **EU flag stars:** "cover the bounding box" makes the EU's star ring as tall
  as two thirds of the whole EU, so most stars fall in the sea. Because the EU
  flag is a ring on a plain field, its row uses `zoom: 0.4` with `pad: '#003399'`:
  the flag is drawn at 40% of cover size and the rest of the top face is filled
  with the same Reflex Blue, so all 12 stars land inside the shape. Every other
  flag uses plain cover.
- **Floor dots are slightly darker than the floor**, as the brief asks. The
  reference clip's dots are lighter; to match it instead, set
  `LOOK.dotDarken` to a negative value (e.g. `-0.12`) in `src/scene/layout.ts`.
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

Run before delivery (results in the delivery report):

- **Files:** `ffprobe` on both previews: 1280×720, 30/1, 12.000 s, 360
  frames, h264, yuv420p, video stream only (`Config.setMuted(true)`; Remotion
  otherwise adds a silent AAC track).
- **Determinism:** each preview rendered in full as a PNG sequence (4 workers,
  frames out of order) and frame 200 rendered alone from a cold start:
  byte-identical (md5 equal) for both EU and USA.
- **Every composition renders:** `npm run sheets` renders frame 300 of all 38
  (each in about 4 s at 720p, no errors) into the shapes contact sheet, and
  every flag alone into the flags contact sheet (`out/`).
- **Banding:** a frame decoded from the encoded mp4, read along a vertical line
  through the flare glow and a horizontal line across the floor (5×5 averaged
  to remove grain): values change smoothly. The largest step between
  neighbouring samples is about 2 levels, apart from isolated +3–5 spikes where
  the line crosses a grid line; there are no flat plateaus or steps. What
  prevents banding: ±1/255 TPDF dither after tonemapping and 1.5% (peak to
  peak) grain from an integer hash of pixel and frame, in the final pass;
  half-float render target; PNG (not JPEG) intermediate frames.
- **Motion:** frames 0/30/90/150/240/359 of both previews: floor fades in, the
  shape rises from flat, the label slides in, the camera drifts, the glint
  passes once around frame 150.
- **Clean copy:** `npm install && npx remotion studio` from a fresh copy of the
  project (no `node_modules`) starts the studio.

### Completion checklist

- [x] 38 compositions (13 regions + 25 countries) from data rows, 3840×2160, 30 fps, 360 frames
- [x] 3D extrusion (WebGL2, `@remotion/three`), depth 4% of width, fit to 45% width / 50% height
- [x] Flags: 19 drawn in code + EU in code, 6 public-domain Wikimedia (`FLAG_SOURCES.md`); Saudi Arabia omitted
- [x] Natural Earth 1:50m (1:10m for NLD, CHE, ARE); India and Pakistan worldviews
- [x] Per-shape projection; antimeridian (Russia, Oceania) and polar (Antarctica) handled
- [x] Region fills with faint member borders
- [x] Floor grid + dotted world map, flare, label (Inter Medium), HDRI + key light, PCSS shadow, DOF, ACES
- [x] Dither + grain, no `Math.random()`, no clocks, no temporal effects; byte-identical cold frames
- [x] Licences shipped: Natural Earth (PD), Inter (OFL), HDRI (CC0), flags (PD)
- [x] 720p previews of EU and USA; contact sheets of flags and shapes

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
