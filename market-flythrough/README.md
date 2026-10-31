# Market Fly-through: Composition 2

A stock-market data fly-through built with Remotion and Three.js (WebGL 2). One continuous camera travels through:

- LED-style line charts that draw themselves
- ticker tables and candlestick strips, drawn as Canvas 2D textures with LED scanlines that resolve in close-ups
- a network of glowing nodes and lens flares
- floating data bits, fog and a bloom glow

| Composition | Size | FPS | Frames | Duration | Description |
|---|---|---|---|---|---|
| `MarketFlythroughV1` | 3840×2160 (4K UHD) | 30 | 400 | 13.333 s | Matches the reference: green/teal palette and the same beats. Push in onto the rising chart, its head sweeps past, dive into a ticker table until the symbols fill the frame, a second chart rushes past, medium drift over a third chart, then dissolve to glow and network lines. |
| `MarketFlythroughV2` | 3840×2160 (4K UHD) | 30 | 400 | 13.333 s | Alternative **colour palette**: an amber "trading terminal" look. Same choreography and content. |

## Requirements

- Node.js 20.19+ or 22.13+ (tested with 22.23)
- `ffmpeg` is bundled with Remotion; no system install is needed

## Commands

```console
npm ci                 # install the exact dependency versions from package-lock.json
npm run dev            # open Remotion Studio (preview + scrubbing)

npm run render:v1      # -> out/MarketFlythrough_V1_1080p.mp4  (H.264, 1920x1080, 30 fps)
npm run render:v2      # -> out/MarketFlythrough_V2_1080p.mp4
npm run render:v1:4k   # -> out/MarketFlythrough_V1_4K.mp4     (H.264, 3840x2160, 30 fps)
npm run render:v2:4k   # -> out/MarketFlythrough_V2_4K.mp4
```

The 1080p deliverables come from the same 4K compositions, rendered with `--scale=0.5`. Line widths and other pixel sizes scale with the output resolution, so 1080p and 4K renders look the same.

### GPU / headless notes

- `remotion.config.ts` defaults to `--gl=swangle`, which is CPU WebGL through SwiftShader. It works on any machine, including GPU-less servers. On a machine with a GPU, append `-- --gl=angle` to the render scripts for a large speed-up.
- If Remotion can't download its Chrome Headless Shell (for example, in an offline sandbox), set `REMOTION_BROWSER=/path/to/chrome-headless-shell`.

## Project layout

```
src/
  Root.tsx                 compositions (4K, 30 fps, 400 frames)
  MarketFlythrough.tsx     composition component (+ vignette overlay)
  three/ThreeStage.tsx     deterministic Three.js <-> Remotion bridge
  three/util.ts            seeded RNG, monotone keyframe tracks, font loader
  market/config.ts         palettes (green v1 / amber v2) and the camera path
  market/MarketScene.ts    scene layout: charts, tables, candles, network, flares, glow
  market/textures.ts       Canvas 2D generators: ticker tables, candles, flare, glow
public/fonts/              Oswald (SIL OFL 1.1, licence included)
```

All ticker symbols and prices are randomly generated from a fixed seed. They are fictional, and every render produces the same numbers.
