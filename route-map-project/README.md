# Route Map: Air & Shipping

A Remotion project that renders an angled world-map plate — satellite base,
curved route network, moving aircraft or vessel markers and upright
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

```bash
npm run check       # every shipping lane is verified to stay in the water
npm run lint        # tsc --noEmit
npm run bake        # rebuild the basemap tiles from data/
```

`npm run check` samples each sea route along the curve the renderer actually
draws and tests it against the Natural Earth land polygons, allowing the Suez,
Panama, Kiel and Corinth canals as deliberate transits. It exits non-zero if a
lane runs inland, so it is worth running before queueing a render batch — a
shipping map with lanes over land is worse than no shipping map.

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

Measured on the machine this project was built on: **4 vCPU Intel Xeon @ 2.80 GHz,
15 GB RAM, no GPU** (Chromium on software GL via `swangle`), `Config.setConcurrency(4)`.

Timed by rendering 10 frames and 70 frames of the same composition and taking the
difference, which cancels out bundling and browser start-up:

| Composition | 10 frames | 70 frames | **Per frame at 4K** | Full 480-frame render |
|---|---|---|---|---|
| `V1-RouteMapNorthAmericaAir` | 82.6 s | 383.8 s | **5.02 s** | ~41 min |
| `V2-RouteMapEuropeShipping` | 59.2 s | 279.2 s | **3.67 s** | ~30 min |

Fixed overhead (bundle + browser start) is ~32 s and ~23 s respectively.

Budget the other four regions at roughly **4–5 s/frame**, i.e. **30–40 minutes each**
on hardware like the above — call it **3–4 hours for all six**. The cost is almost
all CPU rasterisation, so it scales close to linearly with core count: a 16-core
box should land nearer 8–10 minutes per composition. Raise
`Config.setConcurrency()` in `remotion.config.ts` to match the render machine —
each worker holds a decoded ~4096x2824 basemap, so allow roughly 1.5 GB per worker.

The two heaviest things on the page are the `backdrop-filter` depth-of-field bands
and the size of the map plane; the bands are already clipped to the height of their
own gradients rather than covering the frame, which is worth about 23%.

### What was checked on the encoded files

- **Format:** 1920x1080, H.264, `yuv420p`, limited range, bt709, 30 fps, exactly
  480 frames / 16.000 s, no audio track.
- **Loop:** the difference between the last frame and the first is the same
  order as any other one-frame step (1.5 vs 1.0-1.1 mean abs luma), i.e. the
  seam is indistinguishable from an ordinary frame advance.
- **Banding:** in the deep water, a 400x260 sample uses 186 distinct luma
  levels with no stepped contours at 3.6x contrast boost; the baked bathymetry
  mottle plus the grain plate dither the gradient.
- **Shipping lanes:** `npm run check` passes for all six regions. It samples
  the exact bowed curve the renderer draws, via the same `routePlanePoints`
  and `sampleSpline` the component uses, so the check and the picture cannot
  drift apart.
- **No stray linework:** routes are the only lines on the plate. There is no
  graticule and no survey decor.

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
   | `edgeScale` | `[left, right]` base values for the two numeric readout columns |
   | `waterBoxes` | `[lonMin, latMin, lonMax, latMax]` boxes of open water; the survey decor is scattered inside them |
   | `routes` | See below |
   | `pins` | `{ lon, lat, color, pulse? }`, 12–20 of them, clustered rather than spread |

   A route is `{ id, style, color, pts, bend?, mode?, markers?, trips? }`.
   Two `pts` are drawn as a bowed arc (`bend`, a fraction of the chord —
   0.08–0.18 reads well). Three or more are smoothed through with a spline:
   **that is how shipping lanes are kept in the water** — give a sea route
   enough waypoints that it never crosses land.

   Waypoints that keep a lane in the water are often near-collinear, and a
   spline through them renders as a dead straight line that reads as a ruler
   stroke laid over the map. So every multi-point route is bowed out to a
   minimum curvature (`MIN_BOW` in `src/lib/paths.ts`, 10% of the chord),
   in whichever direction its waypoints already lean, on a squared-sine
   profile that builds in the open middle and fades at the ends so waypoints
   placed to thread a strait stay put. **Raising `MIN_BOW` pushes lanes
   outward and can beach them — always re-run `npm run check` after.** At 0.12
   three lanes go ashore, at 0.14 five do. `markers` is a weight, not a
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
  components/              routes, markers, pins, edge readouts, depth of field
scripts/
  fetch-data.mjs           re-fetch and re-simplify the public-domain sources
  bake-basemaps.mjs        build public/basemaps/*.jpg from data/
  check-routes.mjs         fail if a shipping lane runs over land
  make-zip.sh              package the project for a 4K render elsewhere
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
