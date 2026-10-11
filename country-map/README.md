# Atlas Country Close-up — Remotion template (33 countries)

A macro close-up of a printed political atlas page on a desk. The camera rack-focuses
onto the country name, then slides slowly across the paper. The depth of field is
razor-thin. One template scene is driven by one data row per country
(`src/countries.json`), giving 33 compositions of **15 s, 30 fps, 3840×2160**.

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

1. **Original 20, all rendered and verified:** `USA, China, India, Japan, Germany, UK,
   France, Brazil, Canada, Russia, Mexico, Australia, SouthKorea, Italy, Spain,
   Indonesia, SaudiArabia, Turkiye, Pakistan, SouthAfrica`.
2. **Added later as data rows, not yet rendered or visually checked:** `Ukraine,
   Israel, Iran, Egypt, UAE, Nigeria, Argentina, Netherlands, Switzerland, Poland,
   Vietnam, Thailand, Philippines`.
   - Their `public/data` files are built.
   - Before shipping them, render frame 300 of each and check the label placement and
     the `zoom`, `camera` and `labelLonLat` values. See "How to add a new country".
   - The Israel row shows the Palestinian territories in neutral grey (Natural Earth
     "Indeterminate").
   - The Philippines name is placed over the Sibuyan Sea (`labelLonLat`).

## Setup

```bash
npm install
npx remotion studio        # preview; the Studio renders at 0.5x density for speed
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
for c in USA China India Japan Germany UK France Brazil Canada Russia Mexico Australia SouthKorea Italy Spain Indonesia SaudiArabia Turkiye Pakistan SouthAfrica \
         Ukraine Israel Iran Egypt UAE Nigeria Argentina Netherlands Switzerland Poland Vietnam Thailand Philippines; do
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

**Machine:** a 4-vCPU cloud container with **no GPU**, so WebGL ran on SwiftShader (CPU)
through ANGLE. Chromium headless shell 1194, Remotion 4.0.515.
- **Per-frame time** is the average over 10 consecutive frames (300–309) in a warm tab,
  with the map already drawn.
- **Map draw** is the one-time d3-geo Canvas drawing per tab: both canvases, labels and
  colouring. Loading data and fonts adds another 0.1–1.3 s, and uploading and
  mipmapping the textures adds roughly 10 s on SwiftShader.

| composition | 720p per frame | map draw (once per tab) | 720p video, 1 tab (est.) |
|---|---|---|---|
| `CountryMap-USA` | 3.15 s | 8.5 s | 24 min |
| `CountryMap-China` | 3.24 s | 9.8 s | 24 min |
| `CountryMap-India` | 3.17 s | 5.4 s | 24 min |
| `CountryMap-Japan` | 3.24 s | 2.8 s | 24 min |
| `CountryMap-Germany` | 3.33 s | 3.1 s | 25 min |
| `CountryMap-UK` | 3.20 s | 3.2 s | 24 min |
| `CountryMap-France` | 3.35 s | 3.6 s | 25 min |
| `CountryMap-Brazil` | 3.34 s | 6.3 s | 25 min |
| `CountryMap-Canada` | 3.31 s | 12.6 s | 25 min |
| `CountryMap-Russia` | 3.36 s | 7.4 s | 25 min |
| `CountryMap-Mexico` | 2.98 s | 6.1 s | 22 min |
| `CountryMap-Australia` | 3.10 s | 5.5 s | 23 min |
| `CountryMap-SouthKorea` | 3.15 s | 2.5 s | 24 min |
| `CountryMap-Italy` | 3.12 s | 3.6 s | 23 min |
| `CountryMap-Spain` | 3.07 s | 2.9 s | 23 min |
| `CountryMap-Indonesia` | 3.11 s | 4.2 s | 23 min |
| `CountryMap-SaudiArabia` | 3.25 s | 4.2 s | 24 min |
| `CountryMap-Turkiye` | 2.89 s | 4.7 s | 22 min |
| `CountryMap-Pakistan` | 2.90 s | 3.0 s | 22 min |
| `CountryMap-SouthAfrica` | 2.88 s | 2.1 s | 22 min |

**One real 4K frame of Mexico (3840×2160), timed:**
- **warm:** 22.2 s per frame;
- **cold:** 64 s for the first frame, which includes page load,
  the 6.5 s map draw and the texture upload.

**4K estimates:**
- **This CPU-only box:** about 22 s × 450 ≈ **2.8 h per composition per tab**, and about
  1.5–2 h at concurrency 2.
- **A GPU machine (estimate, not measured):** the DoF gather (64 taps) and an 8192²
  anisotropic texture are trivial for any discrete GPU. Per-frame time there is bound by
  Chromium's 4K screenshot and PNG encode, typically **0.5–1.5 s per frame**, so about
  **4–12 min per composition**, plus about 10 s of map drawing per tab.

**Measured preview:** the 720p Mexico preview took **24 min** for 450 frames at
concurrency 2.

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

## Deviations from the brief (and why)

- **Camera at 32° instead of about 25°.** The reference is visibly steeper. At 25° the
  lettering was squashed and Mexico's Pacific coast ran much flatter than in the
  reference. Set in `CAMERA_ELEVATION` in `src/scene/cameraPath.ts`; the FOV is still
  22°.
- **Country-name size 2.4% of the texture width instead of 4.5%.** At 4.5% the name
  spanned about 29% of the frame against about 17% in the reference, and the sub-agent
  comparison ranked this high. It is now about 20% of the frame width.
- **Per-row `zoom`.** After matching the reference's tight Mexico shot, compact
  countries (Germany, South Korea, Spain…) filled the whole frame with no neighbours
  visible. Each row can pull the camera back; label sizes scale with it so they look
  the same on screen. The country still fills 55% of the texture width.
- **Sharp band.** CoC is exactly 0 inside the band (8% of frame height) and ramps up
  outside it. City labels inside the band are therefore crisp at 4K, not just at 720p.
  Nearer paper (bottom of frame) blurs at 0.7× the rate of farther paper, as in the
  reference.
- **Kept per the brief despite the reference:**
  - small dark city dots, where the reference has red circles;
  - spec fill colours, where the reference's land is paler and the US has a relief tint;
  - no second-language country label.
- **Composition IDs** use `-` (`CountryMap-Mexico`), because Remotion rejects `_`.
  Output files keep the `CountryMap_Mexico` names.

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

Verify loop as run in the build session. At the user's request, only **one** 720p
preview video was rendered (Mexico), plus one 720p still per composition (frame 300 =
10 s) and the Mexico 4K label crop.

- [x] **Basic file checks (step 1)**, on the Mexico preview: 1280×720, 30/1, 15.000 s,
  450 frames, h264, yuv420p, no audio. The first attempt carried a silent AAC track and
  was re-rendered with `--muted`.
- [x] **Rack focus and motion (step 2):**
  - at frame 0 the name is soft and focus is on the paper in front of it; it is sharp
    from frame 90 (3 s);
  - name-region sharpness (mean absolute Laplacian, 720p) is 6.3 at frame 0 and 16.9 at
    frame 90;
  - the slide is continuous to frame 449, as the five-frame contact sheets of all 20
    show.
- [x] **Same result every time (step 3):** the cold frame 300 is byte-identical to a
  second cold render and to frame 300 rendered warm in sequence. The mp4 frame 300 is
  aligned (best PSNR).
- [x] **Banding (step 4):** read from the encoded mp4; values change smoothly and grain
  stays at 1.5%.
- [x] **Per-composition contact sheets (step 5)**, five frames each for all 20:
  - the featured country is peach with its English name in bold capitals;
  - neighbours have distinct colours: an automatic audit logs 0 touching same-colour
    pairs for all 20, and no light orange next to the featured country;
  - the graticule, roads, rivers, city dots and capital marker are present;
  - disputed lines are dashed;
  - there are no overlapping labels, because of the collision pass;
  - the DoF band is shallow;
  - there are no legends, logos or publisher text.
- [x] **Motion smoothness (step 6)**, on frames 30–89 and 240–299 for Mexico (from the
  mp4), USA and Japan:
  - phase-correlation shifts are steady at 0.08–0.25 px/frame at 720p;
  - the largest frame-to-frame change is ≤ 0.044 px, so there is no judder;
  - the motion-compensated residual stays at the grain floor, so there is no shimmer or
    crawl (`scripts/motion-check.py`).
- [x] **Reference look, self-check (step 7)**, against `refs/994845492.mp4`.
- [x] **Reference comparison by fresh sub-agents (step 8)**, three rounds. See the build
  report.
- [x] **Geography check by fresh sub-agents.** All 20 were identified correctly in every
  round, and the flagged items were fixed.
- [x] **Texture sharpness:** the 4K crop of the sharp band shows crisp city labels
  (Torreón, Monterrey, San Luis Potosí, Tepic). 8192 is enough at this zoom: about 1.6
  texels per 4K pixel horizontally at the focus plane.
- [x] **Render times measured** (above). No 4K videos were rendered here.
- [x] **Clean copy:** `npm install && npx remotion studio` checked from an extracted zip.
