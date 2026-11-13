# Finance Dashboard Flythrough — Remotion project (4K)

A camera glides past floating dark-glass financial dashboard cards — an
animated donut chart, bar charts, market-analysis copy, a row of tall KPI
cards with area charts and a violet price line in the background — with a
shallow depth of field.

| Composition id | Size | FPS | Frames | Duration | Description |
| --- | --- | --- | --- | --- | --- |
| `FinanceDashboard-V1-Reference` | 3840×2160 | 30 | 300 | 10.000 s | Version 1 — matches the reference: charcoal glass, violet / peach / teal accents, push-in then decelerating truck right |
| `FinanceDashboard-V2-EmeraldGold` | 3840×2160 | 30 | 300 | 10.000 s | Version 2 — identical layout and camera, alternative “Emerald & Gold” colour palette |

> The reference clip runs 10.01 s at 23.976 fps (240 frames). At the required
> 30 fps a whole-frame duration of 10.01 s does not exist (it would be 300.3
> frames); 300 frames = 10.000 s is the closest possible length.

## Technology

* **Remotion 4** (scaffolded with `npx create-video --three`), React 19, TypeScript.
* **Three.js / WebGL 2** scene of textured glass cards, rendered imperatively per
  frame (`src/engine/ThreeStage.tsx`); deterministic output.
* **Canvas 2D** painters for every card (`src/dash/draw.ts`) — charts animate
  (donut build, bar growth, ticking numbers) as a pure function of time.
* **Custom GLSL post chain** (`src/engine/post.ts`): half-resolution depth of
  field, bloom, chromatic aberration, vignette, grain and colour grade.
* Palettes in `src/dash/palette.ts`; camera keyframes in `src/dash/scene.ts`.
* Fonts (Montserrat, Inter — SIL OFL) are bundled in `public/fonts`; no network access is needed.

## Commands

```bash
npm install                      # install dependencies (Node 20.19+ / 22.13+)
npm run dev                      # Remotion Studio preview

# 4K masters (native composition size)
npx remotion render FinanceDashboard-V1-Reference out/finance-v1-4k.mp4
npx remotion render FinanceDashboard-V2-EmeraldGold out/finance-v2-4k.mp4

# 1080p deliverables (the 4K composition rendered at scale 0.5)
npx remotion render FinanceDashboard-V1-Reference out/finance-v1-1080p.mp4 --scale=0.5
npx remotion render FinanceDashboard-V2-EmeraldGold out/finance-v2-1080p.mp4 --scale=0.5

# single 4K still for a quick check
npx remotion still FinanceDashboard-V1-Reference out/frame.png --frame=75
```

Encoding defaults live in `remotion.config.ts`: H.264, yuv420p, CRF 18, JPEG 95 intermediates.

### Rendering notes

* WebGL defaults to `--gl=swangle` (CPU / SwiftShader) so it renders on any
  machine, including headless servers. On a workstation with a GPU, render
  much faster with `REMOTION_GL=angle npx remotion render …`.
* If Remotion cannot download its Chrome Headless Shell (offline / firewalled
  machine), point it at a local Chromium headless shell:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npx remotion render …`.
* Debug props: `--props='{"variant":"reference","debug":true}'` renders the raw
  scene without post-processing; `"profile":true` logs per-pass timings.

## Layout

```
src/
  Root.tsx              compositions (4K, 30 fps, 300 frames)
  FinanceDashboard.tsx  composition component
  engine/               reusable WebGL stage, post chain, fonts, RNG
  dash/draw.ts          Canvas 2D card painters
  dash/palette.ts       V1 reference palette + V2 Emerald & Gold palette
  dash/scene.ts         card layout, camera keyframes, post settings
public/fonts/           bundled woff2 fonts + OFL licence
```
