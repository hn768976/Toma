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
For a ProRes master add `--codec=prores --prores-profile=4444`.

720p previews: add `--scale=0.3333333333333333` (gives exactly 1280×720).

## 6K stills (6000×3375)

```bash
npx remotion still SpiralGalaxy-Violet out/SpiralGalaxy_Violet_6K.png --frame=300 --scale=1.5625 --gl=angle
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
  equals frame 0 exactly.

## Adding a colourway (one data row)

Edit `src/data.ts` and add one row, e.g.:

```ts
{ id: 'SpiralGalaxy_Rose', look: 'galaxy', frames: 600,
  params: { arm: '#FF5A9A', armAlt: '#FFE0F0', core: '#FFE0B0', haze: '#C02A80' } },
```

The composition appears as `SpiralGalaxy-Rose`. Parameters per look:
`inkbloom: { scenes: [c1, c2, c3] }`, `neural: { highlight, mid }`,
`lightning: { core, branch, skyTop, skyBottom, skyFlash }` (`skyTop: null` → black overlay),
`flare: { glow, core }`, `galaxy: { arm, armAlt, core, haze }`.

## Scripts

- `scripts/render.mjs` — renders 720p previews (PNG frames → H.264 CRF 16 yuv420p via Remotion),
  a PNG still each, and per-frame timings to `out/timings.json`.
- `scripts/verify-stills.mjs` — cold-start stills: middle frame of each composition and frames
  0 / 600 of a 601-frame version of each loop (`inputProps: { durationOverride: 601 }`).
- `scripts/verify.py` — probes, black ends, loop & determinism equality, overlay black levels,
  banding profiles from the **encoded mp4**, contact sheets.
