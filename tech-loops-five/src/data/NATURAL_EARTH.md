# Natural Earth data

`ne_110m_land.json` (renamed from `ne_110m_land.geojson`, content unchanged) — Natural Earth 1:110m physical "Land" polygons,
from https://github.com/nvkelso/natural-earth-vector (geojson/ne_110m_land.geojson).

Licence: **public domain**. "All versions of Natural Earth raster + vector map
data found on this website are in the public domain. You may use the maps in
any manner, including modifying the content and design, electronic
dissemination, and offset printing." — https://www.naturalearthdata.com/about/terms-of-use/

Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.

Used by Look 3 (Security Dashboard) to build the dotted "Global threat map"
(src/looks/dashboard/worldDots.ts samples a lon/lat grid against these polygons).
