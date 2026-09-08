# Country Map — Remotion template

A parameterised news-desk country map. One component set, 33 countries
configured, three style versions, all defined at **3840×2160, 30 fps, 360 frames
(12 s)** and ready to render at 4K.

Adding a country is a data edit: append an object to `src/countries.ts`, run
`npm run build:assets`, and its compositions appear. There is no per-country
code anywhere in the project.

---

## Quick start

```bash
npm install
npx remotion studio
```

The studio opens with every registered composition. Nothing is fetched at render
time — the projected vectors, the label positions and the pre-warped rasters are
all baked into `src/data/` and `public/`.

If the machine already has a Chromium you would rather use than the headless
shell Remotion downloads:

```bash
export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome
```

---

## Rendering at 4K

Every composition is 3840×2160. The render command is the same shape for all of
them:

```bash
npx remotion render <composition-id> out/<name>.mp4 --scale=1 --crf=16
```

Worked examples, one per style:

```bash
npx remotion render V1-BrazilMapLight            out/V1_BrazilMapLight.mp4            --scale=1 --crf=16
npx remotion render V2-BrazilMapDark             out/V2_BrazilMapDark.mp4             --scale=1 --crf=16
npx remotion render V3-BrazilSatelliteZoomWhite  out/V3_BrazilSatelliteZoomWhite.mp4  --scale=1 --crf=16
npx remotion render V3-BrazilSatelliteZoomFlag   out/V3_BrazilSatelliteZoomFlag.mp4   --scale=1 --crf=16
```

A 1080p preview is the same command with `--scale=0.5`. A still is
`npx remotion still <composition-id> out/<name>.png --frame=340 --scale=0.5`.

> Composition ids use a hyphen (`V1-BrazilMapLight`) because Remotion does not
> allow underscores in ids. The delivered filenames keep the underscore
> (`V1_BrazilMapLight.mp4`), as above.

Render the whole batch with the ids from the table below; they are also listed
by `npx remotion compositions`.

### Measured 4K render cost

Measured on this build, not extrapolated: a real 30-frame 3840×2160 segment
(frames 140–169) rendered on **4 vCPU, no GPU, concurrency 2**.

| Composition type | Seconds per frame at 4K | A 360-frame clip |
|---|---|---|
| V1 / V2 (`V1-BrazilMapLight`) | **0.59 s** | ≈ 3.5 min |
| V3 (`V3-BrazilSatelliteZoomWhite`) | **0.35 s** | ≈ 2.1 min |

V1/V2 cost more per frame than V3: they carry the full 1:50m coastline, border
and lake geometry as live SVG plus a drop-shadow filter, where V3 is two images
and one path.

**Scheduling the rest of the batch.** The 30 unrendered countries come to
60 V1/V2 renders and 51 V3 renders — **111 clips**, or
about **5 hours** of wall clock on a machine like this one, single-process.
It scales close to linearly with cores: on a 16-core box at concurrency 8 expect
roughly 1–2 hours, and the batch parallelises perfectly across
machines because every composition is independent.

Per-composition 1080p preview times (`--scale=0.5`) are in `out/render-report.json`;
they ran 51–156 s each on the same machine.

---

## The three styles

| | Base | Water | Subject | Extras |
|---|---|---|---|---|
| **V1 — Light relief** | pale grey terrain `#e8e8e6` → `#c8c8c6` | `#4a6a80` | `#d93a2b` with `#a82a1e` edge | city markers, neighbour and sea labels, location ping, 1% grain |
| **V2 — Dark mode** | near-black `#14171a` → `#242a30` | `#0a1420` | same red | as V1, plus a slight vignette and 2% grain |
| **V3 — Satellite zoom** | true-colour equirectangular base, oceans held to dark navy | — | thin white outline + `white` or `flag` fill | country name only; no markers, no ping, no shadows |

V1 and V2 open on the base map already pushing in, wipe the country fill on from
its interior (frames 15–45), ping the capital once (30–70), bring the city
markers in one at a time (50–140) and settle the country name into place
(90–130), over a continuous 1.00 → 1.18 push that eases to a standstill by frame
300.

V3 is one continuous move: a whole-world view that zooms to the country, with
the outline drawing on partway down, the fill easing in behind it and the label
last.

**Type.** Everything is set in Inter at normal tracking and sized as a fraction
of frame width, in `src/layout.ts`. The country name is 4.4% of frame width
(169 px at 4K, 85 px at 1080p); city labels are 1.08% (41 px / 21 px), which is
the floor for comfortable reading at 1080p — where labels get tight the number
of cities comes down, never the type size. Neighbour and sea labels are set a
little darker (V1) and a little lighter (V2) than the brief's original swatches:
at these sizes `#8a8a88` on `#e8e8e6` and `#33465a` on `#0a1420` were too low in
contrast to read reliably after compression. Everything else in the palette is
as specified.

### V3 fill modes

Both are built for every V3-eligible country and are separate renders:

- **`white`** — translucent white at 35%. Neutral, works everywhere.
- **`flag`** — the country's flag at 85%, clipped to the silhouette so the
  terrain still reads through it. The flag is scaled to *cover* the silhouette at
  its own published ratio and cropped by it, exactly like `object-fit: cover`;
  it is never stretched to the bounding box. Ratios are per country — Switzerland
  is 1:1, the United States 19:10, Brazil 10:7, Norway 11:8 — and each file's own
  `viewBox` is what carries that.

---

## Data sources

All public domain. Nothing is fetched while rendering; everything is baked in.

| What | Source | Terms |
|---|---|---|
| Country polygons, coastlines, boundaries, lakes, land, sea and gulf names | **Natural Earth** 1:50m — `naturalearthdata.com`, via the `nvkelso/natural-earth-vector` mirror | Public domain, no attribution required |
| City points and names | **Natural Earth** 1:10m populated places | Public domain |
| Shaded relief base | **Natural Earth** `GRAY_HR_SR_W` 1:10m raster (21600×10800), from the official `naturalearth.s3.amazonaws.com` mirror | Public domain |
| Satellite base for V3 | **NASA Blue Marble Next Generation** (preferred) — see the note below | Public domain |
| Flags | **`hampusborgos/country-flags`**, sourced from Wikimedia Commons | Flags are not subject to copyright; the set is published as public domain |

Boundaries are Natural Earth's default published view, used **unmodified**. No
boundary is redrawn, added or removed, and no disputed area is reassigned. That
is a deliberate position: using a well-known neutral dataset as published is the
defensible one. Several countries in this batch have contested land borders;
shipping Natural Earth's default is how that is handled, rather than by
substituting a different boundary set.

### ⚠️ Satellite base — read this before the 4K batch

The brief specifies **NASA Blue Marble Next Generation** (~500 m/px). The
machine this batch was built on could not reach `eoimages.gsfc.nasa.gov` —
NASA's hosts are blocked by the network's egress policy — so the shipped
satellite assets were built from the fallback source instead:

**Natural Earth II with shaded relief and water** (`NE2_HR_LC_SR_W`,
21600×10800, ~1 855 m/px at the equator), from the official Natural Earth
mirror. Public domain, same pixel grid, same equirectangular projection,
natural-colour land.

This is a real substitution and it costs resolution: NE2 is about 4× coarser on
the ground than full Blue Marble. The measured consequence is in the
**Satellite upscale** column below — every country is at or under ~3× upscale in
its closing frame, and most are under 2×.

**To switch to genuine Blue Marble** on a machine that can reach NASA:

```bash
SATELLITE=bluemarble node scripts/fetch-data.mjs   # downloads world.topo.bathy.200412.3x21600x10800.jpg
npm run build:assets                               # rebuilds every satellite layer
```

`scripts/fetch-data.mjs` already carries the exact NASA URL, prefers it, and only
falls back when it is unreachable. Nothing else changes — the compositions read
whatever the builder baked. Higher-resolution Blue Marble tiles (the
86400×43200 set) can be dropped in the same way if you assemble them first.

---

## The 33 countries

### Per-country decisions

| Country | Tier | V1/V2 | V3 `white` | V3 `flag` | Zoom | Closing frame | Satellite upscale | Notes |
|---|---|---|---|---|---|---|---|---|
| **United States** (`USA`) | A | ✅ | ✅ | ✅ | 3.9× | 8,729 km | 0.82× | Fit is the contiguous 48; Alaska and Hawai‘i excluded by the 4° gap rule. |
| **China** (`CHN`) | A | ✅ | ✅ | ✅ | 2.8× | 11,889 km | 0.60× |  |
| **India** (`IND`) | A | ✅ | ✅ | ✅ | 3.1× | 10,809 km | 0.66× | Andaman and Nicobar Islands drawn but excluded from the fit. |
| **Russia** (`RUS`) | A | ✅ | ✅ | ✅ | 2.8× | 12,228 km | 0.58× | Antimeridian crosser. Chukotka wraps past 180°. |
| **Japan** (`JPN`) | A | ✅ | ✅ | ✅ | 4.4× | 7,567 km | 0.94× | Fit is the four main islands; the Ryukyu chain is drawn but excluded. |
| **Germany** (`DEU`) | A | ✅ | ✅ | ✅ | 9.1× | 3,695 km | 1.93× |  |
| **United Kingdom** (`GBR`) | A | ✅ | ✅ | ✅ | 7.1× | 4,707 km | 1.51× | Great Britain and Northern Ireland; overseas territories excluded from the fit. |
| **France** (`FRA`) | A | ✅ | ✅ | ✅ | 8.0× | 4,229 km | 1.68× | Metropolitan France + Corsica; overseas departments excluded from the fit. |
| **Brazil** (`BRA`) | A | ✅ | ✅ | ✅ | 2.6× | 13,121 km | 0.54× |  |
| **Canada** (`CAN`) | A | ✅ | ✅ | ✅ | 2.7× | 12,302 km | 0.58× |  |
| **Indonesia** (`IDN`) | B | ✅ | ✅ | ✅ | 4.4× | 7,635 km | 0.93× |  |
| **Mexico** (`MEX`) | B | ✅ | ✅ | ✅ | 4.9× | 6,832 km | 1.04× |  |
| **Turkey** (`TUR`) | B | ✅ | ✅ | ✅ | 9.2× | 3,646 km | 1.95× |  |
| **Saudi Arabia** (`SAU`) | B | ✅ | ✅ | — skipped | 5.7× | 5,923 km | 1.20× | Flag fill skipped: The flag bears the shahada. Cropping it, draping it over a shape or clipping it to a silhouette is considered disrespectful and is restricted in some jurisdictions. |
| **South Korea** (`KOR`) | B | ✅ | ✅ | ✅ | 12.1× | 2,790 km | 2.55× |  |
| **Australia** (`AUS`) | B | ✅ | ✅ | ✅ | 3.0× | 11,293 km | 0.63× |  |
| **Italy** (`ITA`) | B | ✅ | ✅ | ✅ | 8.2× | 4,114 km | 1.73× |  |
| **Spain** (`ESP`) | B | ✅ | ✅ | ✅ | 9.1× | 3,676 km | 1.94× | Canary Islands excluded from the fit by the 6° gap rule. |
| **South Africa** (`ZAF`) | B | ✅ | ✅ | ✅ | 6.7× | 5,003 km | 1.42× |  |
| **Poland** (`POL`) | B | ✅ | ✅ | ✅ | 11.7× | 2,878 km | 2.48× |  |
| **Netherlands** (`NLD`) | B | ✅ | — skipped | — | — | — | — | V3 skipped — too small for the deep zoom. Caribbean municipalities excluded from the fit by the 4° gap rule. |
| **United Arab Emirates** (`ARE`) | C | ✅ | — skipped | — | — | — | — | V3 skipped — too small for the deep zoom. |
| **Singapore** (`SGP`) | C | ✅ | — skipped | — | — | — | — | V3 skipped — far too small for the deep zoom. V1/V2 framed on the Strait. |
| **Vietnam** (`VNM`) | C | ✅ | ✅ | ✅ | 7.7× | 4,382 km | 1.63× |  |
| **Nigeria** (`NGA`) | C | ✅ | ✅ | ✅ | 7.7× | 4,368 km | 1.63× |  |
| **Egypt** (`EGY`) | C | ✅ | ✅ | ✅ | 8.4× | 4,015 km | 1.77× |  |
| **Argentina** (`ARG`) | C | ✅ | ✅ | ✅ | 3.0× | 11,180 km | 0.64× | Flag ratio differs slightly from the official spec — see Flags. |
| **Sweden** (`SWE`) | C | ✅ | ✅ | ✅ | 7.3× | 4,606 km | 1.55× |  |
| **Thailand** (`THA`) | C | ✅ | ✅ | ✅ | 6.4× | 5,268 km | 1.35× |  |
| **Philippines** (`PHL`) | C | ✅ | ✅ | ✅ | 5.7× | 5,934 km | 1.20× |  |
| **Switzerland** (`CHE`) | C | ✅ | — skipped | — | — | — | — | V3 skipped — too small for the deep zoom. Flag is 1:1, not 3:2. |
| **Norway** (`NOR`) | C | ✅ | ✅ | ✅ | 8.6× | 3,715 km | 1.92× | Svalbard, Bjørnøya and Jan Mayen excluded from the fit by the 2.5° gap rule. |
| **Chile** (`CHL`) | C | ✅ | ✅ | ✅ | 3.5× | 9,496 km | 0.75× | Fits by height. Easter Island and Juan Fernández excluded by the 4° gap rule. |

### Composition ids

| Country | V1 | V2 | V3 white | V3 flag |
|---|---|---|---|---|
| United States | `V1-UnitedStatesMapLight` | `V2-UnitedStatesMapDark` | `V3-UnitedStatesSatelliteZoomWhite` | `V3-UnitedStatesSatelliteZoomFlag` |
| China | `V1-ChinaMapLight` | `V2-ChinaMapDark` | `V3-ChinaSatelliteZoomWhite` | `V3-ChinaSatelliteZoomFlag` |
| India | `V1-IndiaMapLight` | `V2-IndiaMapDark` | `V3-IndiaSatelliteZoomWhite` | `V3-IndiaSatelliteZoomFlag` |
| Russia | `V1-RussiaMapLight` | `V2-RussiaMapDark` | `V3-RussiaSatelliteZoomWhite` | `V3-RussiaSatelliteZoomFlag` |
| Japan | `V1-JapanMapLight` | `V2-JapanMapDark` | `V3-JapanSatelliteZoomWhite` | `V3-JapanSatelliteZoomFlag` |
| Germany | `V1-GermanyMapLight` | `V2-GermanyMapDark` | `V3-GermanySatelliteZoomWhite` | `V3-GermanySatelliteZoomFlag` |
| United Kingdom | `V1-UnitedKingdomMapLight` | `V2-UnitedKingdomMapDark` | `V3-UnitedKingdomSatelliteZoomWhite` | `V3-UnitedKingdomSatelliteZoomFlag` |
| France | `V1-FranceMapLight` | `V2-FranceMapDark` | `V3-FranceSatelliteZoomWhite` | `V3-FranceSatelliteZoomFlag` |
| Brazil | `V1-BrazilMapLight` | `V2-BrazilMapDark` | `V3-BrazilSatelliteZoomWhite` | `V3-BrazilSatelliteZoomFlag` |
| Canada | `V1-CanadaMapLight` | `V2-CanadaMapDark` | `V3-CanadaSatelliteZoomWhite` | `V3-CanadaSatelliteZoomFlag` |
| Indonesia | `V1-IndonesiaMapLight` | `V2-IndonesiaMapDark` | `V3-IndonesiaSatelliteZoomWhite` | `V3-IndonesiaSatelliteZoomFlag` |
| Mexico | `V1-MexicoMapLight` | `V2-MexicoMapDark` | `V3-MexicoSatelliteZoomWhite` | `V3-MexicoSatelliteZoomFlag` |
| Turkey | `V1-TurkeyMapLight` | `V2-TurkeyMapDark` | `V3-TurkeySatelliteZoomWhite` | `V3-TurkeySatelliteZoomFlag` |
| Saudi Arabia | `V1-SaudiArabiaMapLight` | `V2-SaudiArabiaMapDark` | `V3-SaudiArabiaSatelliteZoomWhite` | — |
| South Korea | `V1-SouthKoreaMapLight` | `V2-SouthKoreaMapDark` | `V3-SouthKoreaSatelliteZoomWhite` | `V3-SouthKoreaSatelliteZoomFlag` |
| Australia | `V1-AustraliaMapLight` | `V2-AustraliaMapDark` | `V3-AustraliaSatelliteZoomWhite` | `V3-AustraliaSatelliteZoomFlag` |
| Italy | `V1-ItalyMapLight` | `V2-ItalyMapDark` | `V3-ItalySatelliteZoomWhite` | `V3-ItalySatelliteZoomFlag` |
| Spain | `V1-SpainMapLight` | `V2-SpainMapDark` | `V3-SpainSatelliteZoomWhite` | `V3-SpainSatelliteZoomFlag` |
| South Africa | `V1-SouthAfricaMapLight` | `V2-SouthAfricaMapDark` | `V3-SouthAfricaSatelliteZoomWhite` | `V3-SouthAfricaSatelliteZoomFlag` |
| Poland | `V1-PolandMapLight` | `V2-PolandMapDark` | `V3-PolandSatelliteZoomWhite` | `V3-PolandSatelliteZoomFlag` |
| Netherlands | `V1-NetherlandsMapLight` | `V2-NetherlandsMapDark` | — | — |
| United Arab Emirates | `V1-UnitedArabEmiratesMapLight` | `V2-UnitedArabEmiratesMapDark` | — | — |
| Singapore | `V1-SingaporeMapLight` | `V2-SingaporeMapDark` | — | — |
| Vietnam | `V1-VietnamMapLight` | `V2-VietnamMapDark` | `V3-VietnamSatelliteZoomWhite` | `V3-VietnamSatelliteZoomFlag` |
| Nigeria | `V1-NigeriaMapLight` | `V2-NigeriaMapDark` | `V3-NigeriaSatelliteZoomWhite` | `V3-NigeriaSatelliteZoomFlag` |
| Egypt | `V1-EgyptMapLight` | `V2-EgyptMapDark` | `V3-EgyptSatelliteZoomWhite` | `V3-EgyptSatelliteZoomFlag` |
| Argentina | `V1-ArgentinaMapLight` | `V2-ArgentinaMapDark` | `V3-ArgentinaSatelliteZoomWhite` | `V3-ArgentinaSatelliteZoomFlag` |
| Sweden | `V1-SwedenMapLight` | `V2-SwedenMapDark` | `V3-SwedenSatelliteZoomWhite` | `V3-SwedenSatelliteZoomFlag` |
| Thailand | `V1-ThailandMapLight` | `V2-ThailandMapDark` | `V3-ThailandSatelliteZoomWhite` | `V3-ThailandSatelliteZoomFlag` |
| Philippines | `V1-PhilippinesMapLight` | `V2-PhilippinesMapDark` | `V3-PhilippinesSatelliteZoomWhite` | `V3-PhilippinesSatelliteZoomFlag` |
| Switzerland | `V1-SwitzerlandMapLight` | `V2-SwitzerlandMapDark` | — | — |
| Norway | `V1-NorwayMapLight` | `V2-NorwayMapDark` | `V3-NorwaySatelliteZoomWhite` | `V3-NorwaySatelliteZoomFlag` |
| Chile | `V1-ChileMapLight` | `V2-ChileMapDark` | `V3-ChileSatelliteZoomWhite` | `V3-ChileSatelliteZoomFlag` |

### Relief resolution

| Country | Warped relief | Upscale from the 1:10m grid | Cities |
|---|---|---|---|
| United States | 4800x2700 | 1.00× | 14 |
| China | 4800x2700 | 1.00× | 14 |
| India | 4800x2700 | 1.00× | 14 |
| Russia | 4800x2700 | 1.00× | 14 |
| Japan | 4800x2700 | 1.09× | 10 |
| Germany | 3556x2000 | 1.62× | 14 |
| United Kingdom | 4128x2322 | 1.40× | 14 |
| France | 3934x2214 | 1.46× | 14 |
| Brazil | 4800x2700 | 1.00× | 14 |
| Canada | 4800x2700 | 1.00× | 14 |
| Indonesia | 4800x2700 | 1.00× | 14 |
| Mexico | 4800x2700 | 1.00× | 14 |
| Turkey | 3736x2100 | 1.54× | 14 |
| Saudi Arabia | 4800x2700 | 1.16× | 12 |
| South Korea | 2136x1202 | 2.70× | 9 |
| Australia | 4800x2700 | 1.00× | 14 |
| Italy | 2936x1652 | 1.96× | 14 |
| Spain | 2912x1638 | 1.98× | 14 |
| South Africa | 4112x2314 | 1.40× | 14 |
| Poland | 2672x1502 | 2.16× | 14 |
| Netherlands | 2212x1244 | 2.60× | 7 |
| United Arab Emirates | 2024x1138 | 2.85× | 5 |
| Singapore | 1920x1080 | 24.03× | 1 |
| Vietnam | 3120x1754 | 1.85× | 14 |
| Nigeria | 2780x1564 | 2.07× | 14 |
| Egypt | 3132x1762 | 1.84× | 14 |
| Argentina | 4800x2700 | 1.00× | 14 |
| Sweden | 4800x2700 | 1.00× | 14 |
| Thailand | 3046x1712 | 1.89× | 13 |
| Philippines | 3250x1828 | 1.77× | 12 |
| Switzerland | 1920x1080 | 3.69× | 7 |
| Norway | 4800x2700 | 1.00× | 11 |
| Chile | 4800x2700 | 1.00× | 10 |

Totals: 33 countries, 123 compositions (66 V1/V2, 29 V3 white, 28 V3 flag).

---

## Adding a country

Three steps, one of which is optional.

**1. Append an entry to `src/countries.ts`.**

```ts
{
  code: 'PRT',                      // Natural Earth ADM0_A3 — this is the composition id stem
  displayName: 'Portugal',          // the on-screen title; defaults to the Natural Earth name
  cities: ['Lisbon', 'Porto', ...], // Natural Earth place names; omit and the builder picks
  framing: {gapDeg: 5},             // optional; see the overrides below
  v3: {context: 3.0, flagFill: true},
  tier: 'C',
},
```

Only `code`, `v3` and `tier` are required. `v3: false` marks the country
V3-ineligible and no satellite compositions are registered for it.

**2. Add its flag** — put the file at `.cache/flags/<iso2>.svg` (or add the
two-letter code to `FLAG_CODES` in `scripts/fetch-data.mjs` and re-run it), and
add the country's ISO A3 → A2 pair to the `ISO2` map in
`scripts/build-assets.ts` if Natural Earth records `-99` for it. Add its official
ratio to `OFFICIAL_RATIOS` in `scripts/lib/flags.ts` so the build verifies the
file against the specification. Skip this step entirely if `flagFill: false`.

**3. Build.**

```bash
npm run build:assets -- PRT     # one country
npm run build:assets            # all of them
npm run check:framing -- PRT    # contact sheets in out/checks/
npm run check:push              # numeric check: does anything clip at the closing push?
```

The builder writes `src/data/regions/PRT.json`, the pre-warped relief and
satellite rasters into `public/`, and regenerates `src/data/index.ts`. The new
compositions appear in the studio on the next reload. **Look at the framing
before adding it to a batch** — `npm run check:framing` renders the opening and
closing frame of every composition into captioned contact sheets, which is what
this project uses instead of trusting the auto-fit.

Optionally run `npx tsx scripts/sync-cities.ts` to write the resolved city list
back into `src/countries.ts`, so the data file records the cities that actually
got drawn.

### Framing overrides

Everything in `framing` is optional; the auto-fit handles most countries alone.

| Field | What it does |
|---|---|
| `maxWidthFrac`, `maxHeightFrac` | Fraction of the frame the country's bounding box may fill. The tighter one binds, so an elongated country fits on its long axis. Defaults 0.44 / 0.56. |
| `zoom` | Multiplies the fitted scale. |
| `offset: [dx, dy]` | Shifts the map, as a fraction of frame width/height. |
| `projection` | `'mercator'` or `'conicConformal'`, instead of letting latitude decide. |
| `parallels` | Standard parallels for the conic. |
| `centerLon` | Forces the central meridian. |
| `gapDeg` | Single-linkage clustering gap in degrees. Parts of the country further than this from the cluster are still **drawn** but are excluded from the **fit**. Default 8 (~900 km). |
| `includeAllParts` | Frames every part however distant. |
| `titleOffset: [dx, dy]` | Nudges the country name. |

### How scattered territories are decided

One rule, applied to every country: the parts of a country are clustered by
single linkage on angular gap, and the fit contains the cluster holding the
largest part. Everything else is drawn wherever it falls but never pulls the
frame.

An archipelago chains island to island and stays whole — Indonesia, the
Philippines and Japan's main islands all survive intact. A genuinely distant
holding drops out: French Guiana, Hawai‘i, Alaska, the Canary Islands, Svalbard,
the Caribbean Netherlands. Where the default 8° is wrong for a country, the gap
is tuned in that country's entry rather than special-cased in code.

---

## Project layout

```
src/
  countries.ts          THE data file — the country list, and the only file you edit
  layout.ts             type and marker metrics, shared with the builder
  styles.ts             the three palettes and the relief variants
  geo/projection.ts     framing types + projection construction (shared with the builder)
  components/
    CountryMap.tsx      V1 / V2
    SatelliteZoom.tsx   V3, both fill modes
    Grain.tsx           grain and vignette
  data/
    regions/<CODE>.json baked per country: projected paths, label positions, camera
    index.ts            GENERATED — the static region index
    build-report.json   GENERATED — measurements behind the tables above
  Root.tsx              generates every composition from countries.ts
scripts/
  fetch-data.mjs        downloads the public-domain sources into .cache/
  build-assets.ts       bakes everything the compositions read
  sync-cities.ts        writes resolved city lists back into countries.ts
  check-framing.ts      opening/closing contact sheets for every composition
  check-push.ts         numeric check that no subject clips at the closing push
  render-previews.ts    the 1080p preview set + the measured 4K timing
  report-tables.ts      regenerates the tables in this README
public/
  relief/<CODE>_{v1,v2,shade}.jpg   pre-warped, already in palette
  satellite/world.jpg, <CODE>.jpg   equirectangular world + per-country close-up
  fonts/inter-*.woff2               embedded
  grain.png
```

### How it works

Geometry is projected **once, offline**. `scripts/build-assets.ts` fits a
`geoMercator` or `geoConicConformal` projection per country with d3-geo, then
writes the projected SVG path strings, the resolved label positions and the
camera keyframes into `src/data/regions/<CODE>.json` in composition pixels. The
relief raster is warped into that same pixel grid by inverting the identical
projection, so the raster and the vectors are registered by construction and the
push-in — a single transform on the composed layer — scales them together.

The compositions therefore do no projection, no measurement and no fetching.
They interpolate, which is what keeps 100+ compositions cheap to render.

Label placement is resolved offline too: neighbour and sea names are anchored at
the point of greatest clearance inside whatever part of the shape is actually
visible, and city labels are routed around each other, around the markers and
around the country name across eight candidate positions. Where a label cannot
be placed legibly it is dropped rather than shrunk.

---

## Known limits

- **Relief resolution.** Natural Earth's largest public-domain relief raster is
  1:10m (21600×10800, ~1 855 m/px). For a large country's regional frame that is
  a 1:1 match or better; for a small one it is upscaled — see the relief table.
  Singapore is the extreme case at ~8×. The relief is deliberately low-contrast
  terrain texture rather than a feature, so it holds up further than the raw
  number suggests, but that is the ceiling of the public-domain data and no
  amount of resampling adds detail. The warp applies a light unsharp wherever it
  is upscaling.
- **V3 zoom factors are geometric, not chosen.** The brief's "roughly 30–50×"
  is achievable for a small subject; a country the size of Brazil or Russia
  cannot be reached in 30× from a whole-world view without filling the frame edge
  to edge, which the brief also rules out. The zoom per country is therefore
  derived from its closing frame and reported in the table — 2.6× for Brazil,
  12× for South Korea, 13× for Poland.
- **Argentina's flag** is published in the source set at 8:5 (1.600); the
  official specification is 9:14 (1.556), a 2.9% difference. Every other flag in
  the set matches its official ratio exactly. The difference is invisible under a
  cover-crop, and the file is shipped as published rather than being re-scaled,
  which would distort the artwork.
- **City counts.** The brief's 10–14 is met for 26 of the 33. The rest are
  limited by the data or the geography: Singapore has one populated place in
  Natural Earth, the UAE eight, and the Netherlands, Switzerland and Norway run
  out of room for legible labels before they run out of cities. Labels are
  dropped rather than shrunk, as the brief asks.
- **The satellite base is not Blue Marble** in this build — see the warning
  above.
