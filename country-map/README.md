# Country Map — news-desk map template (Remotion)

A parameterised country-highlight map: shaded-relief base, one country filled
red, city markers and labels, the country name set large, a soft location ping
at the open and a slow push in across the whole clip.

Every country is one entry in `src/data/countries.json` plus a build step. The
geometry, animation and styling are shared, so a new listing is a data entry and
a render, not a new build.

- **3840×2160, 30 fps, 360 frames (12s).** Not a loop.
- **Two style versions per country:** V1 light relief (broadcast standard) and
  V2 dark mode. Colour is not the version axis beyond these two — the country is.

## Countries included

34 countries ship baked, giving 68 compositions. Every one renders at
4K straight from this project — no re-baking and no data download.

| Country | Slug | Compositions |
|---|---|---|
| United States | `united-states` | `V1-UnitedStatesMapLight`, `V2-UnitedStatesMapDark` |
| China | `china` | `V1-ChinaMapLight`, `V2-ChinaMapDark` |
| India | `india` | `V1-IndiaMapLight`, `V2-IndiaMapDark` |
| Iran | `iran` | `V1-IranMapLight`, `V2-IranMapDark` |
| Australia | `australia` | `V1-AustraliaMapLight`, `V2-AustraliaMapDark` |
| Poland | `poland` | `V1-PolandMapLight`, `V2-PolandMapDark` |
| Italy | `italy` | `V1-ItalyMapLight`, `V2-ItalyMapDark` |
| Mexico | `mexico` | `V1-MexicoMapLight`, `V2-MexicoMapDark` |
| Sweden | `sweden` | `V1-SwedenMapLight`, `V2-SwedenMapDark` |
| Russia | `russia` | `V1-RussiaMapLight`, `V2-RussiaMapDark` |
| Japan | `japan` | `V1-JapanMapLight`, `V2-JapanMapDark` |
| Germany | `germany` | `V1-GermanyMapLight`, `V2-GermanyMapDark` |
| United Kingdom | `united-kingdom` | `V1-UnitedKingdomMapLight`, `V2-UnitedKingdomMapDark` |
| France | `france` | `V1-FranceMapLight`, `V2-FranceMapDark` |
| Brazil | `brazil` | `V1-BrazilMapLight`, `V2-BrazilMapDark` |
| Canada | `canada` | `V1-CanadaMapLight`, `V2-CanadaMapDark` |
| Indonesia | `indonesia` | `V1-IndonesiaMapLight`, `V2-IndonesiaMapDark` |
| Turkey | `turkey` | `V1-TurkeyMapLight`, `V2-TurkeyMapDark` |
| Saudi Arabia | `saudi-arabia` | `V1-SaudiArabiaMapLight`, `V2-SaudiArabiaMapDark` |
| South Korea | `south-korea` | `V1-SouthKoreaMapLight`, `V2-SouthKoreaMapDark` |
| Spain | `spain` | `V1-SpainMapLight`, `V2-SpainMapDark` |
| South Africa | `south-africa` | `V1-SouthAfricaMapLight`, `V2-SouthAfricaMapDark` |
| Netherlands | `netherlands` | `V1-NetherlandsMapLight`, `V2-NetherlandsMapDark` |
| UAE | `uae` | `V1-UaeMapLight`, `V2-UaeMapDark` |
| Singapore | `singapore` | `V1-SingaporeMapLight`, `V2-SingaporeMapDark` |
| Vietnam | `vietnam` | `V1-VietnamMapLight`, `V2-VietnamMapDark` |
| Nigeria | `nigeria` | `V1-NigeriaMapLight`, `V2-NigeriaMapDark` |
| Egypt | `egypt` | `V1-EgyptMapLight`, `V2-EgyptMapDark` |
| Argentina | `argentina` | `V1-ArgentinaMapLight`, `V2-ArgentinaMapDark` |
| Thailand | `thailand` | `V1-ThailandMapLight`, `V2-ThailandMapDark` |
| Philippines | `philippines` | `V1-PhilippinesMapLight`, `V2-PhilippinesMapDark` |
| Switzerland | `switzerland` | `V1-SwitzerlandMapLight`, `V2-SwitzerlandMapDark` |
| Norway | `norway` | `V1-NorwayMapLight`, `V2-NorwayMapDark` |
| Chile | `chile` | `V1-ChileMapLight`, `V2-ChileMapDark` |

## Data

All map data is **[Natural Earth](https://www.naturalearthdata.com/)**, which is
in the **public domain** and requires no attribution:

| Layer | File |
|---|---|
| Country polygons, label points | `ne_10m_admin_0_countries` |
| International boundary lines | `ne_10m_admin_0_boundary_lines_land` |
| Lakes | `ne_10m_lakes` |
| Cities | `ne_10m_populated_places` |
| Sea and gulf names | `ne_50m_geography_marine_polys` |
| Shaded relief raster | `SR_HR` (10m, 21600×10800) |

Boundaries are used **exactly as Natural Earth publishes them** — nothing is
redrawn, added or removed. No tile service, licensed basemap or third-party map
image is used anywhere in this project.

Fonts are vendored under `public/fonts`: **Inter** and **Barlow Condensed**, both
under the SIL Open Font License (licences included alongside them). Nothing is
fetched at render time.

## Rendering

Install once:

```sh
npm install
```

Preview in the studio:

```sh
npx remotion studio
```

### 4K renders

```sh
npx remotion render V1-UnitedStatesMapLight             out/V1_UnitedStatesMapLight.mp4             --scale=1 --crf=16
npx remotion render V2-UnitedStatesMapDark              out/V2_UnitedStatesMapDark.mp4              --scale=1 --crf=16
npx remotion render V1-ChinaMapLight                    out/V1_ChinaMapLight.mp4                    --scale=1 --crf=16
npx remotion render V2-ChinaMapDark                     out/V2_ChinaMapDark.mp4                     --scale=1 --crf=16
npx remotion render V1-IndiaMapLight                    out/V1_IndiaMapLight.mp4                    --scale=1 --crf=16
npx remotion render V2-IndiaMapDark                     out/V2_IndiaMapDark.mp4                     --scale=1 --crf=16
npx remotion render V1-IranMapLight                     out/V1_IranMapLight.mp4                     --scale=1 --crf=16
npx remotion render V2-IranMapDark                      out/V2_IranMapDark.mp4                      --scale=1 --crf=16
npx remotion render V1-AustraliaMapLight                out/V1_AustraliaMapLight.mp4                --scale=1 --crf=16
npx remotion render V2-AustraliaMapDark                 out/V2_AustraliaMapDark.mp4                 --scale=1 --crf=16
npx remotion render V1-PolandMapLight                   out/V1_PolandMapLight.mp4                   --scale=1 --crf=16
npx remotion render V2-PolandMapDark                    out/V2_PolandMapDark.mp4                    --scale=1 --crf=16
npx remotion render V1-ItalyMapLight                    out/V1_ItalyMapLight.mp4                    --scale=1 --crf=16
npx remotion render V2-ItalyMapDark                     out/V2_ItalyMapDark.mp4                     --scale=1 --crf=16
npx remotion render V1-MexicoMapLight                   out/V1_MexicoMapLight.mp4                   --scale=1 --crf=16
npx remotion render V2-MexicoMapDark                    out/V2_MexicoMapDark.mp4                    --scale=1 --crf=16
npx remotion render V1-SwedenMapLight                   out/V1_SwedenMapLight.mp4                   --scale=1 --crf=16
npx remotion render V2-SwedenMapDark                    out/V2_SwedenMapDark.mp4                    --scale=1 --crf=16
npx remotion render V1-RussiaMapLight                   out/V1_RussiaMapLight.mp4                   --scale=1 --crf=16
npx remotion render V2-RussiaMapDark                    out/V2_RussiaMapDark.mp4                    --scale=1 --crf=16
npx remotion render V1-JapanMapLight                    out/V1_JapanMapLight.mp4                    --scale=1 --crf=16
npx remotion render V2-JapanMapDark                     out/V2_JapanMapDark.mp4                     --scale=1 --crf=16
npx remotion render V1-GermanyMapLight                  out/V1_GermanyMapLight.mp4                  --scale=1 --crf=16
npx remotion render V2-GermanyMapDark                   out/V2_GermanyMapDark.mp4                   --scale=1 --crf=16
npx remotion render V1-UnitedKingdomMapLight            out/V1_UnitedKingdomMapLight.mp4            --scale=1 --crf=16
npx remotion render V2-UnitedKingdomMapDark             out/V2_UnitedKingdomMapDark.mp4             --scale=1 --crf=16
npx remotion render V1-FranceMapLight                   out/V1_FranceMapLight.mp4                   --scale=1 --crf=16
npx remotion render V2-FranceMapDark                    out/V2_FranceMapDark.mp4                    --scale=1 --crf=16
npx remotion render V1-BrazilMapLight                   out/V1_BrazilMapLight.mp4                   --scale=1 --crf=16
npx remotion render V2-BrazilMapDark                    out/V2_BrazilMapDark.mp4                    --scale=1 --crf=16
npx remotion render V1-CanadaMapLight                   out/V1_CanadaMapLight.mp4                   --scale=1 --crf=16
npx remotion render V2-CanadaMapDark                    out/V2_CanadaMapDark.mp4                    --scale=1 --crf=16
npx remotion render V1-IndonesiaMapLight                out/V1_IndonesiaMapLight.mp4                --scale=1 --crf=16
npx remotion render V2-IndonesiaMapDark                 out/V2_IndonesiaMapDark.mp4                 --scale=1 --crf=16
npx remotion render V1-TurkeyMapLight                   out/V1_TurkeyMapLight.mp4                   --scale=1 --crf=16
npx remotion render V2-TurkeyMapDark                    out/V2_TurkeyMapDark.mp4                    --scale=1 --crf=16
npx remotion render V1-SaudiArabiaMapLight              out/V1_SaudiArabiaMapLight.mp4              --scale=1 --crf=16
npx remotion render V2-SaudiArabiaMapDark               out/V2_SaudiArabiaMapDark.mp4               --scale=1 --crf=16
npx remotion render V1-SouthKoreaMapLight               out/V1_SouthKoreaMapLight.mp4               --scale=1 --crf=16
npx remotion render V2-SouthKoreaMapDark                out/V2_SouthKoreaMapDark.mp4                --scale=1 --crf=16
npx remotion render V1-SpainMapLight                    out/V1_SpainMapLight.mp4                    --scale=1 --crf=16
npx remotion render V2-SpainMapDark                     out/V2_SpainMapDark.mp4                     --scale=1 --crf=16
npx remotion render V1-SouthAfricaMapLight              out/V1_SouthAfricaMapLight.mp4              --scale=1 --crf=16
npx remotion render V2-SouthAfricaMapDark               out/V2_SouthAfricaMapDark.mp4               --scale=1 --crf=16
npx remotion render V1-NetherlandsMapLight              out/V1_NetherlandsMapLight.mp4              --scale=1 --crf=16
npx remotion render V2-NetherlandsMapDark               out/V2_NetherlandsMapDark.mp4               --scale=1 --crf=16
npx remotion render V1-UaeMapLight                      out/V1_UaeMapLight.mp4                      --scale=1 --crf=16
npx remotion render V2-UaeMapDark                       out/V2_UaeMapDark.mp4                       --scale=1 --crf=16
npx remotion render V1-SingaporeMapLight                out/V1_SingaporeMapLight.mp4                --scale=1 --crf=16
npx remotion render V2-SingaporeMapDark                 out/V2_SingaporeMapDark.mp4                 --scale=1 --crf=16
npx remotion render V1-VietnamMapLight                  out/V1_VietnamMapLight.mp4                  --scale=1 --crf=16
npx remotion render V2-VietnamMapDark                   out/V2_VietnamMapDark.mp4                   --scale=1 --crf=16
npx remotion render V1-NigeriaMapLight                  out/V1_NigeriaMapLight.mp4                  --scale=1 --crf=16
npx remotion render V2-NigeriaMapDark                   out/V2_NigeriaMapDark.mp4                   --scale=1 --crf=16
npx remotion render V1-EgyptMapLight                    out/V1_EgyptMapLight.mp4                    --scale=1 --crf=16
npx remotion render V2-EgyptMapDark                     out/V2_EgyptMapDark.mp4                     --scale=1 --crf=16
npx remotion render V1-ArgentinaMapLight                out/V1_ArgentinaMapLight.mp4                --scale=1 --crf=16
npx remotion render V2-ArgentinaMapDark                 out/V2_ArgentinaMapDark.mp4                 --scale=1 --crf=16
npx remotion render V1-ThailandMapLight                 out/V1_ThailandMapLight.mp4                 --scale=1 --crf=16
npx remotion render V2-ThailandMapDark                  out/V2_ThailandMapDark.mp4                  --scale=1 --crf=16
npx remotion render V1-PhilippinesMapLight              out/V1_PhilippinesMapLight.mp4              --scale=1 --crf=16
npx remotion render V2-PhilippinesMapDark               out/V2_PhilippinesMapDark.mp4               --scale=1 --crf=16
npx remotion render V1-SwitzerlandMapLight              out/V1_SwitzerlandMapLight.mp4              --scale=1 --crf=16
npx remotion render V2-SwitzerlandMapDark               out/V2_SwitzerlandMapDark.mp4               --scale=1 --crf=16
npx remotion render V1-NorwayMapLight                   out/V1_NorwayMapLight.mp4                   --scale=1 --crf=16
npx remotion render V2-NorwayMapDark                    out/V2_NorwayMapDark.mp4                    --scale=1 --crf=16
npx remotion render V1-ChileMapLight                    out/V1_ChileMapLight.mp4                    --scale=1 --crf=16
npx remotion render V2-ChileMapDark                     out/V2_ChileMapDark.mp4                     --scale=1 --crf=16
```

A 1080p preview is the same command with `--scale=0.5`. A still is
`npx remotion still <id> out/<name>.png --frame=340 --scale=1`.

Compositions are defined at 3840×2160; `--scale` is the only thing that changes
between a preview and a delivery render.

## Adding a country

1. **Add an entry to `src/data/countries.json`.** The key is the slug used for
   the composition id and the baked files.

   ```json
   "japan": {
     "adm0a3": "JPN",
     "name": "JAPAN",
     "framing": {"zoom": 1, "offsetX": 0, "offsetY": 0},
     "maxCities": 12,
     "reliefGain": 1.8,
     "nameScale": 1
   }
   ```

   | Field | Meaning |
   |---|---|
   | `adm0a3` | Natural Earth `ADM0_A3` code. This is the only identifier that matters. |
   | `name` | The name set over the country, as it should read. |
   | `framing.zoom` | Multiplies the automatic fit. `1` puts the country in roughly the central third. |
   | `framing.offsetX` / `offsetY` | Shifts the framing, in fractions of the frame. |
   | `framing.projection` | `"conic"` or `"mercator"`. Defaults to conic away from the equator. |
   | `framing.bounds` | `[west, south, east, north]` to frame by hand instead of by the country's own extent. |
   | `maxCities` | 10–14 is plenty. Labels are dropped rather than allowed to collide, so the rendered count can be lower. |
   | `reliefGain` | Contrast of the relief shading. 1.5 for mountainous countries, 2.0–2.4 for flat ones. |
   | `nameScale` | Multiplies the automatic name size. |
   | `nameAt` | `[lon, lat]` to place the country name by hand. |
   | `nameOffset` | `[x, y]` nudge in fractions of the frame. |
   | `cities.exclude` | Names to leave off. |
   | `cities.rename` | `{"Shenyeng": "Shenyang"}` for Natural Earth transliterations a news map would not use. |
   | `cities.anchors` | `{"Kraków": "below"}` to force a label side. |

2. **Bake it.**

   ```sh
   npm run bake            # every country
   npm run bake -- japan   # just one
   ```

   The first run downloads the Natural Earth sources into `data/` (about 250 MB,
   not part of this project's output) and decodes the relief raster. Later runs
   reuse them. The bake writes:

   - `src/data/geo/<slug>.json` — projected SVG paths and label positions, in
     composition coordinates
   - `public/relief/<slug>.png` — the relief plate, warped into that country's
     own projection
   - `src/data/geo/index.ts` — regenerated so `Root.tsx` picks the country up

3. **Look at a still**, and adjust if needed:

   ```sh
   npx remotion still V1-JapanMapLight out/check.png --frame=340 --scale=0.5
   ```

   The bake places the country name automatically — over land, near the
   cartographic label point, clear of the city markers, shrinking to fit. Long
   thin countries are the case where it can still land somewhere you would not
   choose; set `nameAt` and `nameScale` and re-bake.

Two compositions, `V1-<Country>MapLight` and `V2-<Country>MapDark`, appear
automatically. Nothing else needs editing.

### Choosing countries

A country-highlight map takes a position on where borders lie. This project
uses Natural Earth's published boundaries unmodified, which is the defensible
neutral choice, and keeps the graphics descriptive — a country, its cities, its
name. The location ping is a plain expanding circle, never a reticle or an
impact marker. Countries with significant contested land borders carry a real
risk of stock rejection and of complaints from buyers in the affected regions;
that is a commissioning decision, not a technical one.

## How it works

- **`tools/bake.mjs`** does all the geography, once per country, at build time:
  projects the Natural Earth vectors with `d3-geo`, warps the relief raster into
  the same projection, and works out where every label goes.
- **The relief plate carries three channels**, not a picture: red is the
  shading, green is the shoreline, blue is land coverage. The composition turns
  those into colour with an SVG `feComponentTransfer`, so one plate serves both
  style versions, and the land/water split never costs a 130k-point clip path at
  render time.
- **`src/CountryMap.tsx`** is the whole composition. Everything is driven from
  `useCurrentFrame()` with `interpolate` and explicit clamping — no state, no
  timers. Sizes and type are fractions of the frame from `useVideoConfig()`.
- **The push-in is one transform** on the composed layer, so relief and vectors
  scale together and stay registered. Labels are culled against the framing that
  survives to the end of the push, not the one it starts with, so nothing crops
  as the shot tightens.

### Timing

| Frames | Beat |
|---|---|
| 0–20 | Base map present, already pushing in slowly |
| 15–45 | Country fill wipes on from its centre outward, following the polygon |
| 30–70 | Location ping: three thin circles from the capital, once |
| 50–140 | City markers appear one at a time, labels just after |
| 90–130 | Country name fades and scales very slightly into place |
| 0–360 | Continuous slow push in, 1.0 → 1.18, with a slight drift toward the capital |
| 300–360 | Holds at the final framing |

All of it is in `src/timing.ts`; the palettes are in `src/styles.ts`.
