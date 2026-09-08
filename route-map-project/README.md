# Route Map: Air & Shipping

A Remotion project that renders an angled world-map plate — satellite base,
graticule, curved route network, moving aircraft or vessel markers and upright
pushpins — as a seamless 16-second loop.

**Six regions are configured. All are defined at 3840×2160 / 30 fps / 480 frames.**

| Composition id | Region | Palette | Routes | Rendered here |
|---|---|---|---|---|
| `RouteMapGlobalMixed` | Global world view | cool | mixed | no |
| `V2-RouteMapEuropeShipping` | Europe & Mediterranean | cool | shipping | **yes** |
| `V1-RouteMapNorthAmericaAir` | North America | warm | air | **yes** |
| `RouteMapNorthAtlanticAir` | North Atlantic corridor | warm | air | no |
| `RouteMapAsiaPacificShipping` | Asia-Pacific / East Asia | cool | shipping | no |
| `RouteMapMiddleEastShipping` | Middle East & Indian Ocean | cool | shipping | no |

---

## Quick start

```bash
npm install
npm run studio      # or: npx remotion studio
```

Everything the studio needs is committed: the baked basemaps in
`public/basemaps/`, the Natural Earth vectors in `data/`, and the bundled mono
face in `public/fonts/`. No network access is required after `npm install`.

## Rendering at 4K

One command per composition. `--scale=1` is the native 3840×2160.

```bash
npx remotion render RouteMapGlobalMixed        out/RouteMapGlobalMixed.mp4        --scale=1 --crf=16
npx remotion render V2-RouteMapEuropeShipping  out/V2_RouteMapEuropeShipping.mp4  --scale=1 --crf=16
npx remotion render V1-RouteMapNorthAmericaAir out/V1_RouteMapNorthAmericaAir.mp4 --scale=1 --crf=16
npx remotion render RouteMapNorthAtlanticAir   out/RouteMapNorthAtlanticAir.mp4   --scale=1 --crf=16
npx remotion render RouteMapAsiaPacificShipping out/RouteMapAsiaPacificShipping.mp4 --scale=1 --crf=16
npx remotion render RouteMapMiddleEastShipping out/RouteMapMiddleEastShipping.mp4 --scale=1 --crf=16
```

A 1080p preview is the same command with `--scale=0.5`. A still is
`npx remotion still <id> out/<name>.png --frame=<n> --scale=0.5`.

### Measured 4K render time

MEASURED_TIME_PLACEHOLDER

## Data sources

Both are **public domain**, and both are baked into this repository so the
project renders offline.

- **NASA Blue Marble Next Generation** (NASA Visible Earth / Goddard) —
  `data/bluemarble-4096x2048.jpg`, the true-colour + bathymetry equirectangular
  world image that every basemap tile is resampled from.
- **Natural Earth** 1:10m physical and cultural vectors (public domain) —
  `data/ne_10m_land.json`, `ne_10m_coastline.json`, `ne_10m_lakes.json`,
  `ne_10m_borders.json`. Stored simplified (Douglas-Peucker, ~0.01°) and
  delta-encoded at 1e-3° to keep the project small; `scripts/fetch-data.mjs`
  documents and re-fetches the originals.

No Google, Bing, Mapbox or Esri tiles are used anywhere. Every icon — pushpins,
aircraft, vessels — is an SVG path drawn in this project
(`src/components/Markers.tsx`, `src/components/Pushpins.tsx`). **Route paths are
invented**; they are not published route data, and the plates carry no place
names or country names.

`public/fonts/DejaVuSansMono.ttf` is the DejaVu font (Bitstream Vera / DejaVu
licence — free to use and redistribute), bundled so the numeric readouts render
identically on any machine.

---

## Adding a region

Adding a region is a data entry plus one bake. No component changes.

1. **Add an entry to `src/data/regions.ts`** (the single data file — regions,
   routes and pins all live there). The required fields:

   | Field | What it does |
   |---|---|
   | `id` | Used for the basemap filenames, `public/basemaps/<id>-<palette>.jpg` |
   | `name` | Human-readable label, studio only |
   | `center` | `[lon, lat]` at the middle of what the camera sees |
   | `span` | Degrees of latitude between the top and bottom edges of the frame |
   | `stdParallel` | Standard parallel; omit to use `center[1]`. Use `0` for a world view |
   | `palette` | `"warm"` (satellite) or `"cool"` (blue-grey shaded relief) |
   | `routeType` | `"air"`, `"shipping"` or `"mixed"` — the default marker species |
   | `gridStep` / `gridMajor` | Minor graticule spacing in degrees, and a major line every N minor |
   | `edgeScale` | `[left, right]` base values for the two numeric readout columns |
   | `waterBoxes` | `[lonMin, latMin, lonMax, latMax]` boxes of open water; the survey decor is scattered inside them |
   | `routes` | See below |
   | `pins` | `{ lon, lat, color, pulse? }`, 12–20 of them, clustered rather than spread |

   A route is `{ id, style, color, pts, bend?, mode?, markers?, trips? }`.
   Two `pts` are drawn as a bowed arc (`bend`, a fraction of the chord —
   0.08–0.18 reads well). Three or more are smoothed through with a spline:
   **that is how shipping lanes are kept in the water** — give a sea route
   enough waypoints that it never crosses land. `markers` is a weight, not a
   count: the component distributes its total (26 by default) across routes in
   proportion. `trips` must be a whole number so the loop closes.

2. **Add a composition** to `COMPOSITIONS` in `src/Root.tsx`:
   `{ id: "RouteMapMyRegion", regionId: "myRegion" }`. `palette` and `routeType`
   are optional overrides — the component takes both as props, so any region can
   be rendered in either treatment.

3. **Bake the basemap:** `npm run bake`. It reads `regions.ts`, solves the same
   framing the renderer uses, and writes `public/basemaps/<id>-<palette>.jpg`.
   Add `-- --all-palettes` to bake both treatments, or
   `-- --region=<id>` to bake just one.

4. **Check the framing in the studio** before queueing a render. `npm run bake`
   prints the plane window and the window the camera actually sees for each
   region; if the visible latitude runs past ±85° or the region sits off-centre,
   adjust `center` and `span` and re-bake.

## Project layout

```
src/
  Root.tsx                 compositions (one per region)
  RouteMap.tsx             the component: region, palette, routeType, markers
  data/regions.ts          THE data file — regions, routes, pins
  lib/geo.ts               the map plane, its camera, and the framing solver
  lib/paths.ts             route curves; marker position + tangent heading
  lib/prng.ts              seeded PRNG (no Math.random at render time)
  lib/palettes.ts          the two colour treatments
  components/              basemap grade, graticule, routes, markers, pins, grade
scripts/
  fetch-data.mjs           re-fetch and re-simplify the public-domain sources
  bake-basemaps.mjs        build public/basemaps/*.jpg from data/
data/                      baked public-domain source data
public/basemaps/           baked basemap tiles (one per region and palette)
```

## Notes on the build

- **No 3D engine.** The map is a flat plane under a CSS `perspective` with
  `rotateZ(-5°) rotateX(20°)`. `src/lib/geo.ts` mirrors that transform in JS,
  which is what lets the pushpins stand upright in screen space while their
  shadows rake away on the plane.
- **Everything loops.** All motion is a pure function of `useCurrentFrame()`:
  the drift is a sine over exactly 480 frames, markers complete whole trips,
  and the dash march advances a whole number of dash periods.
- **Frames are pure.** No state and no `Math.random()` at render time — Remotion
  renders frames out of order across threads. Placement jitter and marker phases
  come from a seeded PRNG at module scope or inside `useMemo`.
- **Marker heading** comes from `getPointAtLength()` on a detached
  `SVGPathElement` (cached per path string, called synchronously during render),
  with the tangent taken from two nearby samples. That is what keeps a marker
  pointing along its heading instead of sliding sideways round a curve.
- **Concurrency.** `remotion.config.ts` pins concurrency to 4 because each tab
  decodes a ~4096×2824 basemap. Raise it if the render machine has the memory.
