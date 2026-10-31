# Composition 2 — Market Crash (4K)

A Remotion + Three.js (WebGL 2 + Canvas 2D textures) recreation of the reference
*"red stock-market crash"* clip: glowing red/orange ticker tables, falling line
charts, LED dot-matrix charts, candlesticks, lens flares with anamorphic streaks,
a spark burst and flying data fragments, shot with a moving camera and shallow
depth of field.

| | |
|---|---|
| Resolution | **3840 × 2160** (4K UHD) |
| Frame rate | **30 fps** |
| Duration | **400 frames = 13.333 s** (identical to the reference) |
| Codec | H.264 (yuv420p), no audio (reference has none) |

## Compositions

| ID | Description |
|---|---|
| `MarketCrash-V1` | Matches the reference: slow push-in on the flare cluster, banked swoop through the charts, darker middle drift, push into a ticker table, pull-focus back to glowing flares. |
| `MarketCrash-V2` | Alternative **camera angle & movement**: an elevated, steady crane/tracking shot gliding over the same data landscape from high on the right, looking down across the layers (no banking, damped motion, slow focus pulls). Same palette, timing and elements. |

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- ~4 GB free RAM. No GPU is required (rendering uses SwiftShader-ANGLE, `--gl=swangle`).

## Commands

```bash
npm ci                     # install exact dependency versions (or: npm install)

npm run dev                # open Remotion Studio (preview / scrub)

npm run render:v1:4k       # -> out/MarketCrash-V1-4K.mp4   (3840x2160)
npm run render:v2:4k       # -> out/MarketCrash-V2-4K.mp4

npm run downscale:v1       # 4K master -> out/MarketCrash-V1-1080p.mp4 (Lanczos, H.264)
npm run downscale:v2

npm run deliver            # both versions: 4K render + 1080p delivery file
```

Equivalent raw CLI calls:

```bash
npx remotion render MarketCrash-V1 out/MarketCrash-V1-4K.mp4
npx remotion ffmpeg -i out/MarketCrash-V1-4K.mp4 -vf scale=1920:1080:flags=lanczos \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -movflags +faststart -an \
  out/MarketCrash-V1-1080p.mp4
```

Offline machines: Remotion normally downloads Chrome Headless Shell on first
render. To use an already-installed Chrome instead, set
`REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.

On a machine with a GPU you can speed rendering up with `--gl=angle`
(edit `remotion.config.ts`).

## Project layout

```
public/fonts/                 Barlow Condensed 500/600 (SIL OFL 1.1, licence included)
src/
  Root.tsx                    composition registry (4K, 30 fps, 400 frames)
  engine/
    layers.ts                 instanced billboard + line renderers with per-element depth of field
    post.ts                   HDR (half-float) pipeline: bloom, grade, dithering
    random.ts                 deterministic RNG + helpers
  market/
    build.ts                  scene layout, timeline (glow curve), V1 + V2 camera paths
    shapes.ts                 GLSL shapes (lens flare, LED pixel, candlestick, spark burst, dots)
    textures.ts               Canvas 2D ticker-table textures
    tablePlane.ts             textured table planes with mip-biased depth of field
    MarketCrash.tsx           Three.js scene / camera / uniforms per frame, font loading
remotion.config.ts            renderer settings (swangle, PNG frames, H.264, CRF 16, muted)
```

Everything is procedural and seeded, so every render is frame-identical. The
only external asset is the bundled font.
