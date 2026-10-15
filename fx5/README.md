# Ink Bloom · Neural Paths · Lightning · Flare Pass · Spiral Galaxy

Ten motion-graphic compositions (5 looks × 2 versions) built entirely in code with
**Remotion 4.0.515** and **PixiJS 8.22 on WebGL2**. 30 fps, 16:9, defined at 3840×2160.

| Composition id (Remotion) | Output name | Length | Notes |
|---|---|---|---|
| `InkBloom-Multicolour` | `InkBloom_Multicolour` | 14 s (420 f) | 2D ink blots: lime → sage → red → black |
| `InkBloom-Violet` | `InkBloom_Violet` | 14 s | lavender → violet → hot pink → black |
| `NeuralPaths-Green` | `NeuralPaths_Green` | 20 s loop (600 f) | posterised glowing brain, dark pathways |
| `NeuralPaths-Magenta` | `NeuralPaths_Magenta` | 20 s loop | magenta-pink version |
| `Lightning-BlueViolet` | `Lightning_BlueViolet` | 20 s loop | bolts on a deep-blue sky gradient |
| `Lightning-BlackOverlay` | `Lightning_BlackOverlay` | 20 s loop | **overlay** — pure black, use Screen / Add |
| `FlarePass-Orange` | `FlarePass_Orange` | 8 s (240 f) | **overlay transition** — Screen / Add |
| `FlarePass-Blue` | `FlarePass_Blue` | 8 s | **overlay transition** — Screen / Add |
| `SpiralGalaxy-Violet` | `SpiralGalaxy_Violet` | 20 s loop | 160k projected star particles |
| `SpiralGalaxy-Teal` | `SpiralGalaxy_Teal` | 20 s loop | cool teal / white version |

(Remotion ids may not contain `_`, so ids use `-`; render to the `_` file names.)

## Setup

```bash
npm install
npx remotion studio          # preview (Studio draws the WebGL canvas at ≤1920 wide)
```

### Chromium GL flag

PixiJS needs WebGL2 in headless Chromium. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer('angle')`; on the CLI the equivalent is **`--gl=angle`**.
With no GPU, ANGLE falls back to SwiftShader (software) — that is what the timings below measured.
The config also reuses a Playwright headless shell at
`/opt/pw-browsers/...` if present; elsewhere Remotion downloads its own.

## 4K render commands

```bash
npx remotion render InkBloom-Multicolour   out/InkBloom_Multicolour.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render InkBloom-Violet        out/InkBloom_Violet.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render NeuralPaths-Green      out/NeuralPaths_Green.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render NeuralPaths-Magenta    out/NeuralPaths_Magenta.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render Lightning-BlueViolet   out/Lightning_BlueViolet.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render Lightning-BlackOverlay out/Lightning_BlackOverlay.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render FlarePass-Orange       out/FlarePass_Orange.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render FlarePass-Blue         out/FlarePass_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render SpiralGalaxy-Violet    out/SpiralGalaxy_Violet.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render SpiralGalaxy-Teal      out/SpiralGalaxy_Teal.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

Frames are captured as PNG (`Config.setVideoImageFormat('png')`), never JPEG, to keep gradients clean.
Add `--concurrency=N` to taste; each Chromium tab owns one WebGL2 context.
For a ProRes master add `--codec=prores --prores-profile=4444`.

720p previews: add `--scale=0.3333333333333333` (gives exactly 1280×720).

## 6K stills (6000×3375)

```bash
npx remotion still SpiralGalaxy-Violet out/SpiralGalaxy_Violet_6K.png --frame=300 --scale=1.5625 --gl=angle --image-format=png
```

(Any id works; `--scale=1.5625` × 3840×2160 = 6000×3375. The WebGL backing store follows the scale,
so the still is rendered natively at 6K, not upscaled.)

## Overlays: Screen / Add

`Lightning_BlackOverlay`, `FlarePass_Orange` and `FlarePass_Blue` are made for **Screen** or **Add**
(Linear Dodge) blending over footage. Their black is exactly 0: the final pass subtracts a small
black floor and fades grain/dither to zero below ~3 % luminance, so nothing lifts the plate.

## How it works

- `src/lib/PixiStage.tsx` — one PixiJS WebGL2 renderer per composition. **No ticker**: the stage is
  drawn manually, synchronously, once per Remotion frame from `useCurrentFrame()` only. Init is
  async and guarded by `delayRender`/`continueRender`. Remotion's `--scale` becomes the canvas
  backing-store size, so 720p renders cost 720p, 4K renders are native 4K.
- Every intermediate pass renders into **`rgba16float`** (half-float) targets; the final pass adds
  ±1/255 triangular **dither** and ~1.5 % **grain** from an integer hash of
  `(pixel x, pixel y, frame mod composition length)` — never `Math.random()`.
- Randomness: `mulberry32` seeded at module level; bolt shapes from a hash of the strike number;
  flicker from a hash of the frame bucket; galaxy stars generated once and rotated by formula.
- `src/looks/inkbloom.ts` — domain-warped fbm thresholds grown from seed points, ridged crackle,
  cell-based round droplets, black holes eating the blots, a 2–3 frame glitch at each scene change.
- `src/looks/neural.ts` — brain silhouette SDF (smooth union of lobes), gyri from warped noise,
  ~40 seeded branching pathways drawn as anti-aliased capsules with travelling pulses,
  5-level posterise, highlight bloom, closed Catmull-Rom camera path (push in / drift / pull back).
- `src/looks/lightning.ts` — midpoint-displaced polylines, 7 strikes whose lengths and gaps sum to
  exactly 600 frames, capsule rendering with max blending, multi-level bloom for the glow.
- `src/looks/flare.ts` — analytic flare: core, glow, anamorphic bands, faint ghosts and ring.
- `src/looks/galaxy.ts` — 160,000 points; 3D disc positions are rotated and projected in the vertex
  shader. Each radius band turns a **whole number of turns per 600 frames** (3 / 2 / 1, inner fastest);
  the two-arm density-wave pattern turns half a turn per loop (it is 2-fold symmetric), so frame 600
  equals frame 0 exactly. The star pass is drawn 4 times per frame at sub-frame phases (a 180° shutter)
  for deterministic motion blur.

## Adding a colourway (one data row)

Edit `src/data.ts` and add one row, e.g.:

```ts
{ id: 'SpiralGalaxy_Rose', look: 'galaxy', frames: 600,
  params: { arm: '#FF5A9A', armAlt: '#FFE0F0', core: '#FFE0B0', haze: '#C02A80', coreWarmth: 1 } },
```

The composition appears as `SpiralGalaxy-Rose`. Parameters per look:
`inkbloom: { scenes: [c1, c2, c3] }`, `neural: { highlight, mid }`,
`lightning: { core, branch, skyTop, skyBottom, skyFlash }` (`skyTop: null` → black overlay),
`flare: { glow, core }`, `galaxy: { arm, armAlt, core, haze, coreWarmth }`.

## Measured render times

Machine: 4-core cloud container, **no GPU** — Chromium `--gl=angle` falls back to SwiftShader (software
WebGL2). A real GPU will be many times faster; treat these as a worst case.

### 720p previews (`--scale=0.3333333333333333`, concurrency 3)

"Per frame" is the time one tab spends on a frame; "effective" is wall time ÷ frames with 3 tabs in parallel.

| Composition | Frames | Per frame (ms) | Effective (ms/frame) | Wall (s) |
|---|---|---|---|---|
| InkBloom_Multicolour | 420 | 2793 | 933 | 392 |
| InkBloom_Violet | 420 | 2835 | 948 | 398 |
| NeuralPaths_Green | 600 | 2355 | 787 | 472 |
| NeuralPaths_Magenta | 600 | 2367 | 791 | 475 |
| Lightning_BlueViolet | 600 | 856 | 287 | 172 |
| Lightning_BlackOverlay | 600 | 820 | 275 | 165 |
| FlarePass_Orange | 240 | 592 | 201 | 48 |
| FlarePass_Blue | 240 | 580 | 197 | 47 |
| SpiralGalaxy_Violet | 600 | 2740 | 917 | 550 |
| SpiralGalaxy_Teal | 600 | 2598 | 868 | 521 |

### Real 4K frames (scale 1, one tab, `scripts/time-4k.mjs`)

| Composition | Frame | Time |
|---|---|---|
| **NeuralPaths_Green** | 300 | **7.8 s** (next frame 7.5 s) |
| **SpiralGalaxy_Violet** | 300 | **3.9 s** (next frame 3.7 s) |
| InkBloom_Multicolour | 300 | 8.4 s (7.5 s) |
| Lightning_BlueViolet | 300 | 2.9 s (2.6 s) |
| FlarePass_Orange | 120 | 2.6 s (2.2 s) |

### 4K estimates on this machine (frames × measured 4K frame time, one tab)

| Look (per version) | Estimate |
|---|---|
| Ink Bloom (420 f × ~7.9 s) | ~55 min |
| Neural Paths (600 f × ~7.6 s) | ~76 min |
| Lightning (600 f × ~2.7 s) | ~27 min |
| Flare Pass (240 f × ~2.4 s) | ~10 min |
| Spiral Galaxy (600 f × ~3.8 s) | ~38 min |
| **All 10 compositions** | **~6.9 h** single-tab; roughly 2.5–4 h with 3 tabs (720p scaled ~3× with 3 tabs; 4K is more memory-bound, so expect less) |

## Banding check

Done on frames decoded from the **encoded mp4s** (`scripts/verify.py`, plus contrast-stretched crops):

- Lightning sky (column through the gradient, 16 px averaged): code values fall smoothly from ~133 to ~5;
  max step between neighbouring rows 3.1, 95th percentile 1.8 — no plateaus where dither is active.
  Under heavy contrast stretch, single-code-value contours remain only in the darkest band (~code 4–15),
  which is where the spec requires grain/dither to fade to zero (below ~3 % luminance). They are not
  visible at normal contrast.
- Flare glow (row through the source): smooth ramp 1 → 183, max step 2.6–2.9 (on the steep core flank).
- Galaxy haze and Neural glow: no visible banding in stretched crops.
- All passes render into `rgba16float`; the final pass adds ±1/255 triangular dither and ~1.5 % grain from
  `pcg3d(x, y, frame mod length)`, both gated off below ~3 % luminance.

## Completion checklist (verify loop results on the final encodes)

- [x] 10 previews, 1280×720, 30/1, h264, yuv420p, **no audio**; durations 14.0 / 8.0 / 20.0 s
- [x] 10 PNG stills at 720p
- [x] Loops (Neural ×2, Lightning ×2, Galaxy ×2): 601-frame versions, frame 0 vs 600 **pixel-identical**
- [x] Ink Bloom and Flare Pass: first and last frames fully black (max code value 0)
- [x] Determinism: middle frame rendered cold (fresh browser) is **byte-identical** to the same frame of the full render, all 10
- [x] Overlays 6, 7, 8: 30 samples per checked frame in black areas (pixels > 96 px at 720p from anything brighter than code 6) — all **0,0,0**
- [x] Banding checked on the encoded mp4s (above)
- [x] Contact sheets reviewed (`out/verify/*_sheet.png` when you run `scripts/verify.py`)
- [x] Reference comparison by separate agents, 3 rounds per look (1, 3, 5, 7, 9); fixes carried to the second versions
- [x] No text, logos or brands; no MCP servers; no `Math.random()`, `Date.now()` or ticker at render time

## Scripts

- `scripts/render.mjs` — renders 720p previews (PNG frames → H.264 CRF 16 yuv420p via Remotion),
  a PNG still each, and per-frame timings to `out/timings.json`.
- `scripts/verify-stills.mjs` — cold-start stills: middle frame of each composition and frames
  0 / 600 of a 601-frame version of each loop (`inputProps: { durationOverride: 601 }`).
- `scripts/time-4k.mjs` — times native 4K frames (`node scripts/time-4k.mjs NeuralPaths-Green:300`).
- `scripts/debug-still.mjs` — one still with browser console output (handy when editing shaders).
- `scripts/verify.py` — probes, black ends, loop & determinism equality, overlay black levels,
  banding profiles from the **encoded mp4**, contact sheets.
