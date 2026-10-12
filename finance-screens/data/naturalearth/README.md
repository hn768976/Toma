# Natural Earth 1:110m land

`ne_110m_land.geojson` — Natural Earth, 1:110m physical vectors, "Land".
Source: https://www.naturalearthdata.com/ (GeoJSON copy from the
nvkelso/natural-earth-vector repository).

Natural Earth data is in the **public domain**: "All versions of Natural Earth
raster + vector map data found on this website are in the public domain. You may
use the maps in any manner, including modifying the content and design,
electronic dissemination, and offset printing." No permission is needed and no
attribution is required (credit: "Made with Natural Earth").

`scripts/build-map.mjs` turns it into `public/data/world-dots.json`: an
equirectangular 168-column grid (lat 84°N to 58°S, Antarctica cropped) with a
dot wherever the cell centre is on land.
