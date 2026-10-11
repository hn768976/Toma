# Atlas Country Close-up — Remotion template (20 countries)

A macro close-up of a printed political atlas page on a desk. The camera rack-focuses
onto the country name, then slides slowly across the paper. The depth of field is
razor-thin. One template scene is driven by one data row per country
(`src/countries.json`), giving 20 compositions of **15 s, 30 fps, 3840×2160**.

- **Map:** drawn once per composition with **d3-geo on Canvas 2D** (`src/map/drawMap.ts`).
  - an **8192×8192** hi-res sheet around the country;
  - plus a 4096² low-res surround covering 2× the extent, for the heavily blurred far
    paper.
- **Scene:** **three.js via `@remotion/three` (WebGL2)** (`src/scene/`).
  - a slightly bowed, wavy paper sheet with a fibre normal map;
  - GGX roughness 0.75 with a soft sheen;
  - a warm window key light, a cool fill and a falloff across the page;
  - a single-frame **gather-pass depth of field**, then warm grade, vignette, grain and
    dither.

## Compositions

Remotion composition IDs may only contain `a-z A-Z 0-9 -`. So the IDs are
`CountryMap-<Name>`, and the output files are named `CountryMap_<Name>` as requested:

`USA, China, India, Japan, Germany, UK, France, Brazil, Canada, Russia, Mexico, Australia,
SouthKorea, Italy, Spain, Indonesia, SaudiArabia, Turkiye, Pakistan, SouthAfrica`

## Setup

```bash
npm install
npx remotion studio        # preview (renders at 0.5x density in the Studio for speed)
```

Node 18+ is required (tested with Node 22). `npm run build-data` regenerates
`public/data/*.json` from the bundled Natural Earth files. It is only needed after
adding or editing a row; the output is already included.

## Chromium GL flag

Always render with **`--gl=angle`** (WebGL2 through ANGLE, not WebGPU).
`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer('angle')`. With a
GPU, ANGLE uses it. Without one, Chromium falls back to SwiftShader inside ANGLE, which
is how the timings below were measured.

## Render commands

4K video, one per composition:

```bash
npx remotion render src/index.ts CountryMap-Mexico out/CountryMap_Mexico.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
# all 20:
for c in USA China India Japan Germany UK France Brazil Canada Russia Mexico Australia SouthKorea Italy Spain Indonesia SaudiArabia Turkiye Pakistan SouthAfrica; do
  npx remotion render src/index.ts CountryMap-$c out/CountryMap_$c.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
done
```

720p preview (1280×720 exactly, since 3840 / 3 = 1280):

```bash
npx remotion render src/index.ts CountryMap-Mexico out/CountryMap_Mexico_720p.mp4 --gl=angle --scale=0.3333333333333333 --crf=16
```

6K still (6000×3375, scale 1.5625):

```bash
npx remotion still src/index.ts CountryMap-Mexico out/CountryMap_Mexico_6K.png --frame=300 --scale=1.5625 --gl=angle
```

At scales above 1 the WebGL canvas renders at the composition's 3840 px density and
Chromium upscales the screenshot. For a true 6K render, change the `dpr` clamp in
`src/CountryMap.tsx`.

Batch helpers:
- `node scripts/render-stills.mjs [--frame=300] [--scale=…] [--ids=Mexico,USA]` renders
  one still per composition with one bundle, and logs the map-draw time.
- `node scripts/measure-frames.mjs` measures warm per-frame time.

Concurrency is 2 in `remotion.config.ts`. Each tab holds the 8192² canvas plus its
mipmapped texture, about 1 GB, so raise concurrency only if you have the RAM.

## Measured times

TIMINGS_PLACEHOLDER

## Banding check

Banding is most likely in the pale sea and the large out-of-focus areas.
- **Final pass:** `src/scene/shaders.ts` adds ±1/255 triangular dither and 1.5% grain,
  both from a fixed hash of pixel position and `frame % 450`.
- **The render target is half-float**, so the DoF gather and the grade never quantise
  before the final 8-bit write.

**Check, run on the encoded mp4, not the preview.** Frame 300 was decoded from
`CountryMap_Mexico.mp4` (H.264, CRF 16, yuv420p) and pixel values were read across the
blurred Pacific:
- a vertical profile (y 430–719 at x 60–90, 9-px smoothed) and a horizontal profile
  (y 690);
- values fall smoothly through the vignette and blur, with a largest smoothed step of
  1.4 levels and no flat run longer than 4 px;
- there are no visible bands, so grain stays at 1.5%. The brief allows up to 3% if a
  different encoder bands.

## Determinism

Every value on screen is a pure function of `useCurrentFrame()`:
- **Camera:** slide, yaw and rack focus come from `src/scene/cameraPath.ts`.
- **Grain and dither:** a fixed hash of pixel and `frame % 450`.
- **Seeded randomness:** paper grain, halftone, fibre and colour tie-breaks use
  `mulberry32` from module-level seeds (`src/rng.ts`).
- **Banned:** `Math.random()`, `Date.now()`, the R3F clock, TAA and state carried
  between frames. `useFrame` is only the render hook that `@remotion/three`'s
  `advance()` calls. It reads the Remotion frame from a ref.
- **Loading:** the data, fonts (`document.fonts.ready`) and both map canvases are
  finished behind `delayRender` before the `<ThreeCanvas>` mounts. The textures are
  uploaded with `gl.initTexture` only after the canvas is fully drawn.

**Self-check, done:**
- **Cold-start renders:** two separate cold-start renders of `CountryMap-Mexico` frame
  300 are **byte-identical**.
- **Mid-sequence render:** frame 300 rendered in a warm tab, after frames 290–299, is
  **byte-identical** to the cold-start frame 300.
- **Encoded preview:** decoded frame 300 of the H.264 preview matches the still at
  39.4 dB PSNR, against 38.5 dB for frames 299 and 301, which confirms the alignment.
  The remaining gap is lossy encoding of the grain.

## How to add a new country

1. **Add a row** to `src/countries.json`:

   | field | meaning |
   |---|---|
   | `id` | composition suffix (`CountryMap-<id>`) and data file name |
   | `iso` | Natural Earth `ADM0_A3` code of the featured country |
   | `label` | printed name, English, capitals |
   | `frame` | `[west, south, east, north]`: the lon/lat box the shot is framed on. The featured land inside it fills 55% of the texture width. |
   | `projectionCenter` | optional central meridian (default: frame centre). If it is set away from the frame, the sheet is turned so north is up at the frame centre (Russia: 100°E). |
   | `parallels` | optional standard parallels (default: 1/6 and 5/6 of the frame's latitude span) |
   | `fitTo` | `"country"` (default) or `"frame"` to fit the frame box itself |
   | `labelLonLat` | **label position override**. Default: the pole of inaccessibility of the largest projected polygon inside the frame. The camera always focuses on the name. |
   | `printArea` | optional `[w, s, e, n]` neatline. The print stops there and the sheet beyond is blank paper (used to keep Alaska out of the USA shot). |
   | `placeNames` | optional `{ "Natural Earth name": "printed name" \| null }` to rename or hide city labels |
   | `camera` | `start`/`end` offsets `[lateral, forward]` in frame widths, `yaw` `[start, end]` in degrees (±1.5), optional `baseYaw` |

2. Run `npm run build-data` (or `node scripts/build-data.mjs <id>` for one row). It cuts
   the Natural Earth layers to a window around the frame into `public/data/<id>.json`
   and computes the neighbour graph for the 4-colour fill.
3. Open the Studio. Then render frame 300 and check the label placement, the visible
   window and that no overlaps appear. Adjust `labelLonLat`, `camera` and `placeNames`
   as needed.

## Data and licences

**Natural Earth.** All map data comes from Natural Earth (naturalearthdata.com), 1:10m
scale: admin-0 countries, populated places, roads, rivers and lake centrelines, lakes,
and admin-0 disputed-area boundary lines. *Made with Natural Earth. Free vector and
raster map data @ naturalearthdata.com.* Natural Earth is in the **public domain**.
- The original GeoJSON files are in `data/raw/`, taken from the
  `nvkelso/natural-earth-vector` repository.
- The per-country files in `public/data/` are derived from them, with coordinates
  rounded to 1e-4°.
- Disputed boundary lines are drawn **dashed**. Natural Earth's "Indeterminate"
  territories (e.g. Siachen Glacier) are filled neutral grey `#E4E0D8`.
- Country fills follow Natural Earth's default (de facto) polygons.
- One Natural Earth error is corrected by a label override: the Mexican place "Juarez"
  at 23.22°N 106.42°W is Mazatlán.

**Fonts.** Source Sans 3 (Regular, Semibold, Bold) by Adobe, under the **SIL Open Font
License 1.1**. The font files and their licence are in `public/fonts/` (`LICENSE.md`).

No logos, publisher names, legends or copyright lines appear on the map, and all place
names are in English.

## Completion checklist

CHECKLIST_PLACEHOLDER
