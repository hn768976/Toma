# HUD Loader (Remotion · Canvas 2D)

A recreation of the reference clip "sci-fi HUD loading bar, 0 → 100 %": a cyan
neon interface that builds in, then counts up while the bar fills. It holds at 100 %.
All line work, text and glow are drawn with the **Canvas 2D** API. Each element is
drawn crisp, then glowed with two additive blur passes.

| Composition     | Size        | FPS | Frames | Duration | Look                                                                                     |
| --------------- | ----------- | --- | ------ | -------- | ---------------------------------------------------------------------------------------- |
| `HudLoader-V1`  | 3840 × 2160 | 30  | 360    | 12.000 s | Matches the reference: locked-off frontal framing, same layout and timing                |
| `HudLoader-V2`  | 3840 × 2160 | 30  | 360    | 12.000 s | Alternative **camera angle + movement**: 3D orbit from a low left angle round to a near-frontal 3/4 view, with a dolly-in. The HUD is split into 3 depth layers for real parallax |

Timing taken from the reference:

- 0 – 0.6 s: build-in
- 0.56 s: counter shows 1 %
- 8.56 s: counter reaches 100 %
- 8.56 – 12 s: holds at 100 %

The marker triangles hop, and the "LOADING…" label and bar fill blink briefly every ~0.67 s, as in the reference.

## Requirements

- Node.js 20.19+ or 22.13+
- Nothing else. Remotion downloads its own headless Chrome and ships its own ffmpeg.

## Install

```bash
npm ci          # or: npm install
```

## Preview

```bash
npm run dev     # opens Remotion Studio
```

## Render

```bash
# 4K masters + 1080p deliveries for both versions
npm run render
#   -> out/4k/HudLoader-V1_3840x2160.mp4      (4K master, H.264)
#   -> out/1080p/HudLoader-V1_1920x1080.mp4   (delivery, H.264, 30 fps)
#   -> same for HudLoader-V2

npm run render:v1        # only Version 1 (4K master + 1080p)
npm run render:v2        # only Version 2
npm run render:4k:v1     # 4K master only
```

Direct CLI use also works:

```bash
npx remotion render HudLoader-V1 out/HudLoader-V1.mp4 --codec=h264
```

### Rendering notes

- `remotion.config.ts` uses the `swangle` OpenGL renderer (ANGLE on SwiftShader). Canvas
  filters and the CSS 3D camera of Version 2 then render the same way on any machine.
- To use an already installed Chrome or `chrome-headless-shell` instead of the one
  Remotion downloads, set `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.

## Project structure

```
public/fonts/
  Orbitron-Bold.woff2   display font (SIL Open Font License, see OFL-Orbitron.txt)
src/
  index.ts              registerRoot
  Root.tsx              the two 4K compositions
  hud/
    HudLoader.tsx       V1 (flat) and V2 (3D camera) components, glow compositing, font loading
    draw.ts             Canvas 2D drawing of every HUD element (in reference-pixel space)
    timeline.ts         build-in, counter, marker and blink timing
scripts/render.mjs      4K master -> 1080p delivery pipeline
remotion.config.ts      renderer settings
```

The HUD geometry is authored in the 768 × 432 pixel space of the reference. It is
scaled by `width / 768` (= 5 at 4K), so it stays sharp at any output size.
