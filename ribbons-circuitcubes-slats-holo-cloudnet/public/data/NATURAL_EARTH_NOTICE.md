# Natural Earth data

`ne_110m_land.geojson` is the **Natural Earth 1:110m Physical Vectors — Land** dataset,
downloaded from the Natural Earth vector repository
(https://github.com/nvkelso/natural-earth-vector, `geojson/ne_110m_land.geojson`).

Natural Earth is **public domain**. No permission is needed to use it, and no attribution
is required (it is appreciated: "Made with Natural Earth. Free vector and raster map data
@ naturalearthdata.com").

In Cloud Network it is rasterised once, at load time, into a 170×70 dot grid
(`src/looks/landmask.ts`) using exact point-in-polygon tests.
