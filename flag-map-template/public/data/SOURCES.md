# Map data

All map data is from **Natural Earth** (naturalearthdata.com), public domain.
See `NaturalEarth-LICENSE.md`. Downloaded from the official Natural Earth
repository, github.com/nvkelso/natural-earth-vector (version 5.2.0-pre,
`master` branch), `geojson/` folder:

| File here | Natural Earth source | Used for |
|-----------|---------------------|----------|
| `ne_50m_admin_0_countries.geojson` | `ne_50m_admin_0_countries.geojson` (1:50m, default worldview) | every country and region, unless listed below |
| `ne_10m_admin_0_countries_subset.geojson` | `ne_10m_admin_0_countries.geojson` (1:10m, default worldview), features NLD, CHE, ARE only | Netherlands, Switzerland, UAE (too blocky at 1:50m) |
| `ne_10m_admin_0_countries_ind_IND.geojson` | `ne_10m_admin_0_countries_ind.geojson` (India worldview), feature IND only | India |
| `ne_10m_admin_0_countries_pak_PAK.geojson` | `ne_10m_admin_0_countries_pak.geojson` (Pakistan worldview), feature PAK only | Pakistan |
| `world-dots.json` | `ne_110m_land.geojson` (1:110m land) sampled on a 1.5° grid | dotted world map on the floor |

Natural Earth publishes its worldview ("point of view") files at 1:10m only,
so India and Pakistan are drawn from 1:10m and simplified to the same level of
detail as the 1:50m shapes.

Only attribute columns were trimmed; coordinates are unchanged. To rebuild
these files from fresh Natural Earth downloads, put the source files in `raw/`
and run `npm run data` (`scripts/extract-ne.mjs`).
