# HUD Scope · VHS Playback · TV Static · Chalk Maths · Neural Globe

One Remotion project, 8 compositions, all **3840×2160, 30 fps**. Everything is generated in code (Canvas 2D, WebGL2 fragment shaders, three.js), deterministic from the frame number.

| Output file | Composition id | Length | Loop | Engine | Blend mode in the edit |
|---|---|---|---|---|---|
| `HUDScope_Violet.mp4` | `HUDScope-Violet` | 20s | yes (600f) | Canvas 2D | **Screen** |
| `VHSPlayback_OSD.mp4` | `VHSPlayback-OSD` | 20s | no (the timecode counts) | WebGL2 shader + Canvas 2D | Overlay or Screen |
| `VHSPlayback_Clean.mp4` | `VHSPlayback-Clean` | 20s | yes (600f) | WebGL2 shader | Overlay or Screen |
| `TVStatic_Datamosh.mp4` | `TVStatic-Datamosh` | 10s | no | WebGL2 shader | Overlay or Screen (or Normal) |
| `TVStatic_Transition.mp4` | `TVStatic-Transition` | 2s | no | WebGL2 shader | Normal over the cut (Screen/Overlay also work) |
| `ChalkMath_Flythrough.mp4` | `ChalkMath-Flythrough` | 20s | yes (600f) | three.js (cards drawn in Canvas 2D) | **Screen** |
| `ChalkMath_Write.mp4` | `ChalkMath-Write` | 10s | no (write-on, then hold) | Canvas 2D | **Screen** |
| `NeuralGlobe_Labels.mp4` | `NeuralGlobe-Labels` | 20s | yes (600f) | three.js | **Screen** |

Remotion doesn't allow `_` in composition ids, so the ids use `-`. The output files keep the `_` names.

Clips 1, 6, 7 and 8 are exactly `(0,0,0)` wherever nothing is drawn, so Screen mode leaves your footage untouched there. For the transition, put the cut between 0.2s and 1.6s (frames 6–47). Every pixel is covered in that window.

## Setup

```bash
npm ci          # Node 18+; versions are pinned in package.json / package-lock.json
npm run dev     # Remotion Studio
```

## 4K render commands

All renders need WebGL2 through ANGLE. `remotion.config.ts` already sets `--gl=angle`, PNG frames, H.264 and yuv420p, but it is spelled out here as well:

```bash
npx remotion render HUDScope-Violet      out/HUDScope_Violet.mp4      --gl=angle --muted --crf=16
npx remotion render VHSPlayback-OSD      out/VHSPlayback_OSD.mp4      --gl=angle --muted --crf=12
npx remotion render VHSPlayback-Clean    out/VHSPlayback_Clean.mp4    --gl=angle --muted --crf=12
npx remotion render TVStatic-Datamosh    out/TVStatic_Datamosh.mp4    --gl=angle --muted --crf=12
npx remotion render TVStatic-Transition  out/TVStatic_Transition.mp4  --gl=angle --muted --crf=12
npx remotion render ChalkMath-Flythrough out/ChalkMath_Flythrough.mp4 --gl=angle --muted --crf=16
npx remotion render ChalkMath-Write      out/ChalkMath_Write.mp4      --gl=angle --muted --crf=16
npx remotion render NeuralGlobe-Labels   out/NeuralGlobe_Labels.mp4   --gl=angle --muted --crf=16
```

- **ProRes for editing:** add `--codec=prores --prores-profile=4444`.
- **720p previews:** add `--scale=0.3333333333333333`. This is what `scripts-render-previews.sh` does. Canvases draw at the output resolution, so previews are not 4K downsampled.
- **Loop check:** pass `--props='{"loopCheck":true}'` to a loop composition to make it 601 frames, so you can render frame 600 and compare it with frame 0.

## Changing colours, words and formulas

| What | Where |
|---|---|
| HUD colours (grid `#14112A`, violet `#7A6CFF` family, sine `#8A2048`, teal `#3ED6B0`, …) | `src/hud/palette.ts` |
| Globe colour (lines, nodes, labels, rim) | `GLOBE_COLOR` in `src/globe/labels.ts` (RGB 0–1) |
| Globe label words and label count | `GLOBE_LABELS`, `GLOBE_LABEL_COUNT` in `src/globe/labels.ts` |
| Chalk formulas | `FORMULAS` in `src/chalk/content.ts`: strings plus `{sup}`, `{sub}`, `{sqrt}`, `{frac:[num,den]}` |
| Chalk diagrams | `src/chalk/diagrams.ts`, listed in `DIAGRAM_NAMES` in `content.ts` |
| Write-on board layout (position, scale, tilt per item) | `LAYOUT` in `src/chalk/ChalkWrite.tsx` |
| VHS OSD text / position | `src/vhs/VHSPlayback.tsx` |
| Datamosh bursts (position, size, timing, motion direction) | `DATAMOSH_BURSTS` / `TRANSITION_BURST` in `src/static/TVStatic.tsx` |

Most buyers tint HUD Scope and Neural Globe in the edit instead (both are Screen overlays on black).

## Timings

| Clip | Event |
|---|---|
| VHS | A tracking line every 2.3–3.5s (7 per 20s), rolling or holding for 4–25 frames (`src/vhs/tracking.ts`). Flicker changes every 2 frames. The timecode counts real seconds, `00:00:00` → `00:00:19`. |
| TV Static Datamosh | Burst 1 (large, bottom-left): 0.8s–~4.1s. Burst 2 (small, top-right): 5.0s–~6.8s. Burst 3 (medium, centre-right): 7.1s–~9.5s. Plain static between them. |
| TV Static Transition | 0–0.13s black, frames 4–5 rolling bars as the static snaps in, 0.2–1.6s static with one large burst (frames 12–~50), 1.6s collapses to a line, 1.9s black. |
| Chalk Write | 16 items written one after another from 0.2s to 8s, each in 0.4–0.8s, with pen-lift pauses. 8–10s hold with a chalk boil (4 variants, 3 frames each). |
| Chalk Flythrough | The camera advances exactly one depth tile per 20s, so frame 600 = frame 0. |
| Neural Globe | One camera orbit, two sphere turns and two reveal-band cycles per 20s. |
| HUD Scope | Dial ring 1 rev / 20s, inner rings −2 rev / 20s, needle 3 sweeps / 20s, bars on whole-cycle rhythms. |

## Determinism

- Every value comes from `useCurrentFrame()`.
- Layouts (cards, nodes, labels, bursts, stroke variants) come from `mulberry32` seeded at module level.
- Shader noise uses integer PCG hashes of pixel coordinates and the frame number.
- There is no `Math.random`, `Date.now`, `useFrame` or TAA.
- Fonts load behind `delayRender`.
- Shaders render into half-float targets. The final pass adds ±1/255 dither, but only where the image is above 2% brightness, so black stays 0.

## Credits and licences

- Formula handwriting: stroke-order data for **Caveat** (OFL 1.1) from **Tegaki** (MIT), copied to `src/chalk/data/caveat-strokes.json`. See `licenses/`.
- Fonts: **VT323**, **Share Tech Mono** and **Rajdhani** (all OFL 1.1), via @fontsource.
- Diagrams: **perfect-freehand** (MIT) and **Rough.js** (MIT, seeded hatching).
- All HUD and globe labels are invented. No real brands appear.

## Render times (measured)

The measurements were taken in a cloud container: 4 vCPU, no GPU, so WebGL ran in software through ANGLE/SwiftShader. A machine with a GPU will be much faster.

| Clip | 720p preview, s/frame (concurrency 3) |
|---|---|
| HUDScope_Violet | 0.063 |
| VHSPlayback_OSD | 1.046 |
| VHSPlayback_Clean | 0.885 |
| TVStatic_Datamosh | 1.346 |
| TVStatic_Transition | 0.775 |
| ChalkMath_Flythrough | 0.091 |
| ChalkMath_Write | 0.064 |
| NeuralGlobe_Labels | 0.153 |

At 4K, one frame takes about 0.83 s for ChalkMath_Flythrough and 0.59 s for NeuralGlobe_Labels (steady state, concurrency 1). The first frame needs about 6–7 s of extra start-up for bundling, the browser and texture generation.

## Maths check

All formulas on the cards are correct:

- `a² + b² = c²`
- `E = mc²`
- `π = 3.1416` (π = 3.14159…, rounded to 4 d.p.)
- `√1225 = 35` (35² = 1225)
- `x = (−b ± √(b² − 4ac)) / 2a`
- `6x² − 15xy = 3x(2x − 5y)` (3x·2x = 6x², 3x·5y = 15xy)
- `dN/dt = rN(K − N)/K` (logistic growth, = rN(1 − N/K))
- `Eₚ = mgh`
- `d = √((x₂ − x₁)² + (y₂ − y₁)²)`
- `x = √a`
- `y = x³`
- `eˣ = 1 + x + x²/2! + x³/3! + …`
- Extras: `A = πr²`, `V = 4/3 πr³`, `(a + b)² = a² + 2ab + b²`, `F = ma`.

The diagrams are labelled consistently:

- **Triangle:** the right angle is at C, opposite the hypotenuse c. Sides a = BC (opposite A) and b = CA (opposite B). The 44° mark is at A, and the drawing has BC/CA = tan 44°.
- **Golden spiral:** Fibonacci squares 8, 5, 3, 2, 1, 1 in a 13×8 rectangle, with one quarter arc per square.
- **sin/cos graph:** the hatched areas sit between sin x and the axis over 0–π and π–2π, with ticks at π and 2π.
- **Cone:** r and h are marked. **Sphere:** latitudes, a meridian and the radius r. **Venn:** A, B and C, with the triple overlap hatched.
