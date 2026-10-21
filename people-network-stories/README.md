# People Network Stories

Twelve Remotion compositions about people and networks: flat pictogram people appear, link up
and build into bigger shapes (a tree, a crowd, a world map, a grid, a light bulb, a platform, a
title). Every clip is a build-up story ending on a 2-second hold. 30 fps, 16:9, defined at
3840×2160.

| Composition ID | Output file | Length | Background | Engine |
|---|---|---|---|---|
| `BranchingTree-Red` | `BranchingTree_Red.mp4` | 30 s | light | three.js |
| `BranchingTree-Cyan` | `BranchingTree_Cyan.mp4` | 30 s | black | three.js |
| `PeopleLinkUp-Flip` | `PeopleLinkUp_Flip.mp4` | 30 s | light → black at 15 s | three.js |
| `SocialCluster-Red` | `SocialCluster_Red.mp4` | 20 s | light | three.js |
| `SocialCluster-White` | `SocialCluster_White.mp4` | 20 s | black | three.js |
| `PeopleWorldMap-Red` | `PeopleWorldMap_Red.mp4` | 15 s | light | PixiJS 8 |
| `PeopleWorldMap-Cyan` | `PeopleWorldMap_Cyan.mp4` | 15 s | black | PixiJS 8 |
| `PeopleGrid-Cyan` | `PeopleGrid_Cyan.mp4` | 25 s | black | PixiJS 8 |
| `PeopleBulb-White` | `PeopleBulb_White.mp4` | 24 s | black | three.js |
| `CrowdPlatform-Blue` | `CrowdPlatform_Blue.mp4` | 30 s | black | three.js |
| `BigDataCrowd-Title` | `BigDataCrowd_Title.mp4` | 18 s | light | three.js |
| `BigDataCrowd-Clean` | `BigDataCrowd_Clean.mp4` | 18 s | light | three.js |

Remotion does not allow `_` in composition IDs, so the IDs use `-`; pass the underscore name as
the output file.

## Setup

```bash
npm ci            # Node 18+; versions are pinned in package.json / package-lock.json
npm run studio    # preview in Remotion Studio
```

## Rendering

All scenes need WebGL2, so always pass `--gl=angle`. On a machine with a GPU, ANGLE uses it; on
a headless server it falls back to SwiftShader (CPU), which works but is slower (times below).

**4K (final):**

```bash
npx remotion render src/index.ts BranchingTree-Red out/BranchingTree_Red.mp4 \
  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709 --image-format=png --muted
```

Repeat with each composition ID from the table, or render all twelve:

```bash
for id in BranchingTree-Red BranchingTree-Cyan PeopleLinkUp-Flip SocialCluster-Red \
  SocialCluster-White PeopleWorldMap-Red PeopleWorldMap-Cyan PeopleGrid-Cyan PeopleBulb-White \
  CrowdPlatform-Blue BigDataCrowd-Title BigDataCrowd-Clean; do
  npx remotion render src/index.ts "$id" "out/${id/-/_}.mp4" --gl=angle \
    --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709 --image-format=png --muted
done
```

`--color-space=bt709` (also the default in `remotion.config.ts`) tags the file as BT.709 and
converts with accurate rounding, so `#FBFBFA` decodes back to within 1 of itself and black stays
(0,0,0).

For ProRes masters, swap the codec flags for `--codec=prores --prores-profile=4444`.

**720p previews:** `scripts/render-previews.sh` (adds `--scale=0.3333333333333333`). The GL
canvases render at the scaled size directly, so previews don't pay for 4K. All sizes (line widths,
dot sizes, glow radius, icon sizes) are defined relative to the frame, so the 4K render is the
same picture with more detail.

If Remotion can't download its headless Chrome (offline machines), point it at a local
Chromium with `--browser-executable=/path/to/chrome-headless-shell`.

## Changing things: one data row each

Everything a buyer would want to change lives in `data/`. Edit, save, re-render.

**Title (Big Data):** `data/title.json`

```json
{ "text": "BIG DATA" }
```

Any word or short phrase works: the particles re-form into it, and long words are fitted to the
same width. The font is Archivo Black (OFL, in `public/fonts`).

**Colours:** `data/colors.json` (hex, used exactly as written: no colour-space conversion)

| Row | Used for |
|---|---|
| `red` / `redSide` | red people (front face / extruded side face), red tree, red map |
| `white` / `whiteSide` | white people (Link-Up dark half, Social Cluster White, Bulb) |
| `cyan` | cyan tree, cyan map, people grid |
| `blue` / `blueSide` | Crowd Platform people |
| `lightBackground` | `#FBFBFA` light clips |
| `darkBackground` | `#000000` dark clips (keep pure black for Screen mode) |
| `greyLine` | links in the dark Link-Up half and Social Cluster |
| `paleRedLine` | links in the light Link-Up half |
| `floorGrid` | Big Data floor grid |

**People counts:** `data/counts.json`

| Row | Default | Clip |
|---|---|---|
| `branchingTreeTips` | 6000 | Branching Tree (number of tips, approximate) |
| `peopleLinkUpPeople` | 1200 | People Link-Up (per half) |
| `socialClusterPeople` | 1500 | Social Cluster |
| `worldMapPeople` | 9000 | World Map |
| `worldMapIconHeight` | 0.022 | World Map icon height, as a fraction of frame height |
| `peopleGridColumns` / `peopleGridRows` | 48 / 22 | People Grid |
| `peopleBulbPeople` | 2500 | People Bulb (rounded to whole rows of 62) |
| `crowdPlatformSize` | 30 | Crowd Platform (grid is size × size people) |
| `bigDataCrowdPeople` | 5000 | Big Data crowd |

The timings stay the same when counts change; only the density does.

## Blend modes

- **Dark clips** (`BranchingTree_Cyan`, `SocialCluster_White`, `PeopleWorldMap_Cyan`,
  `PeopleGrid_Cyan`, `PeopleBulb_White`, `CrowdPlatform_Blue`, and the second half of
  `PeopleLinkUp_Flip`): the background is exactly (0,0,0), so use **Screen** (or Add/Lighten)
  to drop them over footage. Glows are tight and never lift the black.
- **Light clips** (`BranchingTree_Red`, `SocialCluster_Red`, `PeopleWorldMap_Red`,
  `BigDataCrowd_Title`, `BigDataCrowd_Clean`, first half of `PeopleLinkUp_Flip`): flat `#FBFBFA`.
  Use **Normal** over a slide, or **Multiply** to drop the off-white.

## Timings

| Clip | Story |
|---|---|
| Branching Tree (30 s) | 0–2 trunk rises · 2–8 first splits, sparse and readable · 8–24 crown fills · 24–28 thickens to a dense mass · 28–30 hold. Camera orbits ~40° and pulls back. |
| People Link-Up Flip (30 s) | 0–2 one red person linked to 3 dots · 2–13 crowd builds to ~1,200, camera pulls back · 13–15 fast pull-back to a dense column · 15 hard cut to black · 15–28 same build in white · 28–30 hold. |
| Social Cluster (20 s) | 0–3 ~40 scattered people · 3–9 hubs fire bursts of links, more people · 9–18 camera pulls back and turns, crowd gathers into an elongated cloud of ~1,500 · 18–20 hold with very slight drift. |
| People World Map (15 s) | 0–2 empty · 2–5 a few dozen pop in · 5–12 faster and faster · 12–13 last gaps · 13–15 hold. Each icon does a 3-frame drop. |
| People Grid (25 s) | 0–5 single people light up · 5–14 more, light streaks begin · 14–19 streaks multiply to a bright criss-cross · 19–20 flash clears · 20–25 full, even grid, hold. |
| People Bulb (24 s) | 0–8 inside the dotted surface, first people and streaks · 8–14 more, camera pulls back through the surface · 14–20 bulb revealed, ~2,500 people · 20–22 lights up · 22–24 hold. |
| Crowd Platform (30 s) | 0–5 a row of people linked by hopping arcs · 5–20 rows and columns, layered platform, camera rises to ~35° · 20–28 spreads to the edges, arcs become a fine mesh · 28–30 hold. |
| Big Data Crowd (18 s) | 0–5 eye level in the crowd, data streams overhead · 5–12 camera rises and tilts down · 8–13 streams converge into the title (Title) or a soft web (Clean) · 16–18 hold. |

## How it's built

- `src/lib/three/Stage.tsx`: `@remotion/three` canvas with a small fixed pipeline: the scene is
  drawn into a 4× MSAA **half-float** target, optionally gets a tight two-level glow, and a final
  pass adds ±1/255 dither **only where the pixel is more than 2% away from the background**, so
  black stays exactly 0 and the light background stays flat.
- `src/lib/three/people.ts`: the pictogram (`src/lib/pictogram.ts`) extruded to 15% of its width,
  flat-shaded front/side colours, drawn as `InstancedMesh`es (male and female).
- `src/lib/three/lines.ts`: links as instanced screen-space quads. Native `LineSegments` are
  always 1 device pixel wide, which would make the 4K render three times thinner than the
  preview; these keep their width relative to the frame and are anti-aliased.
- `src/lib/pixi/PixiStage.tsx`: PixiJS 8 (WebGL2) into an `rgba16float` render texture, then the
  same dither pass. Icons are pre-rendered once into mipmapped textures.
- Determinism: every visual is a function of `useCurrentFrame()`. All random data (tree, people
  positions, links, arrival order, streaks) is generated once from seeded `mulberry32`; no
  `Math.random()`, `Date.now()`, `useFrame` or temporal effects. Fonts and land data load behind
  `delayRender`.
- Land shape: Natural Earth 110m land (public domain, via `world-atlas`), converted by
  `scripts/build-land.mjs` into `public/land-110m.json`; equirectangular projection (standard
  parallel 31°), Antarctica left out.

## Licences

Fonts: Archivo Black and IBM Plex Mono, SIL Open Font License (`public/fonts/*-OFL.txt`).
Map data: Natural Earth, public domain.
