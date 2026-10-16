# Data Fountain · Code Panels · Pastel Silk · Teal HUD · Liquid Ripples

One Remotion project: **5 looks → 8 compositions**, 3840×2160 at 30 fps. Seven are seamless
20 s loops (600 frames) and one is a 15 s story (450 frames). Everything is built in code:
three.js on WebGL2 through `@remotion/three`, with no PixiJS, no MCP servers, no images and
no logos. The only binary assets are the two OFL fonts.

| # | Deliverable name | Composition ID | Look | Engine | Frames |
|---|---|---|---|---|---|
| 1 | `DataFountain_Story` | `DataFountain-Story` | 3D icon cloud + ring platform + light fountain, built up as a story | three.js | 450 |
| 2 | `DataFountain_Loop` | `DataFountain-Loop` | the finished scene, as a loop | three.js | 600 |
| 3 | `CodePanels_Dark` | `CodePanels-Dark` | ~60 code cards on a periodic depth layout, per-card DoF, left lens flare | three.js | 600 |
| 4 | `PastelSilk_PinkBlue` | `PastelSilk-PinkBlue` | full-screen fragment shader, iridescent pastel silk | shader | 600 |
| 5 | `PastelSilk_PeachMint` | `PastelSilk-PeachMint` | same, peach/mint palette | shader | 600 |
| 6 | `TealHUD_Soft` | `TealHUD-Soft` | misty teal dashboard plane, ticking widgets, soft focus | three.js | 600 |
| 7 | `LiquidRipples_White` | `LiquidRipples-White` | top-down milk ripples (satin, wrap lighting) | three.js | 600 |
| 8 | `LiquidRipples_Black` | `LiquidRipples-Black` | the same on glossy black ink (two strip lights) | three.js | 600 |

> Remotion only allows `a-z A-Z 0-9 -` in composition IDs, so the IDs use `-` where the
> deliverable names use `_`.

## Setup

```bash
npm install          # versions are pinned in package.json
npx remotion studio  # preview (the studio draws the canvas at half size to stay fluid)
```

## The Chromium GL flag

`remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("angle")`. On the command line
this is the same as **`--gl=angle`**. WebGL2 goes through ANGLE: on a machine with a GPU ANGLE
uses the GPU, and on a headless server without one it falls back to SwiftShader on the CPU.
Both give the same pixels; SwiftShader is just much slower. WebGPU is not used.

## 4K render commands

```bash
npx remotion render DataFountain-Story   out/DataFountain_Story.mp4   --gl=angle
npx remotion render DataFountain-Loop    out/DataFountain_Loop.mp4    --gl=angle
npx remotion render CodePanels-Dark      out/CodePanels_Dark.mp4      --gl=angle
npx remotion render PastelSilk-PinkBlue  out/PastelSilk_PinkBlue.mp4  --gl=angle
npx remotion render PastelSilk-PeachMint out/PastelSilk_PeachMint.mp4 --gl=angle
npx remotion render TealHUD-Soft         out/TealHUD_Soft.mp4         --gl=angle
npx remotion render LiquidRipples-White  out/LiquidRipples_White.mp4  --gl=angle
npx remotion render LiquidRipples-Black  out/LiquidRipples_Black.mp4  --gl=angle
```

The config already sets H.264, `yuv420p`, CRF 16 and PNG intermediate frames. PNG matters
here because JPEG frames would wipe out the dither. It also sets concurrency 2; raise it with
`--concurrency=N` on a bigger machine. Every frame is a pure function of its index, so
out-of-order multi-tab rendering is safe.

**6K still (6000×3375).** `--scale=1.5625` gives 3840×1.5625 = 6000:

```bash
npx remotion still DataFountain-Loop out/DataFountain_Loop_6K.png --frame=300 --scale=1.5625 --gl=angle
```

The drawing buffer follows the scale (`devicePixelRatio`), so stills are rendered natively at
6000×3375, not upscaled. All sizes in the shaders (line widths, point sizes, blur radii, CoC)
are written in resolution-independent units.

**720p previews** use `--scale=0.3333333333333333`, which gives exactly 1280×720
(checked with ffprobe). See `scripts/render-previews.sh`.

## Measured render times

Measured in a cloud container with **4 vCPUs and no GPU**, so WebGL2 ran on ANGLE →
SwiftShader (CPU). Per-frame figures were measured one frame at a time (concurrency 1) as
(time for 11 frames − time for 1 frame) / 10, which leaves out bundling and browser start-up.

| # | Composition | 720p s/frame (conc. 1) | Full 720p preview, wall clock (conc. 2) | 4K estimate, this CPU (conc. 1) |
|---|---|---|---|---|
| 1 | DataFountain_Story | 2.03 | 450 fr in 885 s (1.97 s/fr) | ≈ 8 s/fr → ≈ 60 min |
| 2 | DataFountain_Loop | 2.20 | 600 fr in 1197 s (2.00 s/fr) | **8.69 s/fr measured** → ≈ 87 min |
| 3 | CodePanels_Dark | 2.04 | 600 fr in 1061 s (1.77 s/fr) | ≈ 7.5 s/fr → ≈ 75 min |
| 4 | PastelSilk_PinkBlue | 0.54 | 600 fr in 326 s (0.54 s/fr) | ≈ 3.5 s/fr → ≈ 35 min |
| 5 | PastelSilk_PeachMint | 0.67 | 600 fr in 338 s (0.56 s/fr) | ≈ 3.5 s/fr → ≈ 35 min |
| 6 | TealHUD_Soft | 1.86 | 600 fr in 1131 s (1.89 s/fr) | ≈ 6.5 s/fr → ≈ 65 min |
| 7 | LiquidRipples_White | 1.21 | 600 fr in 695 s (1.16 s/fr) | **3.96 s/fr measured** → ≈ 40 min |
| 8 | LiquidRipples_Black | 1.28 | 600 fr in 722 s (1.20 s/fr) | ≈ 4.2 s/fr → ≈ 42 min |

**Timed 4K frames (3840×2160, scale 1):**

- DataFountain_Loop: **8.69 s/frame**.
- LiquidRipples_White: **3.96 s/frame**.

At 4K the fixed cost per frame (screenshot, PNG encode, R3F/React update) weighs less, so
4K costs about 3.3–4× the 720p time, not 9×. The other 4K figures are estimates scaled from
those two measured ratios. With the whole pack on this CPU-only box at concurrency 1, all
8 compositions take ≈ 7.5 h. Expect several times faster at higher concurrency on a many-core
machine, and far faster on a real GPU, where ANGLE uses hardware GL and these shaders run
in milliseconds. There, screenshot and PNG encoding (≈ 0.3–0.6 s per 4K frame) dominate.

## How to add a colourway (one data row)

Every version is one row in `src/versions.ts`. Copy a row, give it a new `id`, and change its
params. Nothing else needs touching: `Root.tsx` registers a composition for each row. Example:

```ts
{ id: "PastelSilk_LilacSky", look: "pastelSilk", frames: 600, loop: true,
  params: { palette: ["#B8C8FF", "#E8B8F0", "#D0C0F8", "#FFFFFF"], deep: "#6A7CF0" } },
```

The params each look takes:

- **Pastel Silk:** `palette` takes four sRGB stops (cool, warm, middle, white) and `deep` is the colour of the fold troughs.
- **Liquid Ripples:** `shading` is `"satin"` (milky, wrap lighting) or `"ink"` (glossy, strip lights), and `liquid` is the albedo.
- **Data Fountain:** `bg`, `cyan` and `blue` set the fountain gradient. `icon`, `red` and `accentBlue` set the cloud tints. `mode` is `"story"` or `"loop"`.
- **Code Panels:** `white`, `green` and `orange` set the code colours and `flare` sets the flare colour.
- **Teal HUD:** `ink`, `accent`, `bgDark`, `bgLight` and `mist`.

## Determinism

Remotion renders frames out of order, across several tabs, so this project follows these rules:

- Every on-screen value comes from `useCurrentFrame()`. It is stored in a layout effect, and
  the only drawing call is a priority-1 R3F `useFrame` callback, which ignores R3F's clock
  entirely (`src/lib/Stage.tsx`).
- There is no `Math.random()` at render time and no `Date.now()`. No visual state lives in
  `useState`, and nothing carries over between frames. Layouts come from `mulberry32` seeds
  at module level. Shader noise uses integer PCG hashes, not `sin()` hashes.
- No TAA or accumulation buffers are used.
- Fonts and canvas textures are built once per tab, behind `delayRender`
  (`use(promise)` inside ThreeCanvas' Suspense).
- **Loops:** each loop's phase is `θ = 2π·f/600`.
  - Every motion uses an integer number of cycles: ring rotations, fountain point paths
    (`s = fract(u0 + k·f/600)`), drift and twinkle, the code panels' depth layout (it shifts by
    exactly one period L), and the HUD camera path and fades.
  - HUD values tick every P frames, where P divides 600.
  - Ripples launch a ring every 75 frames. The ring ages are `(f mod 75) + 75j`, each ring is
    born at zero amplitude, and it is windowed to exactly zero before its slot retires.
  - Grain uses `frame mod 600`.
- `--props='{"loopCheck":true}'` makes the loops 601 frames long, for the frame 0 vs 600 check.

## Banding

These are the measures against banding:

- The scene renders to half-float targets (`RGBA16F`), and bloom runs in half-float.
- The final pass adds a ±1/255 dither. For Looks 3, 4 and 5 it comes from a fixed 64×64
  blue-noise map, generated in code (void-and-cluster, seeded). The other looks use a
  triangular hash.
- Grain of 1.5% comes from a fixed hash of pixel position and `frame mod 600`.
- Looks 2 and 8 fade the grain to zero below about 3% luminance.
- Pastel Silk is a single shader with no intermediate target, so it is float all the way to
  the dithered 8-bit output.

The check was done on frames decoded from the **encoded mp4s**, not the preview.
`scripts/banding-check.py` reads luma along lines through the navy glow, the black around the
flare, the pastel gradients, the teal mist, and the white and black liquid.

Result: **smooth everywhere.** Each area was contrast-stretched 30–50× after a 7-px box
blur to average out the grain. The stretched images show smooth gradients with no contour
steps. The luma spans of the plain areas were:

| Area | Frame | Luma span |
|---|---|---|
| Navy sky | story f30 | 3.9 levels |
| Teal mist highlight | f300 | 2.2 levels |
| Peach gradient | f300 | 7.8 levels |
| Pastel pink-blue | f450 | 39 levels, mostly fold detail |
| White liquid dish | f300 | 9.5 levels |
| Black ink dish | f300 | 3.7 levels, grain faded |
| Black around the flare | f300 | flare falloff |

The profile script (`scripts/banding-check.py`) also reports the largest jump between 4-px
bins. That figure is ≤ 1.2 levels on plain gradient lines. Where lines cross real content
(icons, code text, silk folds), it flags those edges, not banding.

## Fonts and licences

Both fonts are self-hosted in `public/fonts`, with their licence texts beside them:

- **JetBrains Mono** (`OFL-JetBrainsMono.txt`) is used for code and HUD numbers.
- **Inter** (`OFL-Inter.txt`) is used for labels.

Both are under the SIL Open Font License 1.1.

The icons are generic pictograms drawn with Canvas 2D: globe, pin, Wi-Fi, cloud, gear, chart,
mail, people and lock. The code is a made-up assembly-style grammar with a fixed seed
(`src/looks/codeText.ts`). There are no logos or brands anywhere.

## Scripts

| Script | What it does |
|---|---|
| `scripts/render-previews.sh OUT` | Full PNG-sequence render at 720p, then an H.264/yuv420p/CRF 16 mp4 and a mid-frame PNG still |
| `scripts/loop-check.sh OUT` | 601-frame loops: frame 0 vs frame 600, pixel for pixel |
| `scripts/determinism-check.sh OUT` | Cold single-frame still vs the same frame of the full render |
| `scripts/banding-check.py OUT` | Luma profiles from the encoded mp4s |

## Completion checklist

- [x] 8 compositions, one data row each, at 3840×2160 / 30 fps: 450 frames for the story, 600 for the loops.
- [x] three.js on WebGL2 via `@remotion/three` for Looks 1, 2, 4 and 5; a single full-screen fragment shader for Look 3; no PixiJS, no WebGPU.
- [x] OFL fonts only (JetBrains Mono, Inter), with licences; no logos; icons drawn in code; made-up pseudo-assembly.
- [x] Step 1: all 8 previews are 1280×720, h264, yuv420p, 30/1, no audio, 15.0 s / 20.0 s (`--scale=0.3333333333333333` gives exactly 1280×720, so no fallback was needed).
- [x] Step 2: in the 601-frame loop check, frame 0 = frame 600 pixel for pixel for all 7 loops.
- [x] Step 3: a cold single-frame render of the middle frame matches the full render byte for byte (same PNG file hash) for all 8.
- [x] Step 4: banding check on frames decoded from the encoded mp4s: smooth.
- [x] Step 5: contact sheets checked (8 frames for the story, 5 per loop).
- [x] Step 6: motion check (story in full, 2 s around frame 300 per loop): no frame-to-frame spikes; text and lines stable; points stream; rings are born at zero amplitude.
- [x] Steps 7–8: compared against the references; 3 rounds of independent comparison per look.
- [x] `npm install && npx remotion studio` works from a clean copy.
