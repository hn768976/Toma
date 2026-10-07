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
sets. The config also sets `Config.setMuted(true)` — without it Remotion adds a
silent AAC track — and adds `-tune grain` to the x264 encode. From the Node APIs
pass `muted: true` and an equivalent `ffmpegOverride`.)

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

Measured here: 720p previews (`--scale=1/3` → 1280×720), PNG frames,
`--concurrency=2`, in a cloud container with **no GPU** — Chromium's WebGL2
ran on SwiftShader (software rendering through ANGLE). Wall-clock time per frame:

| Look | Composition | s / frame (720p) |
|---|---|---|
| 1 Payment Network | `PaymentNetwork-BlackCard` | 2.48 |
| 1 Payment Network | `PaymentNetwork-GoldCard` | 2.50 |
| 2 Circuit Battery | `CircuitBattery-Blue` | 2.86 |
| 3 Market Globe | `MarketGlobe-Blue` | 4.81 |
| 4 Dollar Globe | `DollarGlobe-CrashRed` | 4.67 |
| 4 Dollar Globe | `DollarGlobe-RallyGreen` | 4.63 |
| 5 Map Ticker | `MapTicker-Blue` | 2.34 |

(SwiftShader already uses every CPU core, so more tabs didn't speed it up;
`--concurrency=4` measured the same throughput as 1–2.)

**4K estimate.** 4K has 9× the pixels. These looks are fill-rate bound
(full-screen post passes, additive overdraw), so on the same software
renderer expect roughly 7–9× → **~17–45 s/frame (≈3–7.5 h per composition)**.
On a machine with a real GPU (run Chromium with `--gl=angle` so it uses the
hardware), the WebGL work becomes small (tens of ms per frame) and the time is
dominated by Remotion's 4K PNG capture and encode: expect **~0.4–1 s/frame
(≈4–10 min per composition)**.

Performance notes for software GL (they matter less on a GPU):
- HDR targets are float32 where filterable — SwiftShader emulates half floats
  slowly (3–4× slower overall in tests).
- Every shader branch runs on software GL, so the DoF passes use a fixed, small
  number of texture fetches (16-tap quarter-res opaque DoF; 4–5 taps in-shader).

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
300 of the full render — byte for byte (see checklist; `scripts/verify.sh`).

## Banding

- Final pass order: bloom → exposure → tonemap (linear toe, soft shoulder) →
  grade → vignette → **grain ≈1.5 %** (pcg hash of pixel position + frame) →
  **±1/255 triangular dither** → 8-bit.
- HDR buffers are float (half float where float isn't filterable).
- Check the **encoded mp4**, not the preview: extract frames with ffmpeg and
  read pixel values across dark gradients and glow falloffs (see checklist).

Result of the check on all 7 previews (frame 360 decoded from each encoded
mp4; `scripts/banding.py`): **no band edges in any composition**. Along dark rows
and through the brightest glow column, 64-px segment means change by fractional
amounts (smooth), and the local noise from dither + grain stays above the
quantisation step everywhere except one very dark vignette corner.

One finding fixed during the check: with default x264 settings the darkest
top-right corner of the Payment frames became a perfectly flat (0, 0, 10) patch,
because the encoder quantised the dither away. Previews are therefore encoded with
`-tune grain` (`scripts/encode.sh`), which keeps the dither in near-black areas.
`remotion.config.ts` applies the same `-tune grain` to Remotion's own encoder
(`Config.overrideFfmpegCommand`), so the 4K commands above get it automatically.

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

Verified on the 720p previews in this container (`scripts/verify.sh`):

| Check | 1A | 1B | 2 | 3 | 4A | 4B | 5 |
|---|---|---|---|---|---|---|---|
| 1. 1280×720, 30/1, 20.0 s, h264, yuv420p, no audio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2. Loop: frame 0 ≡ frame 600 (pixel-identical) | – | – | – | ✅ | – | – | ✅ |
| 3. Cold frame 300 ≡ full render (byte-identical) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3. Cold frame 90 ≡ full render (byte-identical) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4. Banding (from encoded mp4) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5. Contact sheet shows the required content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6. Frames 299/300/301: no jumps/flicker/crawl | ✅ | ✅ | ✅ | ✅* | ✅ | ✅ | ✅* |
| Text: only "BANK", 1234 5678 9101 1234, 00/00; invented index names | ✅ | ✅ | – | ✅ | ✅ | ✅ | ✅ |

\* Market Globe and Map Ticker move fast (scrolling candles / ticker rows): the
pixel metric flags ~1 % / ~3 % of pixels as changing sign between frames, the
same on frames without a number tick; visual inspection shows continuous motion,
no flicker and no crawling text.

Also verified: `npm install && npx remotion studio` from a clean unzip of the
project (Studio serves; all 7 compositions listed, 3840×2160, 30 fps, 600 frames).
