# GPS Tracking Map HUD — Remotion project

Nine 20-second motion graphics (30 fps, 16:9, compositions defined at **3840×2160**) built
on one **invented coastal city** generated in code. No real map data, no OpenStreetMap, no
real place, company, product or agency names.

| # | Composition ID (Remotion) | Output file | Engine | Loop |
|---|---|---|---|---|
| 1 | `GPSTrack-Teal` | `GPSTrack_Teal.mp4` | PixiJS 8 / WebGL2 | 600-frame loop |
| 2 | `GPSTrack-Interface` | `GPSTrack_Interface.mp4` | PixiJS 8 + Canvas 2D HUD | 600-frame loop |
| 3 | `GPSAnalysis-Blue` | `GPSAnalysis_Blue.mp4` | PixiJS 8 + three.js globe | 8 cuts |
| 4 | `GPSAnalysis-Amber` | `GPSAnalysis_Amber.mp4` | PixiJS 8 + three.js globe | 8 cuts |
| 5 | `NightMap-HUD` | `NightMap_HUD.mp4` | PixiJS 8 + Canvas 2D HUD | 600-frame loop |
| 6 | `MapFlyover-Blue` | `MapFlyover_Blue.mp4` | three.js (`@remotion/three`) | 5 moves |
| 7 | `MapFlyover-Amber` | `MapFlyover_Amber.mp4` | three.js (`@remotion/three`) | 5 moves |
| 8 | `TargetLocator-Grey` | `TargetLocator_Grey.mp4` | PixiJS 8 + three.js globe | 600-frame loop |
| 9 | `TargetLocator-Red` | `TargetLocator_Red.mp4` | PixiJS 8 + three.js globe | 600-frame loop |

Remotion composition IDs may not contain `_`, so the IDs use `-`; the file names keep the `_`.
The `checks` folder holds 601-frame copies of the five loops (`…-check601`) used to prove
that frame 600 equals frame 0, plus a `CityMapFull` still of the whole map.

## Install

```bash
npm ci            # Node 20+; versions are pinned in package.json / package-lock.json
npx remotion studio   # preview in the browser
```

## Render at 4K

The project defaults to `--gl=angle` (set in `remotion.config.ts`) for a machine with a GPU.

```bash
for id in GPSTrack-Teal GPSTrack-Interface GPSAnalysis-Blue GPSAnalysis-Amber NightMap-HUD \
          MapFlyover-Blue MapFlyover-Amber TargetLocator-Grey TargetLocator-Red; do
  npx remotion render "$id" "out/${id//-/_}.mp4" --codec=h264 --crf=16 --pixel-format=yuv420p \
    --gl=angle --concurrency=2
done
```

* On a machine **without a GPU** use `--gl=swangle` (ANGLE on SwiftShader). `--gl=angle`
  then has no WebGL2 at all; `swangle` is the same ANGLE path in software and gives
  identical output, only slower.
* 720p preview (what was delivered): add `--scale=0.3333333333333333` (→ 1280×720).
* Each browser tab builds the city once (~3 s) and the flyover bakes its map tiles once
  (~10 s), so keep `--concurrency` low (1–2) at 4K: the flyover holds ~0.5 GB of tiles per tab.
* `scripts/render-previews.sh` is the exact script used for the previews (PNG sequence →
  ffmpeg H.264 CRF 16 yuv420p).

## The city and how to get a new one

`src/city/` — `generate.ts` (city), `graph.ts` (road graph + routes), `track.ts` (tracking loop),
`index.ts` (**`CITY_SEED`**).

* Change `CITY_SEED` in `src/city/index.ts` to any integer to get a **different city**:
  new coastline, bay, port and piers, river course, district layout (Voronoi districts, each
  with its own grid angle, block size, warp and type: core / grid / wide / suburb / industrial),
  parks, dark lots, long avenues and roundabouts, highways and interchanges, rail lines and a
  rail yard, airport, routes and named points.
* Core map 12 × 7 km; streets are generated 2.2 km past every edge so wide and rotating frames
  never reach an empty border.
* Roads have a hierarchy — highway, avenue, street, lane, rail — each with its own width,
  brightness and glow; lanes (and at very far zooms, streets) fade out by zoom.
* All randomness is `mulberry32` seeded at module level; there is no `Math.random()`,
  `Date.now()`, `useState` or `useFrame` driving anything visual.
* A new seed may need the camera numbers re-checked: run `npx tsx scripts/track-test.ts 0.315`
  (route on-road / junction check and camera-margin check for the tracking loop).

## Looks — colours

| Look | Map / background | Streets | Highlights / accents |
|---|---|---|---|
| 1 GPSTrack_Teal | land `#0B171C`, parks & water `#050A0C`/`#04080A` | streets `#3FB0B8`, avenues `#5ED0D8`, highways `#8AF0F0` (+glow) | dot `#F5E21E` with white ring, route `#A8F6F8` |
| 2 GPSTrack_Interface | land `#0F1C1C`, dark `#050808`, panels `#0A0A0A`/`#121314` | `#6FC4C8` / `#86D2D4` / `#A8E4E4` | dot `#F5E21E`, text `#B9BEC2`, amber `#E8A040` |
| 3 GPSAnalysis_Blue | `#071016` on `#000203` | `#6CC8F0`, highways `#C8ECFF` | UI white/blue, accent orange `#F0A030`, lock `#FFF0B0` |
| 4 GPSAnalysis_Amber | `#120A04` on `#030201` | `#F0A03A`, highways `#FFD8A0` | UI cream/amber, accent cyan `#3AD8F0` |
| 5 NightMap_HUD | `#141F2A`, dark `#0B121A`, vignette to `#04080E` | `#6E86A0`, avenues `#7E9AB4`, highways `#9AB2C8` | HUD white `#C8D6E4` |
| 6 MapFlyover_Blue | blocks `#3A6A88`, dark `#08141C` | `#7AC8F0`, avenues `#A6DDF8`, highways `#CFEFFF` | grid `#BFE6FF`, mint `#5CF0C8`, ring `#FFD27A` |
| 7 MapFlyover_Amber | blocks `#8A5A2A`, dark `#1C1006` | `#F8C07A`, avenues `#FFD8A0`, highways `#FFF0D8` | grid `#FFE2B8`, ring `#7AF0FF` |
| 8 TargetLocator_Grey | `#1A1C1F`, dark `#151719` | `#3A3E44`, avenues `#454A50` | targets `#FFD03A`, teal `#4FD8D0`, amber `#F0A030` |
| 9 TargetLocator_Red | as 8 | as 8 | targets `#FF3A3A` + brief red flash on lock |

Edit colours in `src/looks/styles.ts` (2D maps), `src/comps/Flyover.tsx` (3D map) and the
`Theme` objects at the top of each composition / HUD file.

## Target labels (looks 8–9)

Targets are taken from the city's named points (`CITY.pois`, junctions on avenues). Each has
an invented code `TRK-nnnn` and invented local grid coordinates (`E 482000 + x`, `N 739000 − y`
in metres) — not latitude/longitude of any real place. One target every 60 frames, 10 per loop.

TARGET_TABLE_PLACEHOLDER

## Determinism, loops, banding

* Every value is a function of `useCurrentFrame()`; loop looks use `frame mod 600`, so frame
  600 equals frame 0 pixel for pixel.
* The Canvas 2D HUD resets its context state every frame (`ctx.reset()`), so a frame never
  depends on what the previous frame left behind.
* Maps render into **half-float** (RGBA16F, 4× MSAA) targets; bloom/softness come from the
  mip chain of that target; the final pass adds a ±1/255 dither only where the pixel is not
  black.
* Fonts (Share Tech Mono, Rajdhani — SIL OFL, licences in `public/fonts/`), the globe data
  (Natural Earth 1:110m land, public domain, via `world-atlas`) and the flyover tiles all load
  behind `delayRender`.

## Timings

TIMINGS_PLACEHOLDER
