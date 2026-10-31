# Composition 2 — Market Crash (Remotion + Three.js)

A stock-market crash in 3D. A jagged price line draws itself downward
across the frame, an LED dot-matrix chart plunges past the camera,
candlestick rows recede into depth, and ticker boards with falling prices
glow behind everything. Anamorphic lens flares, spark bursts, light
streaks, floating data chips and a heavy vignette complete the look.

| Composition ID | Version | Look |
| --- | --- | --- |
| `MarketCrash-V1-Reference` | V1, matches the reference | Ember red, orange and hot white |
| `MarketCrash-V2-Arctic` | V2, alternative **colour palette** | "Cold crash" in electric blue and cyan with ice-white highlights. Same scene, camera and timing. |

* Resolution: **3840 × 2160 (4K UHD)** compositions
* Frame rate: **30 fps**
* Duration: **400 frames = 13.333 s**, the same as the reference clip
* No audio

### Shot timing (both versions)

| Time | Shot |
| --- | --- |
| 0.0–2.7 s | Wide push-in on the glowing chart field and flares; spark burst at about 2.2 s |
| 2.7–6.0 s | Closer drift to the right. The LED chart enters, with a second spark burst at about 5.9 s |
| 6.0–9.3 s | Banked view following the falling line, with candle rows and light streaks |
| 9.3–12.4 s | Descent down the line onto the ticker boards, ending in an extreme close-up |
| 12.4–13.3 s | Fast whip pull-back to the opening wide view, so the clip loops |

## Tech

* Remotion 4 (project created with `npx create-video --blank`)
* Three.js with custom WebGL2 shaders (`src/engine/`):
  * instanced sprites (dots, glows, anamorphic flares)
  * line ribbons in screen or world width, with draw-on, fade and moving tails
  * SDF billboards for the LED dots and data chips
  * ticker boards drawn on a canvas with the bundled **Oswald** font
    (`public/fonts`, SIL OFL). Depth of field on them is approximated with
    mip-level bias.
* Spark bursts are simulated in closed form from the frame time, so they
  are deterministic.

## Commands

```bash
npm ci                 # install exact dependency versions
npm run dev            # Remotion Studio preview
npm run typecheck      # TypeScript check

# 1080p deliverables (4K composition rendered with --scale=0.5)
npm run render:v1      # -> out/Composition2_V1_Reference_1080p.mp4
npm run render:v2      # -> out/Composition2_V2_ArcticPalette_1080p.mp4

# Native 4K masters
npm run render:v1:4k   # -> out/Composition2_V1_Reference_4K.mp4
npm run render:v2:4k   # -> out/Composition2_V2_ArcticPalette_4K.mp4
```

Output is H.264 MP4 (yuv420p, CRF 16), set in `remotion.config.ts`.

### Rendering notes

* Node 20.19+ or 22.13+ is required.
* WebGL uses `swangle` (ANGLE on SwiftShader), so it renders on any machine,
  including headless servers without a GPU. With a GPU you can add
  `--gl=angle` for speed.
* Remotion downloads its own Chrome Headless Shell the first time it runs.
  If your environment cannot download it, set
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.

## Layout

```
public/fonts/                 Oswald woff2 + licence (ticker typeface)
src/
  index.ts / Root.tsx         composition registration (4K, 30 fps, 400 frames)
  engine/batches.ts           instanced sprites / lines / billboards + DOF shaders
  engine/textPlane.ts         glowing textured plane with mip-bias defocus
  engine/spline.ts, random.ts
  crash/scene.ts              chart, LED, candles, boards, flares, streaks, chips, dust
  crash/ticker.ts             ticker-board canvas texture generator
  crash/camera.ts             camera choreography (keyframed spline)
  crash/palette.ts            V1 ember palette, V2 arctic palette
  crash/MarketCrash.tsx       Remotion component (font loading, renderer, sparks, vignette)
```
