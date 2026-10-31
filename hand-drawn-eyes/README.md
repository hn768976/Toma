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

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, no audio, PNG frames and the
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
  (delayRender timeout is raised to 10 min). They are painted in a fixed order, followed by
  one throwaway composite, so a cold-start frame is byte-identical to the same frame mid-render.
- **Unknown person:** each figure variant is a fresh scribble (Rough.js zigzag fill +
  perfect-freehand loops along the outline and loopy random walks inside) pre-rendered into
  an offscreen canvas. The re-scribble (look 7, frames 92–99, 192–199, 292–299) and the
  flares (look 8) are drawn live.
- Look-dev harness without Remotion: `node tools/snap.mjs <outDir> <dpr> <Id_With_Underscores>:<frames>`.

## Timings

Measured in the build container (4 vCPU, no GPU; headless Chrome, SwiftShader for WebGL,
Remotion default concurrency). Wall-clock times include browser start-up and the H.264 encode.

**720p previews** (`--scale=0.3333333333333333`, 300 frames):

| Composition | Total | Per frame |
|---|---|---|
| ScribbleEyes_Blue | 45.5 s | 0.15 s |
| ScribbleEyes_OrangeOnWhite | 46.0 s | 0.15 s |
| CrayonEyes_Blue | 313.9 s | 1.05 s * |
| CrayonEyes_Amber | 318.9 s | 1.06 s * |
| PaleEyes_Dark | 43.8 s | 0.15 s |
| EyesCrowd_Dark | 49.5 s | 0.17 s |
| UnknownPerson_Cycle | 42.6 s | 0.14 s |
| UnknownPerson_Lineup | 53.2 s | 0.18 s |

\* Most of the crayon time is p5.brush painting its textures (8 per look, at full 4K
resolution) once in each browser tab, about 30 s per tab on a CPU rasteriser; after
that a crayon frame composites in a few milliseconds. On a machine with a GPU this
drops a lot.

**4K** (`--scale=1`, PNG frames, one tab):

| Composition | One cold frame (incl. browser start) | Warm, per frame (20 frames) |
|---|---|---|
| ScribbleEyes_Blue | 2.9 s | 0.63 s |
| EyesCrowd_Dark | 3.7 s | 1.64 s |

A full 4K render of one look is therefore roughly 2–8 minutes on a similar 4-core
machine (crayon looks add the one-off texture painting per tab).

## Verification tools

- `tools/verify.py probe <mp4…>` — 1280×720, 30/1, H.264, yuv420p, no audio, 10.0 s, 300 frames.
- `tools/verify.py bg <mp4> <0|255>` — 50 empty points × 9 frames must equal the background (±1).
- `tools/check-loops.sh` — frame 300 vs frame 0 (301-frame `loopCheck` render) and a cold-start
  frame 150 vs the full PNG-sequence render, byte for byte.
- `tools/boil-check.py`, `tools/acting-check.py`, `tools/sheet.py` — boil cadence, blink/gaze
  analysis and contact sheets on a PNG sequence.

## Notes on matching the references

The brief's numbers were kept where it gives them (figure heights 60% / 55%, scribble-eye width
~13–16%, pale eyes ~30% each, crayon pair ~80% wide). Where the brief says "as in the reference",
the reference won: the crayon eyes sit at about the frame's vertical centre (as in the
reference clip) rather than in the top third.
