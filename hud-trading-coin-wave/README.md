# HUD · Trading · Coin · Wave — Remotion project

Six looks, nine compositions, all **3840×2160, 30 fps, 600 frames (20 s), seamless loops**.

| Composition id | Look | Engine | Preview file |
|---|---|---|---|
| `NumberMatrix-Green` | 1A Number Matrix, green | Canvas 2D | `NumberMatrix_Green.mp4` |
| `NumberMatrix-Amber` | 1B Number Matrix, amber | Canvas 2D | `NumberMatrix_Amber.mp4` |
| `RadialHUD-GreyGold` | 2A Radial HUD, grey-gold | Canvas 2D | `RadialHUD_GreyGold.mp4` |
| `RadialHUD-Cyan` | 2B Radial HUD, cyan | Canvas 2D | `RadialHUD_Cyan.mp4` |
| `TradingTerminal-Dark` | 3 Trading Terminal | Canvas 2D | `TradingTerminal_Dark.mp4` |
| `CoinBadge-EtherPurple` | 4A Coin Badge, Ξ | three.js via `@remotion/three` (WebGL2) | `CoinBadge_EtherPurple.mp4` |
| `CoinBadge-BitcoinOrange` | 4B Coin Badge, ₿ | three.js via `@remotion/three` (WebGL2) | `CoinBadge_BitcoinOrange.mp4` |
| `ParticleWave-BlueViolet` | 5 Particle Wave | PixiJS 8 (WebGL2), custom vertex shader | `ParticleWave_BlueViolet.mp4` |
| `NebulaHUD-Purple` | 6 Nebula HUD | Canvas 2D | `NebulaHUD_Purple.mp4` |

Remotion composition ids may only contain letters, digits and `-`, so the ids use `-` and the
file names use `_`.

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ (tested on Node 22). All versions in `package.json` are pinned.

## Chromium GL flag

Coin Badge and Particle Wave need WebGL2. Always render with **`--gl=angle`**. It is already set in
`remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), and the commands below pass it
explicitly as well. Do not use WebGPU.

## 4K render commands

```bash
npx remotion render NumberMatrix-Green      out/NumberMatrix_Green.mp4      --gl=angle --crf=16 --muted
npx remotion render NumberMatrix-Amber      out/NumberMatrix_Amber.mp4      --gl=angle --crf=16 --muted
npx remotion render RadialHUD-GreyGold      out/RadialHUD_GreyGold.mp4      --gl=angle --crf=16 --muted
npx remotion render RadialHUD-Cyan          out/RadialHUD_Cyan.mp4          --gl=angle --crf=16 --muted
npx remotion render TradingTerminal-Dark    out/TradingTerminal_Dark.mp4    --gl=angle --crf=16 --muted
npx remotion render CoinBadge-EtherPurple   out/CoinBadge_EtherPurple.mp4   --gl=angle --crf=16 --muted
npx remotion render CoinBadge-BitcoinOrange out/CoinBadge_BitcoinOrange.mp4 --gl=angle --crf=16 --muted
npx remotion render ParticleWave-BlueViolet out/ParticleWave_BlueViolet.mp4 --gl=angle --crf=16 --muted
npx remotion render NebulaHUD-Purple        out/NebulaHUD_Purple.mp4        --gl=angle --crf=16 --muted
```

Output is H.264, `yuv420p`, 30 fps, no audio stream (the config sets codec, pixel format and
`muted`). For a ProRes master, add `--codec=prores --prores-profile=4444`.

**6K still** (6000×3375, scale 1.5625 of 3840×2160):

```bash
npx remotion still <CompositionId> out/<name>_6K.png --frame=150 --scale=1.5625 --gl=angle
```

**720p previews**, exactly as delivered: `scripts/render-previews.sh`. It renders with
`--scale=0.3333333333333333` (→ 1280×720), CRF 16, and checks the size with ffprobe.

## How the loops and determinism work

- Every visual is computed from `useCurrentFrame()` only, wrapped with `frame % 600`. There is no
  `Math.random()`, `Date.now()`, `useState` for visuals, R3F clock or Pixi ticker.
- Randomness is a module-level seeded `mulberry32` or a pure integer hash of (id, frame bucket),
  in `src/lib/random.ts`.
- Anything that changes on a schedule uses a hold length that divides 600 (`holdBucket`).
- Anything that moves completes a whole number of cycles per loop (`cyc`), and ring rotations are
  whole multiples of the ring's own repeat angle.
- Specifics per look:
  - **Nebula HUD:** the nebula is a pre-built tileable texture that scrolls exactly one tile per loop.
  - **Coin Badge:** the nebula texture is 2-fold rotationally symmetric and turns half a turn per loop.
  - **Particle Wave:** the waves advance whole cycles per loop.
  - **Trading Terminal:** see the next section.
- **Rendering:**
  - Canvas looks size their backing store to the output pixels (`devicePixelRatio`, so 720p
    previews are drawn natively).
  - Canvas looks wait for the fonts with `delayRender` before drawing.
  - Three.js renders through `ThreeCanvas`; Pixi is rendered manually once per Remotion frame.

### Trading Terminal loop

The brief asks for a 20-frame candle life, 30 candles scrolled per loop, 140 candles in view and
an exact loop. With the chart scrolling rigidly, frame 600 only equals frame 0 if the candle series
repeats every 30 candles.

To keep the 140 visible candles from reading as one shape repeated ~4.7 times, a smooth trend that
depends on screen position rides on top of the periodic walk. That trend also repeats exactly after
a 30-candle shift.

The cost is that each candle drifts down by under 0.4 px per frame at 4K as it scrolls left. This
reads like the chart following the price; the price labels stay fixed. The scroll itself is
continuous, so it doesn't jump when a candle completes.

## Adding a colourway or a coin symbol

- **Colourway:** add one row to `VERSIONS` in `src/versions.ts` with a new `id`, the same
  `component`, and new colour props. The props are typed per look (e.g. `NumberMatrixProps`).
- **Coin symbol:** add one builder to `SYMBOLS` in `src/looks/coin/symbols.ts`. A builder returns
  `THREE.Shape[]` (a vector path in a ~2×2 box, holes allowed). Then add one data row with
  `symbol: "<key>"`. The symbols are code-drawn paths, not font glyphs or logo artwork.

## Fonts

OFL only, self-hosted in `public/fonts` with their licence texts (`OFL-*.txt`):
- JetBrains Mono (numbers)
- Inter (labels and panel titles)
- Rajdhani SemiBold (HUD counters)

## Scripts

| Script | What it does |
|---|---|
| `scripts/render-previews.sh [ids…]` | 720p previews and stills, with an ffprobe size check |
| `scripts/verify.py [ids…]` | Steps 1–6 of the verify loop: file checks; full out-of-order PNG render of a 601-frame version with 0 vs 600 compared; cold frame 300 vs full-render frame 300; banding probe frame from the mp4; contact sheet |
| `scripts/timing.sh 720\|4k ids…` | Single-tab per-frame render time |
| `scripts/side-by-side.sh` | Reference frame next to our frame (needs `refs/`, not shipped) |

`loopCheck: true` (an input prop) makes any composition 601 frames long, for the loop check.

## Measured results (this machine)

The machine had 4 CPU cores and no GPU, so WebGL ran on ANGLE→SwiftShader in software. Remotion
4.0.515 drove Playwright's Chromium headless shell 1194.

### Render time per frame

The figures are for one browser tab. Each is (time for 21 frames − time for 1 frame) / 20, measured
with `scripts/timing.sh`.

| Composition | 720p ms/frame (1 tab) | 720p preview wall time (4 tabs, 600 frames) |
|---|---|---|
| NumberMatrix-Green | 104 | 29 s |
| NumberMatrix-Amber | 87 | 30 s |
| RadialHUD-GreyGold | 97 | 30 s |
| RadialHUD-Cyan | 103 | 31 s |
| TradingTerminal-Dark | 128 | 51 s |
| CoinBadge-EtherPurple | 765 | 410 s |
| CoinBadge-BitcoinOrange | 726 | 425 s |
| ParticleWave-BlueViolet | 1464 | 800 s |
| NebulaHUD-Purple | 200 | 68 s |

**Timed real 4K frames** (3840×2160, one tab; (3 frames − 1 frame) / 2):
- TradingTerminal-Dark: **556 ms/frame**
- ParticleWave-BlueViolet: **2076 ms/frame**

**4K estimates for 600 frames, on this kind of CPU-only machine:**

| Composition(s) | Estimate | Basis |
|---|---|---|
| Canvas looks | about 4–7 min each with 4 tabs | Cost scales with pixel count (×9 from 720p) and with the per-pixel grain pass; Trading Terminal measured 0.56 s/frame at 4K → ~5.5 min single tab. Nebula HUD ≈ 2× Terminal. |
| Coin Badge | about 12–15 min | ≈1.2–1.5 s/frame |
| Particle Wave | about 21 min | 2.1 s/frame × 600; SwiftShader is shared between tabs, so extra tabs barely help |

On a machine with a real GPU behind `--gl=angle`, the two WebGL looks should be many times faster.

### Verify loop (steps 1–3)

| Preview | Step 1 file (1280×720, 30/1, h264, yuv420p, no audio, 20.0 s) | Step 2 loop 0 vs 600 | Step 3 cold frame 300 vs full render | Seam diff 599→600 / typical 299→300 (mean abs) |
|---|---|---|---|---|
| NumberMatrix_Green | ✅ | ✅ (max diff 0) | ✅ | 0.775 / 0.718 |
| NumberMatrix_Amber | ✅ | ✅ (max diff 0) | ✅ | 0.773 / 0.714 |
| RadialHUD_GreyGold | ✅ | ✅ (max diff 0) | ✅ | 1.823 / 1.741 |
| RadialHUD_Cyan | ✅ | ✅ (max diff 0) | ✅ | 2.038 / 1.948 |
| TradingTerminal_Dark | ✅ | ✅ (max diff 0) | ✅ | 3.134 / 3.113 |
| CoinBadge_EtherPurple | ✅ | ✅ (max diff 0) | ✅ | 2.535 / 2.009 |
| CoinBadge_BitcoinOrange | ✅ | ✅ (max diff 0) | ✅ | 2.476 / 2.147 |
| ParticleWave_BlueViolet | ✅ | ✅ (max diff 0) | ✅ | 6.716 / 7.451 |
| NebulaHUD_Purple | ✅ | ✅ (max diff 0) | ✅ | 3.242 / 3.311 |

### Step 4 — banding (frames decoded from the encoded mp4)

`scripts/banding.py` reads frame 150 of each mp4.

**Black in Looks 1–2:** share of pixels more than 6 px away from any mark that are exactly 0,0,0.

| Preview | Exactly 0,0,0 | Max value there |
|---|---|---|
| NumberMatrix_Green | 99.70% | 3 |
| NumberMatrix_Amber | 99.67% | 6 |
| RadialHUD_GreyGold | 99.80% | 5 |
| RadialHUD_Cyan | 99.16% | 4 |

The few non-zero pixels are H.264 chroma ringing next to text (values ≤ 6). The grain is held at zero
below 3% luminance.

**Gradients:** row-median luminance profile through an empty gradient area. Design lines of 1–2 px
(chart grid, LED cell gaps) are median-filtered out.

| Area | Luminance | Largest step between rows | Flat runs > 12 px |
|---|---|---|---|
| TradingTerminal_Dark (empty chart navy) | 24.5 → 24.5 | 0.0 | 1 |
| CoinBadge_EtherPurple (vignette, lower-right corner) | 0.9 → 0.0 | 0.28 | 2 |
| CoinBadge_BitcoinOrange (vignette, lower-right corner) | 1.0 → 0.0 | 1.0 | 8 |
| ParticleWave_BlueViolet (sky haze) | 15.7 → 30.6 | 1.86 | 5 |
| NebulaHUD_Purple (band edge, right margin) | 4.8 → 23.2 | 6.77 | 2 |

Steps stay at about 1–2 levels with no long plateaus, so there is no visible banding. The Nebula HUD
reading is the deliberate dot-matrix (LED) cell edges in the band, not banding.

### Step 5 / 6
- Contact sheets (5 frames each) are in `out/sheets/` of the working copy (not shipped).
- 2 s around frame 300 were stepped through for each look:
  - Flat text sits on integer pixels.
  - Ring rotations are continuous.
  - The chart scrolls continuously by pitch/20 per frame, so nothing jumps when a candle completes.
  - Particles are clamped to at least 1.25 px with area-scaled alpha, so they don't alias or flicker.

## Completion checklist

- [x] 9 compositions, 3840×2160, 30 fps, 600 frames, one data row per version
- [x] Canvas 2D (1–3, 6), `@remotion/three` WebGL2 (4), PixiJS 8 WebGL2 with shader projection (5); no WebGPU
- [x] OFL fonts only (JetBrains Mono, Inter, Rajdhani SemiBold) with licences
- [x] No logos, brands, index names, exchanges or platforms; Ξ and ₿ are vector paths in code
- [x] Deterministic: no `Math.random`, `Date.now`, clocks, tickers or stored state; fonts awaited with `delayRender`
- [x] Seamless loops: frame 600 equals frame 0 pixel for pixel, for all 9
- [x] Cold frame 300 is byte-identical to frame 300 of the full render, for all 9
- [x] Dither ±1/255 and ~1.5% grain from (x, y, frame % 600); grain fades to 0 below ~3% luminance on Looks 1–2
- [x] 720p previews: H.264, yuv420p, CRF 16, 1280×720, 20.0 s, no audio; 720p PNG stills
- [x] 4K and 6K-still commands documented; no 4K video or 6K stills rendered here

