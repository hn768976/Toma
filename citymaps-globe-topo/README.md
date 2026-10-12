# City Maps, World Connections, HUD Globe, Topo Contours

Nine 20-second seamless loops (600 frames, 30 fps, 3840×2160) built in one
Remotion project with three.js on WebGL2 (`@remotion/three`).

| Composition id | Look | Output name |
|---|---|---|
| `CityHUD-SteelBlue` | 1 · City HUD (2D) | `CityHUD_SteelBlue.mp4` |
| `CityFlyover-Teal` | 2A · City Flyover (3D) | `CityFlyover_Teal.mp4` |
| `CityFlyover-Amber` | 2B · City Flyover (3D) | `CityFlyover_Amber.mp4` |
| `CityTracker-Teal` | 3 · City Tracker (2D) | `CityTracker_Teal.mp4` |
| `WorldConnections-Blue` | 4A · World Connections (3D) | `WorldConnections_Blue.mp4` |
| `WorldConnections-Gold` | 4B · World Connections (3D) | `WorldConnections_Gold.mp4` |
| `HUDGlobe-Teal` | 5 · HUD Globe (3D globe in 2D HUD) | `HUDGlobe_Teal.mp4` |
| `TopoContours-GreenOrange` | 6A · Topo Contours (3D) | `TopoContours_GreenOrange.mp4` |
| `TopoContours-IceBlue` | 6B · Topo Contours (3D) | `TopoContours_IceBlue.mp4` |

(Remotion ids can't contain `_`, so ids use `-`; output files use `_`.)

## Setup

```
npm install
npx remotion studio
```

Node 18+ (tested with Node 22). Everything is built in code; no MCP servers,
no network access at render time.

## Chromium GL flag

WebGL2 needs a GL backend in headless Chromium. `remotion.config.ts` sets
`--gl=angle` by default:

```
Config.setChromiumOpenGlRenderer("angle")
```

On a GPU-less machine ANGLE falls back to SwiftShader (that is how the
previews here were rendered). You can also force it per command:
`--gl=angle` or `--gl=swangle`, or `REMOTION_GL=swangle npx remotion render …`.

## 4K render commands

```
npx remotion render CityHUD-SteelBlue        out/CityHUD_SteelBlue.mp4        --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render CityFlyover-Teal         out/CityFlyover_Teal.mp4         --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render CityFlyover-Amber        out/CityFlyover_Amber.mp4        --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render CityTracker-Teal         out/CityTracker_Teal.mp4         --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render WorldConnections-Blue    out/WorldConnections_Blue.mp4    --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render WorldConnections-Gold    out/WorldConnections_Gold.mp4    --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render HUDGlobe-Teal            out/HUDGlobe_Teal.mp4            --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render TopoContours-GreenOrange out/TopoContours_GreenOrange.mp4 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render TopoContours-IceBlue     out/TopoContours_IceBlue.mp4     --gl=angle --crf=16 --pixel-format=yuv420p
```

For a mezzanine master, use `--codec=prores --prores-profile=4444` instead.

720p previews (what was rendered here): add `--scale=0.3333333333333333`
(gives exactly 1280×720), or run `./scripts/render-previews.sh`.

## 6K stills (6000×3375)

```
npx remotion still CityFlyover-Teal out/CityFlyover_Teal_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Any composition id and frame (0–599) works the same way. 6K stills were not
rendered here.

## Changing the city seed or a colourway

All versions are data rows in `src/versions.ts` (one row per version).

* **City seed:** change `CITY_SEED` (used by the three city looks), or set
  `citySeed` on one row. The generator retries if a seed can't produce a
  2.5 km tracker loop and throws with a clear message if it never does.
* **New colourway:** copy a row, give it a new `id`, change the colours. It
  appears as a new composition automatically.
* `WORLD_SEED` and `TERRAIN_SEED` work the same way for Looks 4/5 and 6.

## How it is built

* `src/city/` — one seeded, tileable 3×3 km procedural city (torus Voronoi
  districts with their own grid angles/block sizes, one organic warped
  district, diagonal periodic arterials, a ring road, a sea band and a river,
  ~4% park blocks, rail yards/lots, building footprints). Intersections are
  found with a spatial hash and turned into a street graph; the tracker route
  is a Dijkstra loop of ~2.5 km on that graph. The map is painted **once** per
  palette into an 8192² canvas → mipmapped, 16× anisotropic, repeat-wrapped
  texture.
* `src/gl/` — the WebGL stage (priority-1 `useFrame` render hook driven only
  by `useCurrentFrame()`), the post pipeline (DoF pyramid for the flyover,
  bloom, vignette, ±1/255 dither and a 1.5% grain that is a pure function of
  pixel position and `frame % 600`), and screen-space ribbon/point materials
  with per-primitive depth of field (width/size grow with the circle of
  confusion and intensity is divided by the spread).
* `src/world/` + `data/natural-earth/` — Natural Earth 1:110m land (public
  domain) rasterised by `scripts/prepare-world.mjs` into `src/data/world.json`.
* `src/topo/` — seeded fractal/ridged heightfield, marching squares at 40
  levels, Chaikin smoothing.
* `src/hud/` — DOM/SVG HUD widgets; every changing value comes from a seeded
  table indexed by a hold schedule that divides 600.

## Determinism

* No `Math.random()`, `Date.now()`, R3F clock, `useState`-driven visuals,
  TAA or accumulation. RNGs are `mulberry32` with fixed seeds.
* All motion is a function of `frame % 600`; periodic motions use whole
  cycles per loop, value schedules use holds that divide 600.
* City/terrain/world data and textures are built once per tab; fonts load
  behind `delayRender`.
* `loopCheck` prop: `--props='{"loopCheck":true}'` makes a composition 601
  frames long so frame 600 can be rendered and compared with frame 0.

## Fonts and data licences

* JetBrains Mono and Inter (woff2, latin subset) in `public/fonts/`, both SIL
  Open Font License 1.1 — licence texts alongside (`OFL-*.txt`).
* Natural Earth 1:110m land, public domain — see
  `data/natural-earth/README.md`.
* Cities, terrain and HUD text are procedural and fictional; city-light
  positions are approximate coordinates of major cities and no names are
  shown.

<!-- MEASUREMENTS -->
