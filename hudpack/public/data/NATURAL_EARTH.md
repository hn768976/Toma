# Natural Earth data

`ne_110m_land.geojson` is the **Natural Earth 1:110m Land** layer, v5.1.2
(from https://github.com/nvkelso/natural-earth-vector).

Natural Earth is **public domain**. No permission is needed to use it, and no
credit is required, though "Made with Natural Earth" is appreciated.
See https://www.naturalearthdata.com/about/terms-of-use/.

The Market Map rasterises this layer to a 1-degree dot grid at load time
(`src/looks/map/landDots.ts`), using plain arithmetic on the polygon vertices,
so every machine produces the same dots.
