# Periodic Table Scenes, Data Panels, Data Tower

One Remotion project, **5 looks → 8 compositions**, rendered with **three.js on
WebGL2** through `@remotion/three`. 30 fps, 16:9, defined at **3840×2160**.

| Composition id | Output name | Look | Length |
|---|---|---|---|
| `DataPanels-Blue` | `DataPanels_Blue` | 1 · Data Panels (layered glass panels, number grids, world map) | 20 s seamless loop (600 f) |
| `DataTower-Blue` | `DataTower_Blue` | 2 · Data Tower (twisting stack of wireframe data boxes on a pixel-dot field) | 20 s loop |
| `ElementGrid-Grey` | `ElementGrid_Grey` | 3A · Element Grid, grey | 20 s loop |
| `ElementGrid-IceBlue` | `ElementGrid_IceBlue` | 3B · Element Grid, ice blue | 20 s loop |
| `TableAssemble-Light` | `TableAssemble_Light` | 4A · Table Assemble, light | 15 s story (450 f) |
| `TableAssemble-Dark` | `TableAssemble_Dark` | 4B · Table Assemble, dark | 15 s story |
| `TableFlyover-Blue` | `TableFlyover_Blue` | 5A · Table Flyover, blue | 20 s loop |
| `TableFlyover-DarkGold` | `TableFlyover_DarkGold` | 5B · Table Flyover, dark gold | 20 s loop |

(Remotion composition ids may not contain `_`, so the ids use `-`; the file
names use `_` as requested.)

## Quick start

```bash
npm install
npx remotion studio          # or: npm run studio
```

Node 18+ (built and tested with Node 22). All versions in `package.json` are
pinned. The Studio preview draws at half resolution to stay responsive;
renders always draw at exactly the requested output size.

### Chromium GL flag

WebGL2 runs through **ANGLE**: `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, i.e. the CLI flag **`--gl=angle`**.
Pass `--gl=angle` explicitly if you render through the Node APIs (they do not
read `remotion.config.ts`). On a machine without a GPU, ANGLE falls back to
SwiftShader, which is what produced the timings below.

## 4K render commands

H.264, yuv420p, CRF 16, 3840×2160:

```bash
npx remotion render DataPanels-Blue       out/DataPanels_Blue.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render DataTower-Blue        out/DataTower_Blue.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render ElementGrid-Grey      out/ElementGrid_Grey.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render ElementGrid-IceBlue   out/ElementGrid_IceBlue.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render TableAssemble-Light   out/TableAssemble_Light.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render TableAssemble-Dark    out/TableAssemble_Dark.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render TableFlyover-Blue     out/TableFlyover_Blue.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render TableFlyover-DarkGold out/TableFlyover_DarkGold.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

720p previews (what was rendered here): add `--scale=0.3333333333333333`
(3840/3 = 1280 exactly). The previews in this delivery were rendered as a PNG
sequence and encoded with ffmpeg (`scripts/verify/render_preview.sh`), so the
full render's frames could be compared byte for byte with cold-start stills.

### 6K still (6000×3375)

`--scale=1.5625` turns 3840×2160 into exactly 6000×3375. For example, the
finished table:

```bash
npx remotion still TableAssemble-Light out/TableAssemble_Light_6K.png --frame=390 --scale=1.5625 --gl=angle
```

(Any composition and frame works the same way. 6K stills were not rendered here.)

## Project layout

```
data/elements.csv            118 elements (generated, checked)
data/sources/                saved sources + notes (README.md)
public/fonts/                Inter + JetBrains Mono (woff2) + OFL licence texts
public/geo/                  Natural Earth 1:110m land + public-domain note
scripts/build-elements.mjs   builds data/elements.csv from data/sources
scripts/check-elements.mjs   element data check (npm run data:check)
scripts/fitcheck.sh          tile fit check for every atlas (npm run fitcheck)
scripts/verify/              render + verification helpers used for this delivery
src/versions.ts              ONE DATA ROW PER VERSION (colourways)
src/Root.tsx                 registers every row as a composition
src/lib/                     pipeline (post FX), stage, atlas, tiles, data, assets
src/looks/                   the five looks
```

## Element data

- 118 rows, Z 1–118. Masses are CIAAW/IUPAC abridged standard atomic weights
  (H 1.008, C 12.011, Ca 40.078, Zn 65.38, Au 196.97, U 238.03). Elements with
  no stable isotopes show the longest-lived mass number in brackets (Tc [98],
  Og [294]).
- Current IUPAC names: Rg Roentgenium, Cn Copernicium, Nh Nihonium,
  Fl Flerovium, Mc Moscovium, Lv Livermorium, Ts Tennessine, Og Oganesson. No
  placeholder names (Uuu, Uub, …) anywhere.
- IUPAC spelling by default (Aluminium, Caesium). **US spelling: change one line
  in `src/config.ts`** (`SPELLING = "US"`).
- Standard 18-column layout; lanthanides (57–71) and actinides (89–103) in two
  rows below, starting under group 3; group 3 of periods 6–7 empty on the main
  table.
- `npm run data:build` regenerates the CSV; `npm run data:check` verifies it
  (row count, Z sequence, the listed masses, names 111–118, spelling, every
  tile's row/column against an independent source, H/He/Fr/La/Ac/Og/Lu/Lr
  spot checks, no shared cells, shells sum to Z).
- Sources and caveats: `data/sources/README.md`.

### Tile atlas and fit check

All 118 tiles are drawn once per look into one texture atlas (mipmapped,
anisotropic filtering): number, symbol, name, mass, and for the Flyover also
electron shells as dashed numbers and the common oxidation states at the top
right. The Assemble tiles also carry the element family. Every string is
measured against its room, horizontally and vertically (descenders included).
**Any overflow throws, which fails the render.** `npm run fitcheck` builds all
six table atlases.

## Determinism

Every value on screen is computed from `useCurrentFrame()` only.

- No `Math.random()` at render time. Layouts (panel layout, tile flight paths,
  dot schedules, digit atlases) come from `mulberry32` seeded at module level;
  per-frame values are pure formulas of the frame (shaders use an integer hash
  of position and frame).
- No `useFrame` clock, `Date.now()` or state driving visuals. `useFrame` is used
  only as the render hook: it reads the current frame number and renders.
- No TAA, no accumulative shadows. Shadows in Table Assemble are analytic soft
  quads.
- Fonts, map data, atlases: loaded/built once behind `delayRender`.
- Loops use the frame modulo the loop length for every periodic quantity, and
  the motion is built so that the loop is also continuous (see below).

How the loops close:

- **Data Panels**: each depth layer is a periodic strip that slides by exactly
  k whole layout widths per loop (k = 1 far, 2 near); the map scrolls one full
  360° per loop; number cells tick on hold schedules of 15/20/30/60 frames.
- **Data Tower**: a conveyor. Box *n* sits at height (n + t)·h and turns
  (n + t)·twist, so after one loop box *n* is exactly where box *n+1* was. The
  data marks inside are a hash of (n·ticks + tick step), which carries the same
  one-box shift. Dots flicker on 10/15/20/30-frame holds.
- **Element Grid**: the camera slides exactly one tile width per loop. Labels
  therefore also have to move one cell per loop: a soft horizontal scanning
  light crosses the rows once per loop, and each row's labels shift one cell
  while that band washes the row out, so every row always reads in the right
  order. Dots and streaks move with the same one-cell shift.
- **Table Flyover**: a closed Catmull–Rom camera path.

## Banding

Final pass: ±1/255 triangular dither and ~1.5 % grain, both a fixed hash of
(pixel, frame mod length). All intermediate targets are half-float.

**Check (on the encoded 720p mp4s, not the preview):** frames were decoded
with ffmpeg and pixel values read along lines across the risky areas
(`python3 scripts/verify/checks.py band <mp4> <frame> x0,y0,x1,y1`, 9×9 box
average per sample so the grain does not mask steps). Smooth regions change
in steps of 0–1.5 levels per sample with no plateau-and-jump pattern:

| Area | Result |
|---|---|
| Data Panels: dark vignette gradients (bottom centre, lower right) | smooth (steps ≤ 2.7, only at panel edges larger) |
| Data Tower: blue field (blurred, contrast-stretched ×3) | smooth, no contours |
| Table Assemble Light: background spotlight (top band, left margin) | smooth (steps 0.0–1.4) |
| Table Assemble Dark: background | smooth (0.0–0.9) |
| Table Flyover Blue / Dark Gold: left haze | smooth over the haze (0.0–1.7) until the tiles start |
| Element Grid Grey / Ice Blue: pale paper | smooth between tile lines and dots |

Contrast-stretched crops (×6 for the Panels vignette, ×16 for the Assemble
background) show grain only, no bands.

## Measured render times

Measured on this build machine: 4 CPU cores, **no GPU** (Chromium + ANGLE →
SwiftShader software WebGL2), `--concurrency=1`. The 720p figure is the
whole render's wall time divided by its frames (it includes ~10 s of browser
start-up and atlas building).

| Composition | Frames | 720p wall time | 720p s/frame | 4K estimate (s/frame · whole clip) |
|---|---|---|---|---|
| DataPanels_Blue | 600 | 522 s | 0.87 | 7.1 · ≈71 min |
| DataTower_Blue | 600 | 444 s | 0.74 | 6.0 · ≈60 min |
| ElementGrid_Grey | 600 | 430 s | 0.72 | 5.9 · ≈59 min |
| ElementGrid_IceBlue | 600 | 442 s | 0.74 | 6.0 · ≈60 min |
| TableAssemble_Light | 450 | 302 s | 0.67 | 5.1 (measured) · ≈38 min |
| TableAssemble_Dark | 450 | 334 s | 0.74 | 5.7 · ≈42 min |
| TableFlyover_Blue | 600 | 387 s | 0.65 | 5.6 (measured) · ≈56 min |
| TableFlyover_DarkGold | 600 | 389 s | 0.65 | 5.7 · ≈57 min |

**Two real 4K frames (3840×2160), timed:**

- `TableAssemble-Light`, frame 390 (the hold): **5.1 s/frame**
- `TableFlyover-Blue`, frame 300: **5.6 s/frame**

(Each is the difference between a 3-frame and a 1-frame 4K render, so browser
start-up is excluded; the single-frame cold render took about 17 s.)

The other 4K figures scale each composition's 720p time by the measured
4K/720p ratio of the same look where one was timed (×7.6 Assemble, ×8.7
Flyover) and the average ×8.2 for Panels, Tower and Grid. **4K estimate for all eight on this CPU-only machine: about
7.4 hours** at `--concurrency=1`. A machine with a real GPU (ANGLE on
D3D11/Metal/Vulkan/GL) should be several times faster; that was not measured
here.

## Verification (this delivery)

| # | Check | Result |
|---|---|---|
| 1 | Element data check (118 rows, Z 1–118, masses, names 111–118, layout) | **PASS** (`npm run data:check`) |
| 1 | Fit check, all six table atlases | **PASS** (`npm run fitcheck`) — it caught real overflows during development (long shell strings, symbol descenders touching names), which were fixed |
| 1 | Fresh sub-agent reading the 4K still of the finished table | **No errors found** (all 118 tiles: positions, spelling, numbers, masses) |
| 2 | ffprobe: 1280×720, 30/1, h264, yuv420p, no audio; 15.0 s / 20.0 s | **PASS**, all 8 |
| 3 | Loops: 601-frame composition, frame 600 vs frame 0 | **PASS**, all 6 identical byte for byte; the seam (599 → 0) is also no larger than a normal frame step |
| 4 | Middle frame from a cold start vs the full render | **PASS**, all 8 identical byte for byte |
| 5 | Banding on the encoded mp4s | **PASS** (above) |
| 6 | Contact sheets (8 frames for stories, 5 for loops) | **PASS** — panels with parallax, twisting rising tower on dots, pale grid with dots and streaks, tiles flying in and snapping to a complete table, glide with full element details and current names |
| 7 | Motion: stories in full, 2 s around frame 300 of each loop | **PASS** — no frame-to-frame spikes (max/median step ≤ 1.1 on loops), eased snaps, no text/line shimmer seen |
| — | Clean copy: unzip → `npm install` → `npx remotion studio` | **PASS** (Studio served HTTP 200; `remotion compositions` lists all 8; a still renders) |
| 8 | Visual comparison by fresh sub-agents (1, 2, 4A, 5A) | 3 rounds each; see the delivery report for what was flagged and what remains. 3A had no reference clip. |

To rerun the checks: `bash scripts/verify/render_all.sh` (renders + encodes),
then `scripts/verify/checks.py ffprobe|same|seam|band|sheet` and
`scripts/verify/smooth.py`.

## Notes and deliberate choices

- **Table Flyover camera angle:** the brief says about 25° above the plane;
  the reference reads closer to 45° (the grid fills the frame). The look uses
  32° (`ELEVATION` in `src/looks/tableFlyover.ts`), a compromise that keeps the
  frame full of tiles. Set it to 25 if the brief's angle matters more.
- **f-block placement:** the Table Assemble reference puts La–Lu/Ac–Lr under
  columns 4–18. These compositions keep the standard layout from the brief
  (starting under group 3), which the data check verifies.
- **Flyover names:** current IUPAC names for 111–118 by design (the reference
  shows the old placeholder names).
- **Element Grid** had no reference clip; it follows the written brief.
- **Fonts:** only Inter (tiles) and JetBrains Mono (data numbers), both OFL,
  even where the references use other typefaces.
- **Data Panels hero table:** the large lower-left number table is 90 %
  opaque (other panels use the brief's 40 %), so it reads like the
  foreground table in the reference.
- **Colour handling:** colours are authored as display values. R3F's Canvas
  re-enables `THREE.ColorManagement` unless it is given `legacy`; Stage.tsx
  passes `legacy`, `linear` and `flat`, so a hex value in `versions.ts`
  renders as that hex value.

## Add a colourway (one data row)

Copy a row in `src/versions.ts`, give it a new `id` (letters, digits and `-`)
and change the colours:

```ts
{
  id: "TableFlyover-Emerald",
  look: "flyover",
  frames: 600,
  background: "#06140E",
  params: { plane: "#06140E", text: "#9CF0C8", sub: "#7CD8AE", haze: "#3A8A68", hazeMin: 0.25, glow: 0.4 },
},
```

It appears in the Studio and renders like any other composition. Every look's
parameters are typed (`FlyoverParams`, `AssembleParams`, `GridParams`,
`PanelsParams`, `TowerParams`).

## Licences

- **Inter** and **JetBrains Mono**: SIL Open Font License 1.1
  (`public/fonts/*-OFL.txt`).
- **Natural Earth** 1:110m land: public domain (`public/geo/NATURAL_EARTH_NOTICE.md`).
- No logos or brands. All data numbers are random.
