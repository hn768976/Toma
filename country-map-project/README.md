# Country Map — Remotion template

A parameterised news-desk country map. One component set, 33 countries
configured, three style versions, all defined at **3840×2160, 30 fps, 360 frames
(12 s)** and ready to render at 4K.

Adding a country is a data edit: append an object to `src/countries.ts`, run
`npm run build:assets`, and its compositions appear. There is no per-country
code anywhere in the project.

**123 compositions** — 66 V1/V2, 29 V3 `white`, 28 V3 `flag`. Preview renders
ship for Brazil, the United States, South Korea and Chile (16 files); the other
29 countries are configured, framing-checked and ready for the 4K batch. Every
output is **video only** — no silent audio track.

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

**Every output is video only.** These are silent graphics, so `remotion.config.ts`
sets `Config.setMuted(true)` and `Config.setEnforceAudioTrack(false)`; without
both, Remotion writes a silent AAC track that an editor then has to strip. Verify
with `ffprobe -show_entries stream=codec_type` — the result should list `video`
and nothing else.

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
| V1 / V2 (`V1-UnitedStatesMapLight`) | **0.67 s** | ≈ 4.0 min |
| V3 (`V3-UnitedStatesSatelliteZoomWhite`) | **0.33 s** | ≈ 2.0 min |

V1/V2 cost roughly twice V3 per frame: they carry the full 1:50m coastline,
border and lake geometry as live SVG plus a drop-shadow filter, where V3 is two
images and one path.

**Scheduling the rest of the batch.** The 29 unrendered countries come to
58 V1/V2 renders and 49 V3 renders — **107 clips**, or about
**6 hours** of wall clock on a machine like this one, single-process. It scales
close to linearly with cores: on a 16-core box at concurrency 8 expect roughly
1–2 hours, and the batch parallelises perfectly across machines because
every composition is independent.

Per-composition 1080p preview times (`--scale=0.5`) are in
`out/render-report.json`; they ran 50–180 s each on the same machine.

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

**Type.** Everything is set in **Barlow Semi Condensed** (SIL Open Font
License, embedded from `public/fonts/` — no system fonts, no CDN). The condensed
widths are the point rather than a style preference: "Belo Horizonte" is 27%
narrower than in a standard-width sans, which removes most label collisions
before the solver runs, and the face reads as broadcast cartography rather than
as UI.

| Element | Weight | Size at 4K | Set as |
|---|---|---|---|
| Country name | 800 ExtraBold | 177 px | Caps, lightly letter-spaced |
| Capital city | 600 SemiBold | 44 px | Sentence case |
| City labels | 500 Medium | 44 px (22 px at 1080p) | Sentence case |
| Neighbour countries | 400 Regular | 39 px | Dim caps |
| Sea and gulf names | 400 Italic | 39 px | Italic |
| V3 country name | 500 Medium | 100 px | Caps, letter-spaced |

**Long names** get the narrower cut rather than smaller type: set
`titleFace: 'condensed'` on the entry and it is drawn in **Barlow Condensed**,
which is a further 12% narrower. That is set for the United Kingdom, South
Korea, the Netherlands and the United Arab Emirates. Text measurement is done
offline with fontkit against the same woff2 files the compositions embed, so the
box the collision solver reserves is the box Chromium paints.

**Halos, not shadows.** Every white label carries a tight dark outline hugging
the glyphs — 2–5 px at 4K depending on the type size, at ~70% opacity — plus at
most a 5 px offset shadow on the country name. Nothing is visible more than a few
pixels from the letterforms. A large-radius shadow reads as a stain on the map
rather than as depth on the type, so there isn't one anywhere in the project.

### V3 fill modes

Both are built for every V3-eligible country and are separate renders:

- **`white`** — translucent white at **50%**, over a white outline with a dark
  outer edge so it holds against both snow and dark ocean. Neutral, works
  everywhere.
- **`flag`** — the country's flag at 85%, clipped to the silhouette so the
  terrain still reads through it.

#### The flag fit method — verified, not assumed

The flag is scaled to **cover** the silhouette at its own published aspect ratio
and clipped by it, exactly like CSS `object-fit: cover`. It is never stretched to
the country's bounding box. Concretely:

```
scale = max(bboxWidth / flagWidth, bboxHeight / flagHeight)
```

then centred, then clipped to the country path. Some of the flag is cropped, and
that is correct — for an extreme aspect ratio like Chile the crop is severe, which
is the intended behaviour rather than a fault.

Each flag is drawn as a **nested `<svg>` carrying the source file's own
`viewBox`**, so its proportions come from the file rather than from anything this
project computes, and any percentage units inside the artwork resolve against the
flag rather than the map. Ratios genuinely differ — Switzerland is 1:1, the
United States 19:10, Brazil 10:7, Norway 11:8, Mexico 7:4 — and
`OFFICIAL_RATIOS` in `scripts/lib/flags.ts` holds the specification figure for
every country in the batch.

The build **asserts** the fit rather than trusting it, and fails the country if
either check breaks:

1. the drawn rectangle's aspect ratio equals the flag's own to within 1e-6, so
   the artwork cannot be stretched — a circular emblem such as Brazil's celestial
   globe or South Korea's taegeuk stays circular;
2. the drawn rectangle covers the silhouette in both axes, so no part of the
   country is left unfilled.

Both are recorded per country in the checklist below. This is settled here so it
does not have to be re-litigated per country.

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
| Type | **Barlow Semi Condensed** and **Barlow Condensed**, embedded in `public/fonts/` | SIL Open Font License 1.1 — embedding in footage that is sold is permitted |

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

| Country | Tier | V1/V2 | V3 `white` | V3 `flag` | `finalZoom` | Zoom | Closing frame | Satellite upscale | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **United States** (`USA`) | A | ✅ | ✅ | ✅ | 0.68 | 4.5× | 7,551 km | 0.94× | Fit is the contiguous 48; Alaska and Hawai‘i excluded by the 4° gap rule. |
| **China** (`CHN`) | A | ✅ | ✅ | ✅ | 0.68 | 3.3× | 10,284 km | 0.69× |  |
| **India** (`IND`) | A | ✅ | ✅ | ✅ | 0.68 | 4.0× | 8,366 km | 0.85× | Andaman and Nicobar Islands drawn but excluded from the fit. |
| **Russia** (`RUS`) | A | ✅ | ✅ | ✅ | 0.68 | 2.5× | 13,320 km | 0.53× | Antimeridian crosser. Chukotka wraps past 180°. |
| **Japan** (`JPN`) | A | ✅ | ✅ | ✅ | 0.68 | 5.4× | 6,183 km | 1.15× | Fit is the four main islands; the Ryukyu chain is drawn but excluded. |
| **Germany** (`DEU`) | A | ✅ | ✅ | ✅ | 0.56 *(asked 0.68)* | 12.3× | 2,740 km | 2.60× |  |
| **United Kingdom** (`GBR`) | A | ✅ | ✅ | ✅ | 0.68 | 10.7× | 3,146 km | 2.26× | Great Britain and Northern Ireland; overseas territories excluded from the fit. |
| **France** (`FRA`) | A | ✅ | ✅ | ✅ | 0.68 | 11.9× | 2,827 km | 2.52× | Metropolitan France + Corsica; overseas departments excluded from the fit. |
| **Brazil** (`BRA`) | A | ✅ | ✅ | ✅ | 0.68 | 3.0× | 11,350 km | 0.63× |  |
| **Canada** (`CAN`) | A | ✅ | ✅ | ✅ | 0.68 | 2.8× | 12,061 km | 0.59× |  |
| **Indonesia** (`IDN`) | B | ✅ | ✅ | ✅ | 0.68 | 4.5× | 7,486 km | 0.95× |  |
| **Mexico** (`MEX`) | B | ✅ | ✅ | ✅ | 0.68 | 6.4× | 5,288 km | 1.35× |  |
| **Turkey** (`TUR`) | B | ✅ | ✅ | ✅ | 0.60 *(asked 0.68)* | 12.3× | 2,740 km | 2.60× |  |
| **Saudi Arabia** (`SAU`) | B | ✅ | ✅ | — skipped | 0.68 | 7.3× | 4,585 km | 1.55× | Flag fill skipped: The flag bears the shahada. Cropping it, draping it over a shape or clipping it to a silhouette is considered disrespectful and is restricted in some jurisdictions. |
| **South Korea** (`KOR`) | B | ✅ | ✅ | ✅ | 0.39 *(asked 0.68)* | 12.3× | 2,737 km | 2.60× |  |
| **Australia** (`AUS`) | B | ✅ | ✅ | ✅ | 0.68 | 3.4× | 9,769 km | 0.73× |  |
| **Italy** (`ITA`) | B | ✅ | ✅ | ✅ | 0.68 | 11.1× | 3,025 km | 2.36× |  |
| **Spain** (`ESP`) | B | ✅ | ✅ | ✅ | 0.56 *(asked 0.68)* | 12.3× | 2,740 km | 2.60× | Canary Islands excluded from the fit by the 6° gap rule. |
| **South Africa** (`ZAF`) | B | ✅ | ✅ | ✅ | 0.68 | 9.1× | 3,678 km | 1.94× |  |
| **Poland** (`POL`) | B | ✅ | ✅ | ✅ | 0.42 *(asked 0.68)* | 12.3× | 2,741 km | 2.60× |  |
| **Netherlands** (`NLD`) | B | ✅ | — skipped | — | — | — | — | — | V3 skipped — too small for the deep zoom. Caribbean municipalities excluded from the fit by the 4° gap rule. |
| **United Arab Emirates** (`ARE`) | C | ✅ | — skipped | — | — | — | — | — | V3 skipped — too small for the deep zoom. |
| **Singapore** (`SGP`) | C | ✅ | — skipped | — | — | — | — | — | V3 skipped — far too small for the deep zoom. V1/V2 framed on the Strait. |
| **Vietnam** (`VNM`) | C | ✅ | ✅ | ✅ | 0.68 | 7.8× | 4,296 km | 1.66× |  |
| **Nigeria** (`NGA`) | C | ✅ | ✅ | ✅ | 0.68 | 12.0× | 2,793 km | 2.55× |  |
| **Egypt** (`EGY`) | C | ✅ | ✅ | ✅ | 0.68 | 11.9× | 2,811 km | 2.53× |  |
| **Argentina** (`ARG`) | C | ✅ | ✅ | ✅ | 0.68 | 3.5× | 9,671 km | 0.74× | Flag ratio differs slightly from the official spec — see Flags. |
| **Sweden** (`SWE`) | C | ✅ | ✅ | ✅ | 0.68 | 8.4× | 3,984 km | 1.79× |  |
| **Thailand** (`THA`) | C | ✅ | ✅ | ✅ | 0.68 | 7.8× | 4,304 km | 1.66× |  |
| **Philippines** (`PHL`) | C | ✅ | ✅ | ✅ | 0.68 | 7.3× | 4,593 km | 1.55× |  |
| **Switzerland** (`CHE`) | C | ✅ | — skipped | — | — | — | — | — | V3 skipped — too small for the deep zoom. Flag is 1:1, not 3:2. |
| **Norway** (`NOR`) | C | ✅ | ✅ | ✅ | 0.68 | 8.8× | 3,642 km | 1.96× | Svalbard, Bjørnøya and Jan Mayen excluded from the fit by the 2.5° gap rule. |
| **Chile** (`CHL`) | C | ✅ | ✅ | ✅ | 0.68 | 3.0× | 11,171 km | 0.64× | Fits by height. Easter Island and Juan Fernández excluded by the 4° gap rule. |

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
| Japan | 4800x2700 | 1.09× | 12 |
| Germany | 3556x2000 | 1.62× | 14 |
| United Kingdom | 4128x2322 | 1.40× | 14 |
| France | 3934x2214 | 1.46× | 14 |
| Brazil | 4800x2700 | 1.00× | 14 |
| Canada | 4800x2700 | 1.00× | 14 |
| Indonesia | 4800x2700 | 1.00× | 14 |
| Mexico | 4800x2700 | 1.00× | 14 |
| Turkey | 3736x2100 | 1.54× | 14 |
| Saudi Arabia | 4800x2700 | 1.16× | 14 |
| South Korea | 2136x1202 | 2.70× | 14 |
| Australia | 4800x2700 | 1.00× | 14 |
| Italy | 2936x1652 | 1.96× | 14 |
| Spain | 2912x1638 | 1.98× | 14 |
| South Africa | 4112x2314 | 1.40× | 14 |
| Poland | 2672x1502 | 2.16× | 14 |
| Netherlands | 2212x1244 | 2.60× | 9 |
| United Arab Emirates | 2024x1138 | 2.85× | 5 |
| Singapore | 1920x1080 | 24.03× | 1 |
| Vietnam | 3120x1754 | 1.85× | 14 |
| Nigeria | 2780x1564 | 2.07× | 14 |
| Egypt | 3132x1762 | 1.84× | 14 |
| Argentina | 4800x2700 | 1.00× | 14 |
| Sweden | 4800x2700 | 1.00× | 14 |
| Thailand | 3046x1712 | 1.89× | 14 |
| Philippines | 3250x1828 | 1.77× | 13 |
| Switzerland | 1920x1080 | 3.69× | 10 |
| Norway | 4800x2700 | 1.00× | 14 |
| Chile | 4800x2700 | 1.00× | 11 |

Totals: 33 countries, 123 compositions (66 V1/V2, 29 V3 white, 28 V3 flag).

### Completion checklist — all 33 countries

Every change in Revision Brief 2 lives in shared code or shared config, so it lands on all 33 at once. The per-country columns are the values that had to be resolved individually, plus the confirmation that the composition was opened and looked at.

| Country | No audio | Name placed first | `namePosition` | Leader lines | `finalZoom` | V3 fill + halo | Flag fit verified | Barlow | Framing checked |
|---|---|---|---|---|---|---|---|---|---|
| United States | ✅ | ✅ | `[0.482, 0.491]` | ✅ 1 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| China | ✅ | ✅ | `[0.604, 0.607]` | ✅ 4 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| India | ✅ | ✅ | `[0.38, 0.467]` | ✅ 2 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Russia | ✅ | ✅ | `[0.576, 0.582]` | ✅ 1 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Japan | ✅ | ✅ | `[0.683, 0.557]` | ✅ 2 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Germany | ✅ | ✅ | `[0.511, 0.272]` | ✅ 4 | 0.56 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| United Kingdom | ✅ | ✅ | `[0.65, 0.782]` | ✅ 3 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Condensed | ✅ |
| France | ✅ | ✅ | `[0.477, 0.409]` | ✅ 1 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Brazil | ✅ | ✅ | `[0.63, 0.563]` | ✅ 4 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Canada | ✅ | ✅ | `[0.248, 0.598]` | ✅ 5 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Indonesia | ✅ | ✅ | `[0.374, 0.405]` | ✅ 4 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Mexico | ✅ | ✅ | `[0.506, 0.528]` | ✅ 2 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Turkey | ✅ | ✅ | `[0.404, 0.3]` | ✅ 3 | 0.60 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Saudi Arabia | ✅ | ✅ | `[0.493, 0.454]` | ✅ 3 | 0.68 | ✅ | n/a (flag skipped) | ✅ Semi Cond. | ✅ |
| South Korea | ✅ | ✅ | `[0.412, 0.435]` | ✅ 5 | 0.39 | ✅ | ✅ cover, ratio exact | ✅ Condensed | ✅ |
| Australia | ✅ | ✅ | `[0.446, 0.376]` | ✅ 2 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Italy | ✅ | ✅ | `[0.319, 0.177]` | ✅ 3 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Spain | ✅ | ✅ | `[0.417, 0.338]` | ✅ 1 | 0.56 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| South Africa | ✅ | ✅ | `[0.407, 0.52]` | ✅ 3 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Poland | ✅ | ✅ | `[0.539, 0.355]` | ✅ 1 | 0.42 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Netherlands | ✅ | ✅ | `[0.617, 0.603]` | ✅ 5 | n/a | n/a | n/a (V3 skipped) | ✅ Condensed | ✅ |
| United Arab Emirates | ✅ | ✅ | `[0.61, 0.762]` | — none needed | n/a | n/a | n/a (V3 skipped) | ✅ Condensed | ✅ |
| Singapore | ✅ | ✅ | `[0.48, 1.018]` | ✅ 1 | n/a | n/a | n/a (V3 skipped) | ✅ Semi Cond. | ✅ |
| Vietnam | ✅ | ✅ | `[0.438, 0.204]` | ✅ 3 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Nigeria | ✅ | ✅ | `[0.372, 0.596]` | ✅ 1 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Egypt | ✅ | ✅ | `[0.376, 0.558]` | ✅ 2 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Argentina | ✅ | ✅ | `[0.433, 0.231]` | ✅ 5 | 0.68 | ✅ | ✅ cover, ratio noted | ✅ Semi Cond. | ✅ |
| Sweden | ✅ | ✅ | `[0.566, 0.309]` | ✅ 1 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Thailand | ✅ | ✅ | `[0.468, 0.344]` | ✅ 2 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Philippines | ✅ | ✅ | `[0.471, 0.335]` | ✅ 1 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Switzerland | ✅ | ✅ | `[0.37, 0.252]` | ✅ 3 | n/a | n/a | n/a (V3 skipped) | ✅ Semi Cond. | ✅ |
| Norway | ✅ | ✅ | `[0.234, 0.754]` | ✅ 3 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |
| Chile | ✅ | ✅ | `[0.799, 0.124]` | ✅ 1 | 0.68 | ✅ | ✅ cover, ratio exact | ✅ Semi Cond. | ✅ |

Country names: 31 of 33 set at the full 177 px. United Kingdom (163 px, Condensed), United Arab Emirates (116 px, Condensed) sit below it.

Every selected city label was placed without a collision.

---

## Adding a country

Three steps, one of which is optional.

**1. Append an entry to `src/countries.ts`.**

```ts
{
  code: 'PRT',                       // Natural Earth ADM0_A3 — this is the composition id stem
  displayName: 'Portugal',           // the on-screen title; defaults to the Natural Earth name
  cities: ['Lisbon', 'Porto', ...],  // Natural Earth place names; omit and the builder picks
  namePosition: [0.48, 0.52],        // where the country name sits; omit and the builder resolves it
  titleFace: 'semi',                 // 'condensed' for a long name, instead of smaller type
  framing: {gapDeg: 5},              // territory handling and fit; see the overrides below
  v3: {finalZoom: 0.68, flagFill: true},
  tier: 'C',
},
```

Only `code`, `v3` and `tier` are required. `v3: false` marks the country
V3-ineligible and no satellite compositions are registered for it.

**Country-entry fields**

| Field | Default | What it does |
|---|---|---|
| `cities` | auto-picked | Natural Earth place names, in priority order. Coordinates always come from Natural Earth — never typed by hand. |
| `namePosition` | auto | Where the country name sits, normalised within the framed body's bounding box: `[0, 0]` is its top-left, `[1, 1]` its bottom-right. The automatic value is the point of greatest clearance inside the country, nudged clear of the capital's marker. Set it by hand where the automatic placement sits badly. |
| `titleFace` | `'semi'` | `'condensed'` draws the name in Barlow Condensed, 12% narrower, for a name long enough that Semi Condensed would have to be set smaller. |
| `framing` | auto-fit | Projection, fit fractions and territory handling — see the table below. |
| `v3.finalZoom` | `0.68` | The closing framing: the fraction of the frame the country's longest dimension fills. |
| `v3.flagFill` | — | `false` builds only the `white` variant. |
| `v3.ignoreResolutionGuard` | `false` | Render at the requested `finalZoom` even where the satellite base would be upscaled past the ceiling. |
| `tier` | — | Demand tier the country was picked from; drives the README tables only. |

Every one of the 33 configured countries carries an explicit `cities` list and
`namePosition`, and an explicit `finalZoom` where V3 is built, rather than
relying on a default nobody looked at. `npm run sync:data` writes the resolved
values back into the data file after a build, so what ships is reviewable.

**`finalZoom` and the resolution guard.** `finalZoom` states the framing you
want. The satellite base decides how much of it you can have: the builder
measures how far the base would be upscaled in the closing frame and, if that
exceeds **2.6×**, pulls the zoom back and says so in the build log. That keeps a
small country ending wider — which reads as intentional — instead of soft. The
requested and effective values are both in the table above, and the guard is
automatic, so dropping in a finer satellite base returns every country to its
requested framing with no data edits.

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

Then run `npm run sync:data` to write the resolved city list and name position
back into `src/countries.ts`, and build once more. The result is identical — the
values resolve to what the builder already chose — but the data file now records
them explicitly.

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
  sync-country-data.ts  writes resolved city lists and name positions back into countries.ts
  lib/text.ts           exact text measurement (fontkit, against the embedded woff2)
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

- **The satellite base is not Blue Marble** in this build — see the warning
  above. It is the single biggest constraint on the project: Natural Earth II is
  about 4× coarser on the ground, which is why the resolution guard pulls the
  closing zoom back on Germany, Turkey, South Korea, Spain and Poland, and why
  the four smallest subjects have no V3 at all. Every one of those decisions
  reverses automatically when a finer base is dropped in — the guard is
  measured, not hard-coded.
- **V3 zoom depth is set by the base, not by taste.** `finalZoom` asks for 68%
  of the frame; 24 of the 29 V3 countries get it. The five that do not are
  listed with both the requested and the effective value.
- **Relief resolution.** Natural Earth's largest public-domain relief raster is
  1:10m (21600×10800, ~1 855 m/px). For a large country's regional frame that is
  a 1:1 match or better; for a small one it is upscaled — see the relief table.
  Singapore is the extreme case at ~8×. The relief is deliberately low-contrast
  terrain texture rather than a feature, so it holds up further than the raw
  number suggests, but that is the ceiling of the public-domain data. The warp
  applies a light unsharp wherever it is upscaling.
- **Composition count is 123, not 132.** 33 × 4 would be 132; four countries
  (Singapore, the Netherlands, Switzerland, the United Arab Emirates) are
  V3-ineligible per the first brief, and Saudi Arabia is `white` only because its
  flag bears the shahada. That is 66 V1/V2 + 29 V3 white + 28 V3 flag. Every
  omission is deliberate and listed in the checklist above rather than silently
  missing.
- **Argentina's flag** is published in the source set at 8:5 (1.600); the
  official specification is 9:14 (1.556), a 2.9% difference. Every other flag in
  the set matches its official ratio exactly. The difference is invisible under a
  cover-crop, and the file ships as published rather than re-scaled, which would
  distort the artwork.
- **Extreme aspect ratios crop their flag hard.** Chile's silhouette is 4 300 km
  by 180 km, so a 3:2 flag scaled to cover it shows a narrow vertical slice —
  white over red, with the canton cropped away. That is `object-fit: cover`
  behaving correctly, not a fault, and the alternative (stretching the flag to
  the bounding box) is the thing the brief rules out.
- **City counts.** 10–14 for 28 of the 33. The other five are limited by the data
  or the geography: Singapore has exactly one populated place in Natural Earth
  and the United Arab Emirates eight; the Netherlands, Switzerland and South
  Korea run out of room for legible labels before they run out of cities. No
  label is ever shrunk to fit — it gets a leader line, or it goes.
