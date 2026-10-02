# Five UI Loops — Remotion project

Five looks, two versions each → **10 compositions**, all defined at
**3840×2160, 30 fps**. Everything is drawn in code: no MCP servers, no icon
libraries, no logos, no stock art.

| # | Look | 2D/3D | Compositions | Frames |
|---|------|-------|--------------|--------|
| 1 | AI Diagnosis Loading | 2.5D (CSS 3D tilt) | `AIDiagnosis-Medical`, `AIDiagnosis-DNA` | 450 (15 s) |
| 2 | Cart Counter | 2.5D (CSS 3D tilt) | `CartCounter-SlateUSD`, `CartCounter-LightEUR` | 300 (10 s) |
| 3 | Data Stack | 3D (`@remotion/three`, WebGL2) | `DataStack-Cyan`, `DataStack-Amber` | 360 (12 s) |
| 4 | Dot World Map | 2D (one `<canvas>`) | `DotWorldMap-Lime`, `DotWorldMap-Cyan` | 600 (20 s loop) |
| 5 | Gradient Orb | 2D (fragment shader via `@remotion/three`) | `GradientOrb-SunsetPink`, `GradientOrb-OceanMint` | 600 (20 s loop) |

## Quick start

```bash
npm install
npx remotion studio
```

Node 18+ (tested with Node 22). All versions in `package.json` are pinned.

## Chromium GL flag

WebGL2 needs a GL backend in headless Chromium. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, i.e. the same as passing
**`--gl=angle`** on the command line. On a machine with **no GPU at all** use
`--gl=swangle` (SwiftShader behind ANGLE). WebGPU is not used.

## 4K render commands (one per composition)

```bash
npx remotion render AIDiagnosis-Medical    out/AIDiagnosis_Medical.mp4    --gl=angle
npx remotion render AIDiagnosis-DNA        out/AIDiagnosis_DNA.mp4        --gl=angle
npx remotion render CartCounter-SlateUSD   out/CartCounter_SlateUSD.mp4   --gl=angle
npx remotion render CartCounter-LightEUR   out/CartCounter_LightEUR.mp4   --gl=angle
npx remotion render DataStack-Cyan         out/DataStack_Cyan.mp4         --gl=angle
npx remotion render DataStack-Amber        out/DataStack_Amber.mp4        --gl=angle
npx remotion render DotWorldMap-Lime       out/DotWorldMap_Lime.mp4       --gl=angle
npx remotion render DotWorldMap-Cyan       out/DotWorldMap_Cyan.mp4       --gl=angle
npx remotion render GradientOrb-SunsetPink out/GradientOrb_SunsetPink.mp4 --gl=angle
npx remotion render GradientOrb-OceanMint  out/GradientOrb_OceanMint.mp4  --gl=angle
```

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16 and lossless PNG
frames, so these produce 3840×2160 / 30 fps / no audio. Add
`--concurrency=N` to match your cores.

1080p previews (what was delivered) are the same command with `--scale=0.5`;
`scripts/render-previews.sh` does that via a PNG sequence + ffmpeg so the frames
can also be used for the determinism check.

## Still command

```bash
# 6000×3375 = scale 1.5625 of the 3840×2160 composition
npx remotion still DataStack-Cyan out/DataStack_Cyan_f150.png --frame=150 --scale=1.5625 --gl=angle
```

`scripts/stills.sh` renders the full set: two 6000×3375 PNGs per composition
(look 1: mid-progress f200 + complete f435; look 2: early f40 + final f299;
look 3: half-built f150 + complete f359; looks 4/5: f0 + f300) and one 1080p
PNG each.

## Render time

| Look | 1080p, 1 thread (s/frame) | 1080p, 4 threads (wall s/frame) | 6000×3375 still (s/frame) | **4K estimate, 1 thread (s/frame)** | 4K estimate, full comp @4 threads |
|---|---|---|---|---|---|
| AIDiagnosis | 1.54 | 1.30 | 23.4 | **9.0** | ~57 min (450 frames) |
| CartCounter | 1.05 | 0.88 | 12.0 | **4.8** | ~20 min (300 frames) |
| DataStack | 1.27 | 1.14 | 20.3 | **7.8** | ~42 min (360 frames) |
| DotWorldMap | 0.19 | 0.12 | 1.3 | **0.6** | ~4 min (600 frames) |
| GradientOrb | 0.33 | 0.22 | 3.3 | **1.3** | ~9 min (600 frames) |

Machine: 4 vCPU cloud container, no GPU (ANGLE → SwiftShader), Chromium headless shell 1194.
4K estimate = linear fit of per-frame time vs pixel count through the measured 1080p and 6000×3375 points, evaluated at 3840×2160.

Notes:
- "1 thread" = `--concurrency=1`, 60 frames (100–159), bundle/browser start-up
  subtracted. "4 threads" = whole composition at `--concurrency=4`.
- Without a GPU, SwiftShader is itself multi-threaded, so 4 render threads only
  gain 15–35 %. **On a machine with a real GPU (`--gl=angle`) looks 3 and 5 will be
  far faster**; looks 1 and 2 are bound by Chromium's CSS blur/compositing and
  scale mostly with CPU cores.
- Preview command used: `scripts/render-previews.sh` (PNG sequence at
  `--scale=0.5`, then x264 `-preset slow -crf 16 -pix_fmt yuv420p`).

## Determinism

Remotion renders frames out of order on several threads, so every visual value
is a pure function of `useCurrentFrame()`:

- Randomness: `mulberry32` seeded at **module level** (`src/lib/random.ts`) or
  stateless integer hashes of (index, frame) / (pixel, frame). No
  `Math.random()` anywhere.
- No CSS `@keyframes` / transitions, no `Date.now()`, no `useState` driving
  visuals, no R3F clock. The R3F `useFrame` in look 3 is used only as the hook
  where the post-processing chain renders (priority 1); it ignores its clock
  argument. Uniforms and instance buffers are written during React render from
  the frame number. No TAA or temporal effects.
- Count / price (look 2) and progress (look 1) are recomputed from the frame
  each time — nothing is carried between frames.
- Fonts (`src/lib/fonts.ts`) and the Natural Earth land mask
  (`src/looks/dot-map/landMask.ts`, memoised at module level) are behind
  `delayRender` / `continueRender`.
- Loops (looks 4, 5) use `frame % 600` for every input: each dot flicker has a
  whole number of cycles per 600 frames, scan lines move exactly one repeat,
  the gradient turns exactly once, grain is keyed on `frame % 600`.

## Banding

Risky looks: 1, 3, 4 (dark backgrounds + glows) and 5 (large soft gradients).

Counter-measures, all deterministic (fixed function of pixel position + frame,
never `Math.random()`):
- Look 5: ±1/255 shader dither + ~4 % monochrome grain keyed on `frame % 600`.
- Look 3: ±1/255 dither + ~2 % grain in the composite shader, doubled in deep
  shadow (half of it would otherwise clip at 0).
- Looks 1 and 4: ~2 % grain (look 1 as a canvas overlay, look 4 on the map dots
  only; the background stays pure black).
- **Encoder**: default x264 settings at CRF 16 smoothed the grain away in near-black
  areas of looks 1 and 3 and left plateaus (found in the check below). Fixed with
  `-tune grain` + `aq-mode=3:deadzone-inter=0:deadzone-intra=0:no-dct-decimate=1`.
  It is set in `remotion.config.ts` (`overrideFfmpegCommand`) so the 4K renders use it too.

How it was checked (on frames **decoded from the encoded mp4**, not the preview):
1. `scripts/banding.py frame.png "x0,y0,x1,y1" ...` reads pixel values along
   segments that run along glows/gradients. It prints the 7×7-smoothed RGB
   profile, the *staircase residual* (smoothed luma minus its 21-px moving mean;
   a band shows as plateau + jump) and the longest run of identical raw values.
2. `scripts/banding_tiles.py frame.png` checks the whole frame. It finds every 32×32
   tile that is a gentle gradient and fails if raw pixels there form plateaus
   longer than 24 px (i.e. the dither has gone).

Results (final previews):

| Frame (from mp4) | Whole-frame tiles | Segment profiles |
|---|---|---|
| 1A f112 / f224 / f336 | 0 plateau tiles of 1287 / 1223 / 1185 (longest run 13–17 px) | 5 segments, residual ≤ 1.48, runs ≤ 10 px |
| 1B f112 / f224 / f336 | 0 of 1255 / 1206 / 1174 | — |
| 3A f179 / f269 / f359 | 0 of 524 / 485 / 500 (longest 13–17 px) | glow falloff above the stack 71→18 levels, every step negative, no flat runs > 4 px |
| 3B f179 / f269 / f359 | 0 of 621 / 570 / 583 | — |
| 5A f299 | 0 of 1855 (longest 13 px) | 5 segments (orb interior ×2, halo ×2, background), residual ≤ 0.96, runs ≤ 7 px |
| 5B f299 | 0 of 1831 (longest 10 px) | 5 segments, residual ≤ 1.23, runs ≤ 6 px |

Before the encoder fix, 3A had 14 plateau tiles at f269 and 1A had 2, all near
black (luma 2.5–5.7); the lossless PNG of the same frame had 0. In 3A, the only
tiles that still flag are clipped highlights inside the stack core (≥250 on every
channel). Those are excluded as not-a-gradient.

## Verification / completion checklist

All run on the final 1080p previews. Helpers live in `scripts/` (`verify.sh`,
`loop-check.sh`, `banding.py`, `banding_tiles.py`, `pxdiff.py`).

| Check | Result |
|---|---|
| **1. File checks** (`ffprobe`): 1920×1080, 30/1, h264, yuv420p, no audio; 15.0 / 10.0 / 12.0 / 20.0 / 20.0 s | ✅ all 10 |
| **2. Loop** (looks 4, 5): `--props='{"loopCheck":true}'` → 601 frames; frame 600 vs frame 0 | ✅ byte-identical PNGs, all 4 loops |
| **3. Determinism**: frame 150 rendered alone (cold `remotion still`) vs frame 150 of the full render | ✅ byte-identical PNGs, all 10 |
| **4. Banding** on frames decoded from the mp4 (1A, 3A, 5A, 5B; also 1B, 3B) | ✅ see *Banding* above (needed an encoder fix) |
| **5. Content**, 5 evenly spaced frames from each mp4 (`out/verify/<id>/sheet.png`) | ✅ all 10 |
| AI Diagnosis: title, ID, AI badge sharp; bar further along each frame; "Complete" at the end; helix replaces body in 1B | ✅ |
| Cart Counter: count and price both rising, in step; ends at 45 / $3,486.40 and 3.486,40 €; no store name or logo | ✅ |
| Data Stack: outline lines first, then layers bottom→top, then finished glowing stack; board blurred away from it | ✅ |
| Dot World Map: continents recognisable, square dots, different dots bright per frame (30.0 ± 0.3 % bright), no Antarctica | ✅ |
| Gradient Orb: gradient has rotated between frames; soft edge and halo; grain visible | ✅ |
| Pairs differ only as listed (colours, text/ID, backdrop, currency/format) | ✅ |
| Fonts shipped (OFL) and loaded behind `delayRender`; map data shipped (public domain) behind `delayRender` | ✅ |
| No `Math.random()`, no CSS keyframes/transitions, no clock-driven state; no TAA | ✅ |
| Clean copy: `npm install && npx remotion studio` from the zip; `npx remotion compositions` lists all 10 | ✅ |
| 2 stills per composition at 6000×3375 + one 1080p still each | ✅ |

What failed on the first attempt and was fixed:
- **Cart Counter, "in step"** (attempt 1): the badge reached 45 at frame ~200,
  but the price was still rolling until frame 252. Each price roll now completes in
  the first 35 % of its count interval, still from the same single curve.
  Passed on attempt 2.
- **Banding in looks 1 and 3** (attempt 1): near-black plateaus after H.264
  encoding (the lossless frames were clean). Fixed with grain-preserving x264
  settings, plus doubled shadow grain in look 3. Passed on attempt 2.
- **Data Stack** (development, before the previews): a NaN from the outline-box
  shader spread through the bloom chain as black blocks. Also fixed over-exposure.
- **Audio**: Remotion's own mp4 output added a silent AAC track; `Config.setMuted(true)`
  removes it, so the 4K renders have no audio stream either.

## Adding a version (one data row)

All versions live in **`src/versions.ts`**, one object per version. Copy a row,
change `key` (composition id suffix), `file` and the values; it appears in the
Studio as `<Look>-<key>`:

```ts
// src/versions.ts → cartCounterVersions
{
  key: "DarkGBP", file: "CartCounter_DarkGBP",
  bar: "#26303A", barEdge: "#55626E", band: "#1E262E", background: "#14191F",
  icon: "#C8CED4", priceColor: "#EEF1F4", badge: "#2FC48A", badgeText: "#FFFFFF",
  currency: "£", currencyPosition: "before", thousands: ",", decimal: ".",
  finalCount: 45, seed: 7,
},
```

- Look 1 rows: title, ID code, accent colours, `backdrop: "body" | "helix"`,
  progress `seed` (pauses/bursts).
- Look 2 rows: colours, currency symbol + position, separators, final count.
- Look 3 rows: stack colour, trace colours, light palettes.
- Look 4 rows: bright/dim dot colours, scan-line colour.
- Look 5 rows: the two gradient colours and the background.

For the stills/preview scripts, also add the id → file name to
`scripts/render-previews.sh` and a line to `scripts/stills.sh`.

## Project layout

```
remotion.config.ts        GL backend, codec, CRF, pixel format
src/Root.tsx              registers every row of src/versions.ts
src/versions.ts           ← one data row per version
src/lib/                  seeded RNG, fonts, grain overlay, GLSL helpers, colour utils
src/looks/ai-diagnosis/   look 1 (panel, backdrop: body / DNA helix, progress pacing)
src/looks/cart-counter/   look 2 (odometer, count/price curve, self-drawn icons)
src/looks/data-stack/     look 3 (scene, shaders, timeline, bloom/CA/grain post chain)
src/looks/dot-map/        look 4 (Natural Earth → dot grid, canvas renderer)
src/looks/gradient-orb/   look 5 (full-screen fragment shader)
public/fonts/             Inter, JetBrains Mono, Montserrat (woff2) + OFL licences
public/data/              Natural Earth 1:50m land + licence (public domain)
scripts/                  preview render, stills, verification helpers
```

## Licences

- Fonts: **Inter**, **JetBrains Mono**, **Montserrat** — SIL Open Font License
  1.1 (`public/fonts/OFL-*.txt`). Files from the Fontsource packages (v5.2.8).
- Map: **Natural Earth** 1:50m land, public domain
  (`public/data/NaturalEarth-LICENSE.md`).
