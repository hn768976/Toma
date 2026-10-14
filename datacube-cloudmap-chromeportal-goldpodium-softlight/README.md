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

## Files

- `src/versions.ts` — the 8 data rows
- `src/Root.tsx` — registers compositions
- `src/lib/post.ts` — half-float pipeline, bloom, tone map, grain, dither
- `src/lib/blueNoise.ts`, `src/lib/random.ts`, `src/lib/ThreeLook.tsx`
- `src/looks/*.ts` — one file per look
- `scripts/` — preview render, verify helpers, timing harness
