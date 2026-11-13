# Revenue Growth — 3D Financial Dashboard (Remotion, 4K)

Two native **3840×2160 (4K UHD), 30 fps, 600-frame (20.000 s)** compositions
recreating a cinematic fly-by of a holographic financial dashboard: a
"Revenue Growth" panel with an area chart and two crossing curves that draw
on over time, a tilted candlestick panel with overlay lines and reflections,
side UI panels, a glowing foreground light bar and a deck grid, with depth of
field and bloom.

| Composition ID | Version | Description |
| --- | --- | --- |
| `RevenueGrowth-V1-Reference-4K` | Version 1 | Matches the reference: navy UI, blue area chart, red/green curves, blue/violet candles, pink and yellow overlay lines, orange light bar; camera sweeps from a close, rolled left-side view through frontal to the right side. |
| `RevenueGrowth-V2-AmberPalette-4K` | Version 2 | Alternative **colour palette** "Amber Night": gold area chart, magenta/teal curves, gold-white candles, cyan overlay line and cyan light bar on warm charcoal. Same layout, data, timing and camera path. |

## Technology

- **Remotion 4** (project scaffolded with `npx create-video --three`).
- **Three.js (WebGL 2)** drawn imperatively into one canvas per frame
  (`src/lib/GLCanvas.tsx`); every value is a pure function of the frame
  number and fixed seeds, so renders are deterministic.
- **Canvas 2D** builds the static panel textures once (`src/dashboard/textures.ts`);
  animated lines are GPU ribbons with anti-aliased glow (`src/lib/ribbon.ts`).
- **Custom WebGL 2 shaders** (`src/lib/postfx.ts`): depth-based bokeh depth
  of field, dual-filter bloom, ACES filmic tone mapping, chromatic
  aberration, vignette and film grain.

## Commands

```console
npm ci                      # install exact dependency versions
npm run dev                 # open Remotion Studio (preview / scrub)

# 1080p deliverables (renders the 4K composition, output scaled to 1920x1080)
npm run render:v1:1080p
npm run render:v2:1080p

# full 4K UHD masters (3840x2160)
npm run render:v1:4k
npm run render:v2:4k
```

Outputs are written to `out/` as H.264 MP4 (yuv420p, CRF 16), configured in
`remotion.config.ts`. Equivalent raw CLI call:

```console
npx remotion render RevenueGrowth-V1-Reference-4K "out/v1.mp4" --scale=0.5
```

### Rendering notes

- WebGL runs through SwiftShader (`--gl=swangle`, set in `remotion.config.ts`),
  which works on any machine. With a GPU you can pass `--gl=angle` for faster
  renders.
- If your environment cannot download Remotion's Chrome Headless Shell, point
  `REMOTION_BROWSER_EXECUTABLE` at an existing `chrome-headless-shell`.
- Rendering is CPU-heavy at 4K (~2–3 s per frame on 4 CPU cores).

## Structure

```
src/
  Root.tsx                       compositions (4K, 30 fps, 600 frames)
  dashboard/RevenueDashboard.tsx React wrapper
  dashboard/scene.ts             3D layout, animation timeline, camera path
  dashboard/textures.ts          Canvas 2D panel artwork
  dashboard/data.ts              seeded chart data (area, curves, candles, lines)
  dashboard/palette.ts           Version 1 and Version 2 palettes
  lib/                           WebGL host, ribbons, post-processing, RNG
public/fonts/                    Inter (SIL OFL 1.1)
```
