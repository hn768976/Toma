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

## Measured render times

Measured in a GPU-less container (4 vCPU, 15 GB RAM): WebGL2 runs on ANGLE →
SwiftShader (CPU), so these are worst-case numbers. A machine with a GPU will be
much faster.

**720p previews** (full 600-frame render, `--concurrency=4`, includes encode):

| Composition | Wall time | Wall time per frame |
|---|---|---|
| CityHUD-SteelBlue | 204 s | 0.34 s |
| CityFlyover-Teal | 268 s | 0.45 s |
| CityFlyover-Amber | 261 s | 0.44 s |
| CityTracker-Teal | 155 s | 0.26 s |
| WorldConnections-Blue | 158 s | 0.26 s |
| WorldConnections-Gold | 158 s | 0.26 s |
| HUDGlobe-Teal | 192 s | 0.32 s |
| TopoContours-GreenOrange | 274 s | 0.46 s |
| TopoContours-IceBlue | 273 s | 0.45 s |

**Timed real 4K frames** (3840×2160, `--concurrency=1`, per-frame cost =
(time for 10 frames − time for 1 frame) / 9, which removes bundling/startup):

| Composition | 4K per frame | 720p per frame (same method) | Ratio |
|---|---|---|---|
| CityFlyover-Teal (2A) | 3.99 s | 0.63 s | 6.3× |
| HUDGlobe-Teal (5) | 2.27 s | 0.42 s | 5.4× |

**4K estimates** for a full 600-frame render on this kind of CPU-only machine
(720p wall time × ~6): City HUD ≈ 20 min, Flyover ≈ 27–28 min each, Tracker
≈ 16 min, World ≈ 16 min each, Globe ≈ 17 min, Topo ≈ 27 min each, so about
3.5 hours for all nine. On a workstation GPU expect well under a second per 4K
frame. First-frame start-up per tab is ~5–10 s (city generation and painting
the 8192² textures).

## Verification (as run here)

| Check | Result |
|---|---|
| 1. ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, 20.000 s | all 9 pass |
| 2. Loop: `loopCheck` (601 frames), frame 0 vs frame 600 pixel for pixel | all 9 identical |
| 3. Determinism: frame 300 as a cold single still vs frame 300 of a 4-tab PNG-sequence render (frames 280–319), byte for byte | all 9 identical |
| 4. Banding: frames decoded from the encoded mp4s, contrast-stretched crops and luma profiles across the deep blue (4), the globe background (5), the dark greens (6) and the blurred foreground/horizon (2) | smooth, no steps |
| 5. Contact sheets (5 evenly spaced frames) | all 9 show the required content |
| 6. Motion: consecutive-frame crops around frame 300; tracker path analysed exactly | no crawl/moiré; tracker dot accel ≤ 0.28 px/frame², map follow ≤ 0.07 px/frame² |

`scripts/check-loop-determinism.sh` runs checks 2–3 and `scripts/verify.py`
has the probe / sheet / banding / compare helpers.

### Banding check

Every look ends in a final pass that adds ±1/255 dither and a 1.5% grain that
is a pure function of pixel position and `frame % 600` (PCG hash in the
shader). Check it on the encoded file, not the preview:

```
python3 scripts/verify.py banding out/previews/WorldConnections_Blue.mp4 300 v:640:0:170 h:690:0:1280
```

It prints, per line, the largest jump of the smoothed luma profile and the
longest flat run; stepped gradients show as long flat runs followed by jumps.

## Completion checklist

- [x] 9 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] three.js on WebGL2 via `@remotion/three`; no PixiJS, no WebGPU
- [x] one procedural tileable city drives Looks 1–3; texture painted once
- [x] Natural Earth 110m land (public domain) for Looks 4–5; no names shown
- [x] procedural terrain for Look 6
- [x] OFL fonts only (JetBrains Mono, Inter) with licence texts
- [x] no `Math.random()`, no clock, no TAA/accumulation; frame-only animation
- [x] one data row per version (`src/versions.ts`)
- [x] 720p previews and stills; checks 1–6 pass

## Known differences from the references

These were flagged by the independent comparisons and left as they are,
because the brief asks for them or because matching would break another rule:

* **River and ring road (Looks 1–3).** The brief asks for a river (80–150 m,
  dark fill) and a ring-road arc; the reference clips show neither prominently.
  The river is at the narrow end (≈92 m) and the ring is a partial arc.
* **City scale (Looks 1–3).** The references show a larger city than a
  3 × 3 km tile can without visibly repeating. Blocks are smaller than
  real-world blocks (≈9–34 m) to reach a comparable street density; the
  comparisons still read the references as slightly more zoomed out.
* **Yellow accents (Look 1)** are in the brief; the reference has none.
* **Arcs (Look 4).** The brief asks for ~24 arcs with travelling pulses; the
  reference has a bundle of ~8–10 faint arcs. Arcs are kept faint and fan
  from the Americas eastward.
* **Globe position (Look 5)** is at (42%, 52%) as specified; the reference
  globe is nearer the centre.
* **Contour count (Look 6).** The brief asks for ~40 levels; the reference
  shows ~8–12 rings per hill. Low-lying levels are faded instead.

