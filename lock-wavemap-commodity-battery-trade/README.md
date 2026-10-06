# Lock HUD · Wave Map · Commodity Board · Energy Battery · Trade Chart

One Remotion project, five looks, eight compositions. Everything is three.js on
**WebGL2** (via `@remotion/three`), 30 fps, 16:9, defined at **3840×2160**.

| Composition id | Look | Length | Notes |
|---|---|---|---|
| `LockHUD-BlueOrange` | 1 Lock HUD | 600 f (20 s) | 0–1.5 s black, 1.5–4 s build-in, live hold |
| `WaveMap-Teal` | 2A Wave Map | 600 f loop | |
| `WaveMap-Gold` | 2B Wave Map | 600 f loop | |
| `CommodityBoard-Blue` | 3 Commodity Board | 600 f (20 s) | 0–1.5 s gradient, 1.5–3.5 s rows in, live |
| `EnergyBattery-Blue` | 4A Energy Battery | 600 f loop | |
| `EnergyBattery-Green` | 4B Energy Battery | 600 f loop | |
| `TradeChart-Tariffs` | 5A Trade Chart | 450 f (15 s) | illustrative data |
| `TradeChart-Inflation` | 5B Trade Chart | 450 f (15 s) | illustrative data |

```
npm install
npx remotion studio        # preview (Studio caps the canvas at 0.5× device pixels)
```

## Rendering

**Chromium GL flag:** WebGL2 needs ANGLE in headless Chromium. `remotion.config.ts`
already sets `Config.setChromiumOpenGlRenderer("angle")`; on the command line this is
`--gl=angle`. On a machine without a GPU ANGLE falls back to SwiftShader (same pixels,
much slower). WebGPU is not used.

### 4K, one command per composition (H.264, yuv420p, CRF 16)

```
npx remotion render src/index.ts LockHUD-BlueOrange   out/LockHUD_BlueOrange.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts WaveMap-Teal         out/WaveMap_Teal.mp4         --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts WaveMap-Gold         out/WaveMap_Gold.mp4         --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts CommodityBoard-Blue  out/CommodityBoard_Blue.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts EnergyBattery-Blue   out/EnergyBattery_Blue.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts EnergyBattery-Green  out/EnergyBattery_Green.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts TradeChart-Tariffs   out/TradeChart_Tariffs.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render src/index.ts TradeChart-Inflation out/TradeChart_Inflation.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
```

### 6K still (6000×3375)

`--scale=1.5625` turns the 3840×2160 composition into 6000×3375; everything
(render targets, canvas textures, blur radii) is derived from the device-pixel size.

```
npx remotion still src/index.ts LockHUD-BlueOrange out/LockHUD_6K.png --frame=300 --scale=1.5625 --gl=angle --image-format=png
```

(Same pattern for every id; use `--frame=420` for the Trade Charts.)

### 720p previews + verification (what was run here)

```
scripts/render-previews.sh     # Remotion PNG sequence at --scale=1/3 -> ffmpeg H.264 CRF16 yuv420p
python3 scripts/verify.py      # steps 1-6 -> out/verify/report.txt + contact sheets
```

`--scale=0.3333333333333333` gives exactly 1280×720 (checked with ffprobe).

## Measured render time

RENDER_TIMES

## Architecture

- `src/core/Stage.tsx` — wraps `<ThreeCanvas>`; renders at the exact device-pixel size
  Remotion captures. A priority-1 `useFrame` is used only as the render hook; the frame
  number comes from `useCurrentFrame()`, never from the R3F clock.
- `src/core/post.ts` — shared GPU post chain: HDR scene (half-float, 4× MSAA, depth
  texture) → depth of field (CoC pass, half-res Vogel gather, mix) → 7-level bloom →
  exposure, highlight shoulder, vignette → **grain ≈1.5 % + ±1/255 dither** from an integer
  hash of (pixel, frame) in the final pass. No temporal effects.
- `src/core/assets.ts` — Inter / JetBrains Mono (OFL) and Natural Earth land, loaded
  behind `delayRender` / `continueRender`; tiny built-in TopoJSON decoder.
- `src/looks/*.ts` — one factory per look: builds the scene once, then `update(frame)`
  sets every uniform/transform and redraws canvas textures from the frame number.
- `src/Root.tsx` — the eight compositions; each version is one data row (`defaultProps`).

### Determinism

- No `Math.random()`, `Date.now()`, R3F clock or React state drives visuals. Randomness is
  `mulberry32` seeded at module level, or a pure integer hash.
- Canvas textures are rebuilt from the frame (cached only by a key that is itself a pure
  function of the frame).
- Self-check (run by `verify.py`): frame 300 (and 75 for the build-in looks) rendered on
  its own from a cold start is byte-for-byte identical to the same frame of the full
  multi-threaded render.
- Loops: pass `--props='{"loopCheck":true}'` to a Wave Map / Energy Battery composition to
  make it 601 frames; frame 600 is pixel-identical to frame 0. All oscillators complete
  whole cycles in 600 frames, candles scroll exactly one data period, the grain hash uses
  `frame % 600`.

### Banding

The dither and grain are applied after bloom and tonemapping, as the very last step.
`verify.py` checks a frame **decoded from the encoded mp4**: it averages rows across the
dark gradients at the top and bottom of the frame and reports the largest step and the
longest run of identical 8-bit values. A banded gradient would show long flat runs and
1/255 jumps; see `out/verify/report.txt`.

## Adding a Trade Chart topic

Add a data row in `src/Root.tsx` and a `<Composition>` that uses it:

```tsx
export const TRADE_RATES: TradeChartProps = {
  title: "Interest Rates",
  subtitle: "Policy Rate and Mortgage Rate",
  years: [2021, 2022, 2023, 2024, 2025, 2026],
  yMax: 10, yStep: 2,
  note: "Illustrative data",
  series: [
    { label: "POLICY", color: "#3AD8FF", values: [/* 16 invented values */] },
    { label: "MORTGAGE", color: "#FF3A7A", values: [/* 16 invented values */] },
  ],
};
<Composition id="TradeChart-Rates" component={TradeChart} defaultProps={TRADE_RATES}
  durationInFrames={450} fps={30} width={3840} height={2160} />
```

Any number of points works (they are spread evenly from the first to the last year).
Keep the "Illustrative data" note for invented figures.

## Adding a colourway

Every look takes its colours as props. Copy a data row (e.g. `WAVE_GOLD`,
`BATTERY_GREEN`, `LOCK_BLUE_ORANGE`, `COMMODITY_BLUE`), change the hex values and register
a new `<Composition>` with it. For the loop looks, keep `calculateMetadata={loopMeta}`.

## Assets and licences

- `public/fonts/` — Inter and JetBrains Mono (woff2 from Fontsource), SIL Open Font
  License 1.1: `Inter-OFL.txt`, `JetBrainsMono-OFL.txt`.
- `public/data/land-50m.json` — Natural Earth 1:50m land (public domain), TopoJSON
  packaging from `world-atlas` (ISC, `world-atlas-LICENSE.txt`).
- No logos, brand names, tickers or exchange names. Commodity names are generic words.
  All numbers are invented.

## Completion checklist

CHECKLIST
