# Data Cube · Cloud Map · Chrome Portal · Gold Ribbon Podium · Soft Light

One Remotion project: **5 looks → 8 compositions**, 30 fps, 16:9, defined at **3840×2160**.

| Composition id | Look | Engine | Length |
|---|---|---|---|
| `DataCube-Blue` | 1 Data Cube | three.js (WebGL2) | 600 f (20 s loop) |
| `CloudMap-Story` | 2 Cloud Map | three.js (WebGL2) | 300 f (10 s story) |
| `ChromePortal-Silver` | 3 Chrome Portal | three.js (WebGL2) | 600 f loop |
| `ChromePortal-Gold` | 3 Chrome Portal | three.js (WebGL2) | 600 f loop |
| `GoldRibbonPodium-RedGold` | 4 Gold Ribbon Podium | three.js (WebGL2) | 600 f loop |
| `GoldRibbonPodium-EmeraldGold` | 4 Gold Ribbon Podium | three.js (WebGL2) | 600 f loop |
| `SoftLight-Blue` | 5 Soft Light | one full-screen fragment shader | 600 f loop |
| `SoftLight-Violet` | 5 Soft Light | one full-screen fragment shader | 600 f loop |

Everything is built in code: no image assets, no text, logos or brands. The only data file is
Natural Earth 1:110m land (`public/data/ne_110m_land.geojson`, public domain — see
`public/data/NATURAL_EARTH.md`).

## Setup

```bash
npm install
npx remotion studio          # preview / scrub
```

Node 18+ (tested on Node 22). All dependency versions are pinned in `package.json`.

## Chromium GL flag

All looks need WebGL2. Render with **`--gl=angle`** (already the default in `remotion.config.ts`).
On a machine with a GPU, ANGLE uses it. On a GPU-less box ANGLE falls back to SwiftShader
(software); it still works, just slowly (see timings). `--gl=swangle` forces SwiftShader explicitly.

## 4K render commands

```bash
npx remotion render src/index.ts DataCube-Blue                 out/DataCube_Blue.mp4                 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts CloudMap-Story                out/CloudMap_Story.mp4                --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts ChromePortal-Silver           out/ChromePortal_Silver.mp4           --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts ChromePortal-Gold             out/ChromePortal_Gold.mp4             --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts GoldRibbonPodium-RedGold      out/GoldRibbonPodium_RedGold.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts GoldRibbonPodium-EmeraldGold  out/GoldRibbonPodium_EmeraldGold.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts SoftLight-Blue                out/SoftLight_Blue.mp4                --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts SoftLight-Violet              out/SoftLight_Violet.mp4              --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
```

(For a mezzanine master use `--codec=prores --prores-profile=4444` instead.)

720p previews: `scripts/render-previews.sh` (adds `--scale=0.3333333333333333`).

## 6K stills (6000×3375)

```bash
npx remotion still src/index.ts <CompositionId> out/<name>_6K.png --frame=300 --scale=1.5625 --gl=angle
# CloudMap-Story: use --frame=150 (or 280 for the held push-in)
```

`--scale=1.5625` × 3840×2160 = 6000×3375 exactly. All sizes (bloom radius, line widths, grain,
edge glows, sparkle sizes) scale with the output height, so stills match the video.

## Add a colourway (one data row)

Every version is one row in `src/versions.ts`. Copy a row, give it a new `id`, change the colours:

```ts
{ id: "SoftLight-Teal", look: "softLight", frames: 600, params: { edge: "#0A3A4A", glow: "#3AAAB0", streak: "#B0F0EA" } },
```

It appears in the Studio and can be rendered by id. Nothing else needs editing.

## Determinism

Remotion renders frames out of order on several tabs. Every visible value is a pure function of
`useCurrentFrame()`:

- Layouts (cube cells, sparkles, server positions, the blue-noise tile) are generated once from
  `mulberry32` seeded at module level. No `Math.random()`, `Date.now()`, clocks or React state drive visuals.
- `@react-three/fiber`'s `useFrame` is used only as the render hook (priority 1) that
  `<ThreeCanvas>` triggers; its clock/delta arguments are ignored. Nothing is carried between frames.
- No TAA, no accumulation buffers, no `AccumulativeShadows`.
- Natural Earth data is fetched behind `delayRender`/`continueRender`; textures are built synchronously.
- Loops: all loop motion is `sin/cos(2π · frame/600 · integer)`. The cube turns exactly 90° per loop
  and its 4 side faces share one layout and twinkle as a function of each face's *world angle*, so
  every face inherits its neighbour's state. The chrome bands slide exactly one band spacing.

## Banding

- Scenes render into **half-float** (RGBA16F, 4× MSAA) targets; bloom runs in half-float too.
- The final pass adds a **±1/255 TPDF dither** (all looks) plus a fixed **64×64 blue-noise tile**
  (void-and-cluster, generated in code) offset per `frame % 600` (Looks 3, 4, 5).
- **Grain**: 1.5 % (2 % on Soft Light), from an integer hash of pixel position and `frame % 600`
  (`frame % 300` for Cloud Map). Never `Math.random()`.

## Measured render times (this build machine: 4 vCPU, **no GPU** → ANGLE fell back to SwiftShader)

720p previews (`--scale=1/3`, `--concurrency=4`), wall time ÷ frames, bundling and browser start-up included:

| Composition | Frames | Wall | Per frame |
|---|---|---|---|
| SoftLight-Blue | 600 | 98 s | 0.16 s |
| SoftLight-Violet | 600 | 101 s | 0.17 s |
| CloudMap-Story | 300 | 219 s | 0.73 s |
| GoldRibbonPodium-RedGold | 600 | 330 s | 0.55 s |
| GoldRibbonPodium-EmeraldGold | 600 | 328 s | 0.55 s |
| ChromePortal-Silver | 600 | 876 s | 1.46 s |
| ChromePortal-Gold | 600 | 857 s | 1.43 s |
| DataCube-Blue | 600 | 1581 s | 2.64 s |

Single real **4K frames** (3840×2160, frame 300, one tab, warm-up excluded — `scripts/time-frames.mjs 1 300 3 …`):

- **DataCube-Blue: 19.6 s / frame**
- **ChromePortal-Silver: 5.8 s / frame**

4K estimates on this same GPU-less machine (one tab per frame; `--concurrency` gives little extra because
SwiftShader already uses all cores): Data Cube ≈ 600 × 19.6 s ≈ **3.3 h**; Chrome Portal ≈ 600 × 5.8 s ≈ **1 h each**;
Podium ≈ 4–5 s/frame ≈ **45 min each**; Cloud Map ≈ 4–5 s/frame ≈ **25 min**; Soft Light ≈ 1.5 s/frame ≈ **15 min each**
(scaled from the 720p numbers by the measured 720p→4K ratios: ×7.5 for fill-bound scenes, ×4 for Chrome).
On a machine with a real GPU (`--gl=angle` hardware path) expect these to drop by an order of magnitude or more.

## Verification (run on the encoded 720p previews)

| Check | Result |
|---|---|
| 1. ffprobe: h264, 1280×720, yuv420p, 30/1, no audio, 20.0 s (10.0 s Cloud Map) | **pass, all 8, first time** |
| 2. Loop: compositions made 601 frames (`--props='{"extraFrames":1}'`), frame 600 vs 0 | **byte-identical PNGs, all 7 loops** |
| 3. Cold single frame 300 (150) vs same frame inside a 4-thread sequence render | **byte-identical, all 8** |
| 4. Banding: frames decoded from the mp4, gradients contrast-stretched ×12 about the local mean | **no steps or contours, all 8** — only even grain (`out/verify/*_band_stretch.png`) |
| 5. Contact sheets (5 evenly spaced frames) | content as specified, all 8 |
| 6. Motion: 2 s around frame 300 (Cloud Map 2–6.5 s), frame-to-frame Δ and persistent-shimmer metric | loops ≤ 0.001 % shimmering pixels; Cloud Map 0.11 % (draw-on heads passing) after fixing server-stripe strobing |

`--tune grain` was **not** needed: Soft Light shows no banding at CRF 16 with the 2 % grain + blue noise
(the cost is file size: ≈ 41 MB per 20 s at 720p).

Scripts: `scripts/verify.sh {probe|loop|determinism|contact} <Id>`, `scripts/verify-all.sh`,
`scripts/banding.py`, `scripts/banding_view.py`, `scripts/motion.py`, `scripts/shimmer.py`.

## Completion checklist

- [x] 8 compositions, one data row each, 3840×2160, 30 fps (600 f loops, 300 f Cloud Map)
- [x] Looks 1–4 three.js on WebGL2 via `@remotion/three`; Look 5 one fragment shader; no PixiJS, no WebGPU
- [x] No text, logos or brands; Natural Earth 1:110m land, public domain, note included
- [x] Half-float targets, ±1/255 dither, blue-noise dither (3, 4, 5), grain 1.5 % / 2 %, all frame-driven
- [x] No `Math.random()`, clocks, state or temporal accumulation in render
- [x] Loops seamless; cold-start frames byte-identical
- [x] 720p previews + 720p stills rendered; 4K/6K commands documented (not rendered here)

## Deliberate deviations from the brief (to match the references)

- **Chrome Portal:** 52 bands instead of ~120, and an opening of ≈ 45 % of frame height instead of 30 % —
  the reference's slats are far fewer and thicker and its opening much larger. The tube cross-section is a
  rounded square twisting once around the ring (gives the reference's squarish, folded look); the band
  pattern slides exactly one band spacing per loop.
- **Data Cube** stays at x ≈ 55 % as specified (the reference has it at ≈ 65 %).

## Files

- `src/versions.ts` — the 8 data rows
- `src/Root.tsx` — registers compositions
- `src/lib/post.ts` — half-float pipeline, bloom, tone map, grain, dither
- `src/lib/blueNoise.ts`, `src/lib/random.ts`, `src/lib/ThreeLook.tsx`
- `src/looks/*.ts` — one file per look
- `scripts/` — preview render, verify helpers, timing harness
