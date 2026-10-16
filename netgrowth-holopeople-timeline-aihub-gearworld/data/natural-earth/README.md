# Natural Earth 1:110m land

`ne_110m_land.geojson` is from Natural Earth (https://www.naturalearthdata.com/),
retrieved from https://github.com/nvkelso/natural-earth-vector.

**Public domain.** "All versions of Natural Earth raster + vector map data found
on this website are in the public domain. You may use the maps in any manner,
including modifying the content and design, electronic dissemination, and offset
printing." (naturalearthdata.com/about/terms-of-use)

`scripts/build-map-dots.mjs` turns it into the dot grid in `src/data/worldDots.json`
(1 degree cells, a dot wherever the cell centre is on land).
