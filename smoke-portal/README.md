# Smoke Portal — Remotion project (4K)

A glowing ring ignites around a dark core with an anamorphic lens flare, then
erupts into billowing smoke. A hot magenta inner plume is threaded with white
energy filaments and wrapped in an expanding blue-violet outer cloud.

| Composition     | Resolution | FPS | Frames | Duration | Notes |
|-----------------|-----------:|----:|-------:|---------:|-------|
| `SmokePortalV1` | 3840×2160  | 30  | 301    | 10.033 s | Matches the reference (locked-off front view) |
| `SmokePortalV2` | 3840×2160  | 30  | 301    | 10.033 s | Alternative camera movement: wide start, dolly into the portal with a rolling camera and depth parallax between plume and outer cloud |

**Technology:** Remotion 4 + a raw **WebGL 2 fragment shader** (`src/smokeShader.ts`)
using domain-warped gradient-noise fBm. It is drawn by `src/ShaderCanvas.tsx` and
is deterministic per frame. There are no external assets: everything is procedural.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- About 1 GB of free disk for `node_modules`

## Commands

```bash
npm install

# Preview in the browser
npm run dev

# 4K master (3840x2160, H.264 MP4)
npx remotion render SmokePortalV1 out/SmokePortalV1_4K.mp4
npx remotion render SmokePortalV2 out/SmokePortalV2_4K.mp4

# 1080p delivery (the 4K composition is drawn at full 4K, then downsampled 2x)
npx remotion render SmokePortalV1 out/SmokePortalV1_1080p.mp4 --scale=0.5
npx remotion render SmokePortalV2 out/SmokePortalV2_1080p.mp4 --scale=0.5

# Single still for a quick check
npx remotion still SmokePortalV1 out/frame150.png --frame=150 --scale=0.5
```

Codec settings (H.264, yuv420p, CRF 16) and the WebGL backend live in
`remotion.config.ts`.

### WebGL backend

`remotion.config.ts` sets `--gl=swangle` (ANGLE on SwiftShader). It is CPU-based and
works everywhere, including headless servers without a GPU. On a workstation
with a GPU you can add `--gl=angle` to the render command for much faster renders.

### Fast draft preview

```bash
npx remotion render SmokePortalV1 out/draft.mp4 --scale=0.25 --props='{"internalScale":0.25}'
```

## Tweaking

Palette and camera mode are Zod-typed props in `src/SmokePortal.tsx`, editable
live in Remotion Studio. The V2 camera path (zoom, roll, pan) is in `useCamera()`.
