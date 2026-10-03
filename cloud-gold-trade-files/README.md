# Cloud Servers · Light Trails · Gold Bar Chart · Trade War Maps · File Wave

Five 3D looks and nine compositions in one Remotion project, all built in code
with three.js (WebGL2) through `@remotion/three`. Every composition is defined
at **3840×2160, 30 fps**.

| Composition id (render) | Output name | Frames | Loop |
|---|---|---|---|
| `CloudServers-Blue` | `CloudServers_Blue` | 600 | 20 s seamless |
| `CloudServers-Violet` | `CloudServers_Violet` | 600 | 20 s seamless |
| `LightTrails-Blue` | `LightTrails_Blue` | 600 | 20 s seamless |
| `LightTrails-RedOrange` | `LightTrails_RedOrange` | 600 | 20 s seamless |
| `GoldBarChart-Rising` | `GoldBarChart_Rising` | 360 | — |
| `GoldBarChart-Falling` | `GoldBarChart_Falling` | 360 | — |
| `TradeWar-USA-China` | `TradeWar_USA_China` | 450 | — |
| `FileWave-Documents` | `FileWave_Documents` | 600 | 20 s seamless |
| `FileWave-Folders` | `FileWave_Folders` | 600 | 20 s seamless |

Remotion composition ids may not contain `_`, so ids use `-`; the data rows and
output files use the `_` names.

## Setup

```bash
npm install          # versions are pinned in package.json / package-lock.json
npx remotion studio  # preview (the studio draws at <=720p so scrubbing stays usable)
```

Node 18+ (built with Node 22). No GPU is required; with one, renders are much faster.

## Chromium GL flag

All renders need WebGL2 in headless Chromium:

```
--gl=angle
```

It is also set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`),
so the CLI uses it by default. On a machine without a GPU, ANGLE falls back to
SwiftShader (software); output is identical, only slower.

## Render at 4K (final masters)

```bash
npx remotion render CloudServers-Blue      out/CloudServers_Blue.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CloudServers-Violet    out/CloudServers_Violet.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render LightTrails-Blue       out/LightTrails_Blue.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render LightTrails-RedOrange  out/LightTrails_RedOrange.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render GoldBarChart-Rising    out/GoldBarChart_Rising.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render GoldBarChart-Falling   out/GoldBarChart_Falling.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render TradeWar-USA-China     out/TradeWar_USA_China.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render FileWave-Documents     out/FileWave_Documents.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render FileWave-Folders       out/FileWave_Folders.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

Higher-quality masters: add `--codec=prores --prores-profile=4444` (drop the CRF
and pixel-format flags), or render a PNG sequence with
`--sequence --image-format=png out/<name>/`.

720p previews (what was rendered and checked here): `scripts/render-previews.sh`
(PNG sequence at `--scale=0.3333333333333333`, exactly 1280×720, then ffmpeg
H.264 / yuv420p / CRF 16 / 30 fps, BT.709 tags, no audio).

## Stills (6000×3375)

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375:

```bash
npx remotion still GoldBarChart-Rising out/GoldBarChart_Rising_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Any composition id and frame work the same way. (Not rendered here.)

## Measured render time per frame (720p) and 4K estimate

Measured on the build machine: 4 vCPU, **no GPU** (WebGL2 through ANGLE's
SwiftShader software backend), Remotion `--concurrency=2`, 720p
(`--scale=0.3333333333333333`), PNG frames. Seconds per frame = whole render
time / frames, so it includes the ~8 s browser start-up.

| Look | Composition | 720p s/frame | 4K estimate, same CPU-only machine | 4K estimate, with a GPU |
|---|---|---|---|---|
| Cloud Servers | Blue / Violet | 0.40 / 0.40 | ~3 s | ~0.3–0.6 s |
| Light Trails | Blue / RedOrange | 1.02 / 1.01 | ~8 s | ~0.3–0.6 s |
| Gold Bar Chart | Rising / Falling | 1.45 / 1.63 | ~12 s | ~0.5–1 s |
| Trade War Maps | USA vs China | 3.01 | ~22 s | ~0.6–1.2 s |
| File Wave | Documents / Folders | 1.01 / 1.19 | ~8 s | ~0.4–0.8 s |

How the 4K figures were estimated: 4K has 9× the pixels of 720p. Scene
drawing, MSAA, bloom and grain scale with pixel count, but depth of field
runs at a fixed ≤540-line working size and setup time does not grow, so on
this CPU-only machine a 4K frame should cost ~7–8× a 720p frame. On a GPU
the drawing is a small part of the time; PNG readback and encoding of a 4K
frame (~0.2–0.4 s) dominate. These 4K numbers are estimates; 4K was not
rendered here, as the brief asked.

## Banding check

- Every look applies a ±1/255 triangular dither after bloom and tone mapping
  (`src/lib/post.ts`), from an integer hash of pixel position and frame. Light
  Trails skips it on pixels that are exactly black.
- Looks 1, 3, 4 and 5 add ~2% grain from the same fixed formula of pixel and
  frame (never `Math.random()`). Light Trails has no grain.
- Checked on the **encoded mp4s**, not the preview. For Cloud Servers Blue,
  Gold Rising, Trade War and File Wave Documents, frame 300 was decoded, and
  the dark range (0–48) was stretched ~5× and inspected.
  Pixel rows across dark gradients and glows were also read
  (`scripts/verify.py`). Glow falloffs and dark backgrounds change smoothly,
  with at most 3 levels between neighbouring pixels in dark ramps and no
  visible contour steps. Repeat with `python3 scripts/verify.py`.

## Verification results

`scripts/verify.py` was run against the final 720p previews:

| Check | Result |
|---|---|
| 1. ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, 12.0 / 15.0 / 20.0 s | all 9 pass |
| 2. Loop: frame 0 vs frame 600 (composition temporarily 601 frames via `--props='{"loopCheck":true}'`) | Cloud ×2, Trails ×2, File Wave ×2: identical, max diff 0, PNG bytes equal |
| 3. Black: Light Trails top 20% of decoded mp4 frames 0/200/400 | max value 0 for both versions |
| 4. Frame 200 rendered alone from a cold start vs frame 200 of the full render | all 9 byte-for-byte identical |
| 5. Banding on decoded mp4 (looks 1, 3, 4, 5A) | smooth, no steps (see above) |

## How to add a version (one data row)

All versions live in `src/versions.ts`. `src/Root.tsx` registers one
composition for every row, so adding a row is all that is needed.

- **Cloud Servers**: add a row to `CLOUD_ROWS`:
  `{ id: "CloudServers_Green", line: "#4FFFA0", rack: "#1E5A48", cloud: "#7FFFC8", lights: [main, white, accent1, accent2], floor: "#03140E" }`
- **Light Trails**: add to `TRAILS_ROWS`: `{ id, from, to, accent, head }`.
- **Gold Bar Chart**: add to `GOLD_ROWS`: `{ id, direction: "rising" | "falling", columns: [bars per column, left to right] }`.
  Falling is rendered as the mirror image of the rising layout, and the top two
  bars of the last column tumble off.
- **File Wave**: add to `FILES_ROWS`: `{ id, item: "document" | "folder", glass, edge, background, grid }`.
- **Trade War Maps, new country pair**: add a row to `TRADE_ROWS`, for example US vs Japan:

  ```ts
  {
    id: "TradeWar_USA_Japan",
    left:  { iso: "USA", flag: "USA",   containers: "#1F3FA8", light: "#7FA8FF" },
    right: { iso: "JPN", flag: "Japan", containers: "#C8161E", light: "#FF5A3A" },
  }
  ```

  `iso` is the Natural Earth `ADM0_A3` code; the country's largest polygon is
  extruded. `flag` names a flag drawer in `src/looks/trade/flags.ts`. Drawn
  today: USA, China, Japan, Germany, France and Italy. For a new flag, add a
  function there that draws it on a canvas at its official proportions and add
  its name to `FlagId` (for US vs Canada: a `Canada` drawer with the 1:2:1
  red-white-red bands and the 11-point maple leaf from the official
  construction sheet, then `iso: "CAN"`). The optional `flagUV: [offsetU, offsetV, repeat]`
  moves the flag on the map's bounding box, so emblems such as China's stars
  land inside the coastline. "US vs EU" would need an EU outline (several
  Natural Earth countries merged) and is not a single data row.

## Light Trails: blending

Light Trails is rendered on **pure black (0,0,0)** with no grain or dither on
the black, so it can be laid over other footage with **Screen** or **Add**
(linear dodge) blending; black disappears and only the light remains.

## Determinism

Every value on screen is a function of `useCurrentFrame()` only:

- layouts, debris paths, flicker phases etc. come from `mulberry32` seeded at
  module level (or with a fixed seed); there is no `Math.random()` anywhere;
- no physics: drops, bounces, tumbles, container landings, debris and dust are
  eased closed-form paths of the frame number;
- no `useFrame` clock, `Date.now()` or `useState` driving visuals; R3F's
  `useFrame` (priority 1) is only used as the hook that tells us to draw, and
  the frame number is read from Remotion;
- no TAA, temporal AO or accumulative shadows; the post chain
  (`src/lib/post.ts`: depth of field, bloom, ACES, dither, grain) uses only the
  current frame; grain and dither are an integer hash (PCG3D) of pixel position
  and frame (frame mod loop length in looping compositions);
- the HDRI, the Natural Earth file and all generated textures are loaded behind
  `delayRender` / `continueRender`.

Check: `scripts/verify.py` renders frame 200 on its own from a cold start and
compares it with frame 200 of the full render (byte for byte).

## Completion checklist

- [x] 9 compositions, 3840×2160, 30 fps; looks 1, 2, 5 600 frames (seamless loops), look 3 360, look 4 450
- [x] three.js through `@remotion/three`, WebGL2 (`--gl=angle`), no WebGPU, no MCP servers, everything built in code
- [x] One data row per version in `src/versions.ts`; new versions and country pairs are one row each
- [x] Studio HDRI from Poly Haven (CC0) and Natural Earth 1:50m countries (public domain, default worldview) shipped with licences
- [x] US flag 13 stripes / 50 stars (9 rows of 6 and 5); China flag with five stars, small stars pointing at the big one; drawn in code
- [x] No banknotes, currency, logos, brands or text; gold bars are plain
- [x] ACES filmic tone mapping, sRGB output; ±1/255 dither everywhere (not on the trails' black); ~2% fixed-formula grain in looks 1, 3, 4, 5
- [x] Glass faked (Fresnel, opacity, edge glow); no transmission
- [x] Deterministic: seeded mulberry32, no physics, no clocks, no temporal effects; assets behind `delayRender`
- [x] Verify loop steps 1–5 pass on the final previews (table above)
- [x] Steps 7–8: side-by-side self-check plus three rounds of independent sub-agent comparison per look (reports summarised in the delivery notes)
- [x] 720p previews and one 720p PNG still per composition
- [x] Clean copy: `npm install && npx remotion studio` starts; a still renders from the clean copy
- [ ] 4K masters and 6K stills: not rendered here (by design); commands above

## Project layout

```
remotion.config.ts        CLI config (GL renderer, codec defaults)
src/Root.tsx              one <Composition> per data row
src/versions.ts           the data rows
src/lib/Stage.tsx         ThreeCanvas wrapper: builds a look once per tab, draws per frame
src/lib/post.ts           DOF, bloom, ACES, dither + grain (deterministic, resolution independent)
src/lib/*.ts              seeded random, geometry, screen-space lines, colour helpers, assets
src/looks/cloud           Cloud Servers
src/looks/trails          Light Trails
src/looks/gold            Gold Bar Chart
src/looks/trade           Trade War Maps (+ Natural Earth loader, flag drawing)
src/looks/files           File Wave
public/hdri               Poly Haven studio HDRI (CC0) + licence
public/naturalearth       Natural Earth 1:50m countries (public domain) + licence
scripts/                  preview render, verification, side-by-side helper
```

## Licences of shipped data

- `public/hdri/studio_small_03_1k.hdr`: Poly Haven, CC0 (see `public/hdri/LICENSE.md`).
- `public/naturalearth/ne_50m_admin_0_countries.geojson`: Natural Earth, public
  domain (see `public/naturalearth/LICENSE.md`).
- Flags are drawn in code from their official specifications. No logos,
  brands, banknotes or currency imagery are used anywhere.
