# Hand-drawn Eyes & Unknown Person — Remotion, 30 fps, 4K

Eight 10-second seamless loops (300 frames, frame 300 = frame 0), all defined at
**3840×2160**, 30 fps, 16:9, drawn with **Canvas 2D** plus three hand-drawn libraries:

| Library | Version | Used for |
|---|---|---|
| perfect-freehand | 1.2.3 | eye outlines, iris/slit strokes, scribble loops, the `?` |
| roughjs | 4.6.6 | the scratch field (1–2), the zigzag scribble fill of the figures (7–8) |
| p5.brush (standalone build) | 2.2.3 | the waxy crayon grain of whites, irises, pupils and catchlights (3–4) |

| File name (output) | Composition id (Remotion) | Background | Blend mode |
|---|---|---|---|
| `ScribbleEyes_Blue.mp4` | `ScribbleEyes-Blue` | black | **Screen** |
| `ScribbleEyes_OrangeOnWhite.mp4` | `ScribbleEyes-OrangeOnWhite` | white | **Multiply** |
| `CrayonEyes_Blue.mp4` | `CrayonEyes-Blue` | black | **Screen** |
| `CrayonEyes_Amber.mp4` | `CrayonEyes-Amber` | black | **Screen** |
| `PaleEyes_Dark.mp4` | `PaleEyes-Dark` | black | **Screen** |
| `EyesCrowd_Dark.mp4` | `EyesCrowd-Dark` | black | **Screen** |
| `UnknownPerson_Cycle.mp4` | `UnknownPerson-Cycle` | black | **Screen** |
| `UnknownPerson_Lineup.mp4` | `UnknownPerson-Lineup` | black | **Screen** |

Remotion doesn't allow `_` in composition ids, so the ids use `-`; render them to the
`_` file names as below. Empty areas are exactly (0,0,0) on the black clips and exactly
(255,255,255) on the white clip.

## Install

```bash
npm ci          # Node 18+; .npmrc skips p5's peer dependency (the standalone p5.brush build doesn't need it)
npm run dev     # Remotion Studio
```

## Render at 4K

```bash
npx remotion render src/index.ts ScribbleEyes-Blue          out/ScribbleEyes_Blue.mp4
npx remotion render src/index.ts ScribbleEyes-OrangeOnWhite out/ScribbleEyes_OrangeOnWhite.mp4
npx remotion render src/index.ts CrayonEyes-Blue            out/CrayonEyes_Blue.mp4
npx remotion render src/index.ts CrayonEyes-Amber           out/CrayonEyes_Amber.mp4
npx remotion render src/index.ts PaleEyes-Dark              out/PaleEyes_Dark.mp4
npx remotion render src/index.ts EyesCrowd-Dark             out/EyesCrowd_Dark.mp4
npx remotion render src/index.ts UnknownPerson-Cycle        out/UnknownPerson_Cycle.mp4
npx remotion render src/index.ts UnknownPerson-Lineup       out/UnknownPerson_Lineup.mp4
```

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, PNG frames and the
SwiftShader GL renderer. For a 720p preview add `--scale=0.3333333333333333`
(or run `tools/render-previews.sh`). Add `--props='{"loopCheck":true}'` to render 301
frames and compare frame 300 with frame 0.

The canvas backing store follows Remotion's `--scale`, so 4K renders rasterise at
full 3840×2160 (not an upscale) and previews rasterise at 1280×720 from the same code.

## Tweaking (one data row each)

- **Iris colours** — `src/looks/scribbleEyes.ts` bottom (`iris:` / `pupil:` per clip) and
  `src/looks/crayonEyes.ts` bottom (`iris:`, `irisRim:`, `irisCore:` per clip).
  Pale eyes: `PALE.white` / `PALE.rim` in `src/looks/paleEyes.ts`.
- **Number of eyes in the crowd** — `CROWD.pairs` in `src/looks/paleEyes.ts`
  (`{ large: 4, medium: 8, small: 12 }` = 24 pairs).
- **Boil speed** — `boilHold` (frames each drawing is held, default 3) in `SCRIBBLE`,
  `CRAYON`, `PALE` and `FIGURE`; the scratch field uses `SCRIBBLE.fieldHold` (2).
  Keep `boilHold × boilVariants` a divisor of 300 so the loop stays seamless.

## How it works

- Every value is a pure function of `useCurrentFrame()`. No `Math.random()`: all
  randomness is `mulberry32` seeded from the composition id, the variant index and a salt
  (`src/lib/rng.ts`); Rough.js `seed` and p5.brush `brush.seed()` / `brush.noiseSeed()`
  come from the same seeds.
- **Boil:** each drawn element has 4 seeded variants held 3 frames each (12-frame cycle,
  25 per loop). The scratch field has 6 variants redrawn every 2 frames and drifts in a
  slow swirl (each stroke's life cycle divides 300). The pale eyes boil at half amplitude.
- **Acting** (`src/lib/acting.ts`): seeded glances (eased, both eyes in step), 2–3 blinks,
  a suspicious narrow and (looks 1, 3, 4) a short widen, held on twos; it starts and ends
  on the rest pose.
- **Crayon textures:** p5.brush needs a WebGL2 context internally, so it is used only to
  paint grain masks, once per variant, on a hidden canvas (black crayon on white, turned
  into an alpha mask and coloured in Canvas 2D). Every frame is composited in Canvas 2D.
  The first frame a browser tab renders for each variant pays ~8 s of painting at 4K
  (delayRender timeout is raised to 10 min).
- **Unknown person:** each figure variant is a fresh scribble (Rough.js zigzag fill +
  perfect-freehand loops along the outline and loopy random walks inside) pre-rendered into
  an offscreen canvas. The re-scribble (look 7, frames 92–99, 192–199, 292–299) and the
  flares (look 8) are drawn live.
- Look-dev harness without Remotion: `node tools/snap.mjs <outDir> <dpr> <Id_With_Underscores>:<frames>`.

## Timings

TIMINGS_PLACEHOLDER
