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

RENDER_TIMES

## Banding check

BANDING

## Verification results

VERIFY

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

CHECKLIST

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
