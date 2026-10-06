# Payment Card · Circuit Battery · Market Globe · Dollar Globe · Map Ticker

Five finance/technology looks, seven compositions, one Remotion project.
Everything is built in code with **three.js on WebGL2** (via `@remotion/three`),
with Canvas 2D used only to draw textures (charts, labels, card face).

| Composition id | Deliverable name | Look | Type |
|---|---|---|---|
| `PaymentNetwork-BlackCard` | `PaymentNetwork_BlackCard` | 1A Payment Network, black card | story |
| `PaymentNetwork-GoldCard` | `PaymentNetwork_GoldCard` | 1B Payment Network, gold card | story |
| `CircuitBattery-Blue` | `CircuitBattery_Blue` | 2 Circuit Battery | build-in + hold |
| `MarketGlobe-Blue` | `MarketGlobe_Blue` | 3 Market Globe | seamless loop |
| `DollarGlobe-CrashRed` | `DollarGlobe_CrashRed` | 4A Dollar Globe, crash (red, arrow down) | build-in + hold |
| `DollarGlobe-RallyGreen` | `DollarGlobe_RallyGreen` | 4B Dollar Globe, rally (green, arrow up) | build-in + hold |
| `MapTicker-Blue` | `MapTicker_Blue` | 5 Map Ticker | seamless loop |

All compositions: **3840×2160, 30 fps, 600 frames (20 s)**. (Remotion ids
cannot contain underscores, so ids use `-`; output files use the `_` names.)

## Setup

```bash
npm install
npx remotion studio          # preview
```

Node 18+ (tested with Node 22). Versions are pinned in `package.json`.

## Chromium GL flag

Every look is WebGL2. Headless Chromium must run with ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("angle")`;
pass `--gl=angle` explicitly when using the CLI from elsewhere or the Node APIs
(`chromiumOptions: { gl: "angle" }`). WebGPU is not used.

## 4K render commands

```bash
npx remotion render PaymentNetwork-BlackCard out/PaymentNetwork_BlackCard.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render PaymentNetwork-GoldCard  out/PaymentNetwork_GoldCard.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render CircuitBattery-Blue      out/CircuitBattery_Blue.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render MarketGlobe-Blue         out/MarketGlobe_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render DollarGlobe-CrashRed     out/DollarGlobe_CrashRed.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render DollarGlobe-RallyGreen   out/DollarGlobe_RallyGreen.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render MapTicker-Blue           out/MapTicker_Blue.mp4           --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

(The codec/CRF/pixel-format/image-format flags repeat what `remotion.config.ts`
sets, so they also work from the Node APIs' equivalent options.)

720p previews (what was rendered here): add `--scale=0.3333333333333333`
(→ exactly 1280×720). `scripts/render-preview.sh <id> <name>` renders a PNG
sequence at that scale and encodes it with ffmpeg (H.264, yuv420p, CRF 16,
30 fps, no audio) — keeping the PNGs makes the determinism check byte-exact.

## Stills (6000×3375)

```bash
npx remotion still MarketGlobe-Blue out/MarketGlobe_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle --image-format=png
```

`--scale=1.5625` × 3840×2160 = 6000×3375. Use any composition id / frame.
(Not rendered here.)

## Render time

__TIMING__

## Determinism

Remotion renders frames out of order across several tabs. Every visible value
is a function of `useCurrentFrame()` only:

- `mulberry32` generators are created from fixed module-level seeds
  (`src/lib/rand.ts`), so every scene build is identical in every tab.
- Per-frame variation (blinks, flicker, ticking numbers) uses stateless hashes
  of (index, frame) — in JS (`hash`) and in GLSL (`hash11`, pcg).
- No `Math.random()`, `Date.now()`, `useState`-driven visuals, temporal AA or
  values carried between frames. R3F's `useFrame` is used only as the hook
  that takes over the render pass (priority 1); its clock and delta are never
  read.
- Canvas textures are drawn once from seeded data. "Ticking" labels select a
  cell of a pre-drawn atlas from the frame number, so no canvas is ever
  redrawn incrementally.
- Fonts and Natural Earth data load behind `delayRender` / `continueRender`.

Self-check: render frame 300 alone from a cold start and compare it with frame
300 of the full render — byte for byte (see checklist).

## Banding

- Final pass order: bloom → exposure → tonemap (linear toe, soft shoulder) →
  grade → vignette → **grain ≈1.5 %** (pcg hash of pixel position + frame) →
  **±1/255 triangular dither** → 8-bit.
- HDR buffers are float (half float where float isn't filterable).
- Check the **encoded mp4**, not the preview: extract frames with ffmpeg and
  read pixel values across dark gradients and glow falloffs (see checklist).

__BANDING__

## Loops (Market Globe, Map Ticker)

Globe rotation, chart scrolls, label wraps, label ticks, donut sweeps, camera
drift, flare and glide all complete whole cycles in 600 frames. To verify:

```bash
npx remotion still MarketGlobe-Blue f0.png   --frame=0   --props='{"loopCheck":true}' --scale=0.3333333333333333 --gl=angle --image-format=png
npx remotion still MarketGlobe-Blue f600.png --frame=600 --props='{"loopCheck":true}' --scale=0.3333333333333333 --gl=angle --image-format=png
cmp f0.png f600.png
```

`loopCheck` temporarily makes the composition 601 frames. To hunt a seam,
hide parts by name: `--props='{"loopCheck":true,"skip":"globe,charts,labels"}'`
(names: `globe`, `charts`, `strip0…`, `panels`, `labels`, `floor`; Map Ticker:
`map`, `candles`, `lines`, `labels`, `grid`, `bands`, `flare`).

## Adding a colourway

1. Open `src/versions.ts`. Each version is **one data row**:
   ```ts
   {
     id: "DollarGlobe-GoldBull",          // Remotion id (letters, digits, -)
     file: "DollarGlobe_GoldBull",        // deliverable name
     look: "dollarGlobe",
     params: { tint: "#E0B030", bg: "#120C02", highlight: "#FFF2C8", direction: "up" },
   },
   ```
2. The `params` type for each look is exported next to it
   (`PaymentParams`, `BatteryParams`, `MarketGlobeParams`, `DollarParams`,
   `MapTickerParams`); TypeScript tells you what's required.
3. `npx remotion studio` → the new composition appears.

## Project layout

```
src/
  Root.tsx            compositions from versions.ts
  versions.ts         one data row per version
  lib/
    LookCanvas.tsx    @remotion/three canvas, asset loading, per-frame render
    postfx.ts         DoF, bloom, tonemap, grain, dither (no temporal state)
    materials.ts      instanced dots / segments / textured planes with in-shader DoF
    globe.ts labels.ts charts.ts geo.ts canvas.ts assets.ts rand.ts shared.ts
  looks/              one file per look
public/
  fonts/              Inter, JetBrains Mono, Kode Mono (+ OFL licences)
  data/               Natural Earth 1:50m land (public domain) + licence
scripts/              preview render + stills helpers
```

## Content rules

- No logos, brand names, card-network marks, real bank names, holder names,
  real tickers or real index names. Index labels are invented (`IDX-30`,
  `GLB-500`, `MKT-A`, …); every number is generated.
- The card is a generic mock-up: "BANK", chip, `1234 5678 9101 1234`, `00/00`.
- The dollar is a plain "$" glyph (Inter Bold), not a banknote.

## Licences

- Inter, JetBrains Mono, Kode Mono — SIL Open Font License 1.1
  (`public/fonts/*-OFL.txt`).
- Natural Earth — public domain (`public/data/NaturalEarth-LICENSE.md`).

## Completion checklist

__CHECKLIST__
