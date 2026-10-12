# Natural Earth 1:110m land

`ne_110m_land.geojson` is from Natural Earth (https://www.naturalearthdata.com/),
via https://github.com/nvkelso/natural-earth-vector (geojson/ne_110m_land.geojson).

Natural Earth data is in the **public domain**. No permission is needed to use
it; see https://www.naturalearthdata.com/about/terms-of-use/.

`npm run prepare-data` turns it into `src/data/world.json` (a 1440 x 720 land
mask, equirectangular, plus coastline polylines). The generated file is
committed, so the script only needs to run if you change the source data.
