# Composition 1 — Network Plexus (4K)

A Remotion + Three.js (WebGL 2) recreation of the reference *"glowing data network
fly-through"* clip: a continuous camera flight through a 3D plexus of glowing hub
nodes, steel-blue / lavender links, orange HUD rings, blue data panels, mini bar
charts, sparkle clusters and drifting dust — all with a physically-inspired lens
depth of field.

| | |
|---|---|
| Resolution | **3840 × 2160** (4K UHD) |
| Frame rate | **30 fps** |
| Duration | **650 frames = 21.667 s** (identical to the reference) |
| Codec | H.264 (yuv420p), no audio (reference has none) |

## Compositions

| ID | Description |
|---|---|
| `NetworkPlexus-V1` | Matches the reference: deep teal-navy space, steel-blue/lavender links, orange HUD rings, pink-white hub flares. |
| `NetworkPlexus-V2` | Alternative **colour palette**: violet-black space, teal/cyan links and nodes, magenta HUD rings — same camera, timing and structure. |

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- ~4 GB free RAM. No GPU is required (rendering uses SwiftShader-ANGLE, `--gl=swangle`).

## Commands

```bash
npm ci                     # install exact dependency versions (or: npm install)

npm run dev                # open Remotion Studio (preview / scrub)

npm run render:v1:4k       # -> out/NetworkPlexus-V1-4K.mp4   (3840x2160)
npm run render:v2:4k       # -> out/NetworkPlexus-V2-4K.mp4

npm run downscale:v1       # 4K master -> out/NetworkPlexus-V1-1080p.mp4 (Lanczos, H.264)
npm run downscale:v2

npm run deliver            # both versions: 4K render + 1080p delivery file
```

Equivalent raw CLI calls:

```bash
npx remotion render NetworkPlexus-V1 out/NetworkPlexus-V1-4K.mp4
npx remotion ffmpeg -i out/NetworkPlexus-V1-4K.mp4 -vf scale=1920:1080:flags=lanczos \
  -c:v libx264 -preset slow -crf 16 -x264-params aq-mode=3 -pix_fmt yuv420p -r 30 -movflags +faststart -an \
  out/NetworkPlexus-V1-1080p.mp4
```

Offline machines: Remotion normally downloads Chrome Headless Shell on first
render. To use an already-installed Chrome instead, set
`REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.

On a machine with a GPU you can speed rendering up with `--gl=angle`
(edit `remotion.config.ts`). Render time with software GL on 4 CPU cores is
roughly 1.5–2 s per 4K frame.

## Project layout

```
src/
  Root.tsx                    composition registry (4K, 30 fps, 650 frames)
  engine/
    layers.ts                 instanced billboard + line renderers with per-element depth of field
    post.ts                   HDR (half-float) pipeline: bloom, grade, dithering
    random.ts                 deterministic RNG + helpers
  network/
    build.ts                  procedural network, camera path and focus pulls
    shapes.ts                 GLSL shapes (hub flare, HUD ring, data panel, bars, dots)
    palette.ts                V1 (reference) and V2 (alternative) palettes
    NetworkPlexus.tsx         Three.js scene / camera / uniforms per frame
remotion.config.ts            renderer settings (swangle, PNG frames, H.264, CRF 16, muted)
```

Everything is procedural and seeded, so every render is frame-identical. There
are no external runtime assets.
