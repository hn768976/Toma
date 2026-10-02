# Keyword Globe · Circuit Tree · Market Dashboard · Blockchain Panels · Blockchain Build

One Remotion project with five looks and seven compositions. Everything is
drawn in code: no MCP servers, no icon libraries, no logos or brands, no real
tickers. All compositions are defined at **3840×2160, 30 fps**.

| Composition id | Look | 2D/3D | Frames | Notes |
|---|---|---|---|---|
| `KeywordGlobe-TechBlue` | Keyword Globe | 3D (three.js) | 600 | loop |
| `KeywordGlobe-BusinessGold` | Keyword Globe | 3D | 600 | loop, business keywords |
| `CircuitTree-Blue` | Circuit Tree | 2D (SVG) | 600 | grows 0–240, then a hold that loops (240 ≡ 600) |
| `CircuitTree-EcoGreen` | Circuit Tree | 2D | 600 | same tree, green palette with more leaves |
| `MarketDashboard` | Market Dashboard | 2.5D (CSS 3D) | 600 | loop |
| `BlockchainPanels-IceBlue` | Blockchain Panels | 3D | 600 | loop |
| `BlockchainBuild-Teal` | Blockchain Build | 3D | 450 | not a loop |

## Setup

```bash
npm install
npx remotion studio
```

Node 18+ is needed. Dependency versions are pinned exactly in `package.json`.

### Chromium GL flag

The three.js looks need **WebGL2** through ANGLE. `remotion.config.ts` already
sets `Config.setChromiumOpenGlRenderer("angle")`. On the command line, use:

```
--gl=angle
```

On a machine without a GPU, ANGLE falls back to SwiftShader (software). That
works but is slow (see the timings below).

If your CI image can't download Remotion's headless browser, point it at an
existing one: `REMOTION_BROWSER_EXECUTABLE=/path/to/headless_shell`.

## 4K render commands

```bash
npx remotion render KeywordGlobe-TechBlue      out/KeywordGlobe_TechBlue.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render KeywordGlobe-BusinessGold  out/KeywordGlobe_BusinessGold.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CircuitTree-Blue           out/CircuitTree_Blue.mp4           --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CircuitTree-EcoGreen       out/CircuitTree_EcoGreen.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render MarketDashboard            out/MarketDashboard.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render BlockchainPanels-IceBlue   out/BlockchainPanels_IceBlue.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render BlockchainBuild-Teal       out/BlockchainBuild_Teal.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

You can also use ProRes for mastering: `--codec=prores --prores-profile=4444`.
PNG is already the intermediate image format (set in `remotion.config.ts`), so
JPEG compression never adds banding to the gradients.

## Stills

There are two stills per composition at **6000×3375** (scale 6000 / 3840 = 1.5625):

```bash
npx remotion still KeywordGlobe-TechBlue out/stills/globe_60.png --frame=60 --scale=1.5625 --image-format=png --gl=angle
# all 14 stills at once:
scripts/stills.sh
```

| Composition | Still frames |
|---|---|
| KeywordGlobe-* | 60, 360 |
| CircuitTree-* | 120 (mid-growth), 450 (full tree) |
| MarketDashboard | 90, 400 |
| BlockchainPanels-IceBlue | 60, 380 |
| BlockchainBuild-Teal | 100 (assembling), 440 (full chain) |

## 720p previews

```bash
scripts/render-previews.sh            # all seven, or pass composition ids
```

This renders each composition with `--scale=0.3333333333333333`, which gives
exactly 1280×720, to a PNG sequence. ffmpeg then encodes the sequence to
H.264 / yuv420p / CRF 16 / 30 fps with no audio. Keeping the PNG sequence means
any single frame can be compared byte for byte with a separately rendered still.

## Render time per frame

Measured in the build container: 4 vCPU, **no GPU**. WebGL ran on ANGLE →
SwiftShader (software). Each figure is wall-clock time for the whole render
(PNG frames, concurrency 4) divided by the frame count. The ~10 s of bundling
and browser start-up is included.

| Look | 720p measured (s/frame) | 4K measured, 8-frame sample (s/frame) | 4K full composition, same machine |
|---|---|---|---|
| Keyword Globe (TechBlue / BusinessGold) | 1.37 / 1.39 | ≈ 8.6 | ≈ 86 min each |
| Circuit Tree (Blue / EcoGreen) | 0.20 / 0.21 | ≤ 1.5 (sample was dominated by start-up) | ≈ 5–15 min each |
| Market Dashboard | 0.84 | ≈ 4.5 | ≈ 45 min |
| Blockchain Panels | 0.89 | ≈ 9.2 | ≈ 92 min |
| Blockchain Build (450 frames) | 0.92 | ≈ 10.8 | ≈ 81 min |

The 4K rate for the three WebGL looks is about 6–8× the 720p rate (9× the
pixels). Concurrency did not help here: every tab shares one software-GL GPU
process, and 1 vs 4 tabs measured the same. On a machine with a real GPU and
`--gl=angle`, expect the WebGL looks to be several times faster. The 2D looks
scale with CPU cores.

## Adding a version (one data row)

All versions live in `src/versions.ts`. `Root.tsx` registers one composition
per row, so you only add a row:

```ts
// src/versions.ts
export const GLOBE_VERSIONS: GlobeVersion[] = [
  ...,
  {
    id: "KeywordGlobe-HealthTeal",   // composition id
    primary: "#2FD0C0", accent: "#9FFFF0", tag: "#F0FFFC",
    bgCenter: "#06343A", bgEdge: "#010A0E", exposure: 0.95,
    keywords: ["HEALTH", "CARE", "GENOMICS", "TELEMEDICINE", "AI", "DATA", "BIOTECH", "WELLNESS", "RESEARCH", "LABS"],
  },
];
```

The other tables work the same way: `TREE_VERSIONS` (trace, pad and canopy
colours, icon-shape weights), `MARKET_VERSIONS`, `PANELS_VERSIONS` and
`BUILD_VERSIONS`. For the output file name used by the preview script, add the
id to the `NAME` map in `scripts/render-previews.sh`.

## Determinism

Remotion renders frames out of order across several tabs. Every value on screen
is a pure function of `useCurrentFrame()`:

- Seeded `mulberry32` / stateless hashes at module level. There is no `Math.random()`.
- No CSS `@keyframes` or transitions, no R3F clock, no `Date.now()`, and no
  `useState` driving visuals. State is used only to gate loading.
- No TAA and no temporal effects. The post chain (bloom, depth of field, grain,
  dither) is recomputed from scratch every frame.
- Fonts (`public/fonts`, OFL) and Natural Earth data (`public/data`, public
  domain) load behind `delayRender` / `continueRender`.
- Each loop is built from whole numbers of cycles:
  - **Globe:** turns once per loop. Rings turn ±1 or ±2 times. Tags orbit once.
    Streaks run on periods of 150, 200, 300 or 600 frames.
  - **Panels:** the camera glides exactly 4 cells. Each cube turns once, and the
    cube and arrow phases repeat every 4 cells.
  - **Dashboard:** the camera glides exactly one repeating panel unit. Candles
    scroll exactly one 48-candle data period. Heatmap and table values change
    on periods that divide 600.
  - **Circuit Tree:** the hold uses whole cycles over 360 frames, keyed on `f − 240`.
- Grain is a fixed hash of (pixel x, pixel y, loop frame). It is about 2%. The
  WebGL looks add a ±1/255 triangular dither after bloom.

## Verification

```bash
python3 scripts/verify.py probe        # Step 1 ffprobe
python3 scripts/verify.py loop         # Step 2 loop frames (renders with --props '{"loopCheck":true}' → 601 frames)
python3 scripts/verify.py determinism  # Step 3 cold frame 150 vs frame 150 of the full render, md5
python3 scripts/verify.py banding      # Step 4 pixel profiles read from the encoded mp4
python3 scripts/verify.py contact      # Step 5 five evenly spaced frames per preview
```

### Results of the verification loop (720p previews)

| Check | Result |
|---|---|
| 1. ffprobe | **PASS**, all 7: 1280×720, 30/1, h264, yuv420p, no audio. 20.000 s each, BlockchainBuild 15.000 s. |
| 2. Loop | **PASS**, all 6 loops: frame 0 ≡ 600 (looks 1, 3, 4) and 240 ≡ 600 (look 2) are identical pixel for pixel (max diff 0). |
| 3. Determinism | **PASS**, all 7: a cold-start frame 150 is byte-identical (md5) to frame 150 of the full render. The dashboard was also checked at frames 37 and 421, and a frame rendered from a fresh `npm install` copy matched too. |
| 4. Banding | **PASS**: 1A, 2A, 3 and 4 were read from the encoded mp4 luma plane. The longest run of identical values in smooth glow/gradient regions is 12–23 px, below the 32 px limit. Profiles through the globe beam glow rise smoothly (68 → 246 → 77). |
| 5. Content | **PASS**: checked on five evenly spaced frames per preview (`out/check/*-contact.png`). |

### Banding check (method)

Grain is about 2% and comes from a fixed hash of (x, y, frame), so a smooth
area should never contain long runs of one value. `verify.py banding` decodes
frame 150 of the mp4 to raw luma. It masks smooth regions (low 15×15 gradient,
not clipped) and reports the longest identical-value run, plus raw and smoothed
profiles across a glow or gradient. Steps would show as long flat runs and
jumps in the smoothed profile.

## Completion checklist

- [x] 7 compositions, 3840×2160 / 30 fps, lengths 600 (450 for Blockchain Build)
- [x] Built entirely in code, no MCP servers. Icons are self-drawn SVG. No logos, brands, coin names or real tickers (invented codes `IDX-01`, `SEC-A`, `FND-7`…)
- [x] Fonts shipped (Inter, JetBrains Mono, Montserrat, OFL). Natural Earth shipped (public domain). Both load behind `delayRender`.
- [x] 2D looks: no CSS `@keyframes` or transitions. Every value comes from `useCurrentFrame()`. The tree uses no filters; the dashboard's depth of field is a masked `backdrop-filter`, verified deterministic.
- [x] `@remotion/three` with WebGL2 and ANGLE (`--gl=angle`). No WebGPU, no TAA.
- [x] Dither ±1/255 after bloom (looks 1, 4, 5). 2% hash grain in all looks. No `Math.random()`.
- [x] Loops whole-cycle and verified, frame 150 byte-identical, banding checked on the encoded mp4
- [x] One data row per version (`src/versions.ts`)
- [x] 720p previews and a 720p still for each composition. Two 6000×3375 stills per composition.
- [x] Render time per frame measured at 720p, with a 4K estimate
- [x] `npm install && npx remotion studio` works from a clean copy

## Notes and fixes made during verification

- **Blockchain Build:** where the glass pieces stack (corner seams), the shader
  produced extreme HDR values. Bloom spread them into white discs. Fixed by
  clamping each glass fragment's output. A separate bug let the board glow
  multiply the red lights; the glow is now modulated by the trace texture only.
- **Circuit Tree:** some canopy icons were still fading in at frame 240, so 240
  and 600 differed. All growth now settles by frame 220. The glow used CSS
  `filter: blur()`, which Chromium could rasterise differently depending on
  earlier frames (frame 150 differed by up to 26/255). It is now built from
  stacked translucent strokes and radial gradients, with no filters.
- **Market Dashboard:** text and paths inside the perspective-transformed wall
  could hit Chromium raster caches built at a slightly different transform
  (≤ 2/255 on a few pixels). The wall now has its own compositing layer
  (`will-change: transform`), so it rasterises flat at a fixed scale.
- **Grain in 2D looks:** it is added with `plus-lighter`, so it only lifts
  values (mean about +1%). The WebGL looks use symmetric grain.

## Licences

- Inter, JetBrains Mono and Montserrat are under the SIL Open Font License 1.1.
  See `public/fonts/OFL-*.txt`.
- Natural Earth 1:50m land is public domain. See `public/data/LICENSE-NaturalEarth.txt`.
