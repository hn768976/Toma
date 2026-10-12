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

RESULTS_PLACEHOLDER
