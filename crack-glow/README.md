# Crack Glow — Remotion project (4K)

A dark Voronoi-fractured stone surface. A light streak strikes it, and an energy
wave races outward through the cracks (violet with amber accents), with an
impact starburst and volumetric-style rays. The pulse plays twice, matching the
reference clip.

| Composition   | Resolution | FPS | Frames | Duration | Notes |
|---------------|-----------:|----:|-------:|---------:|-------|
| `CrackGlowV1` | 3840×2160  | 30  | 182    | 6.067 s  | Matches the reference (violet + amber cracks) |
| `CrackGlowV2` | 3840×2160  | 30  | 182    | 6.067 s  | Alternative colour palette: electric cyan + molten gold on slate-blue stone |

**Technology:** Remotion 4 + a raw **WebGL 2 fragment shader** (`src/crackShader.ts`),
drawn by `src/ShaderCanvas.tsx`. Every pixel is a pure function of the frame
number, so renders are deterministic and can run in parallel. There are no external
assets: everything is procedural.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- About 1 GB of free disk for `node_modules`

## Commands

```bash
npm install

# Preview in the browser
npm run dev

# 4K master (3840x2160, H.264 MP4)
npx remotion render CrackGlowV1 out/CrackGlowV1_4K.mp4
npx remotion render CrackGlowV2 out/CrackGlowV2_4K.mp4

# 1080p delivery (the 4K composition is drawn at full 4K, then downsampled 2x)
npx remotion render CrackGlowV1 out/CrackGlowV1_1080p.mp4 --scale=0.5
npx remotion render CrackGlowV2 out/CrackGlowV2_1080p.mp4 --scale=0.5

# Single still for a quick check
npx remotion still CrackGlowV1 out/frame16.png --frame=16 --scale=0.5
```

Codec settings (H.264, yuv420p, CRF 16) and the WebGL backend live in
`remotion.config.ts`.

### WebGL backend

`remotion.config.ts` sets `--gl=swangle` (ANGLE on SwiftShader). It is CPU-based and
works everywhere, including headless servers without a GPU. On a workstation
with a GPU you can add `--gl=angle` to the render command for much faster renders.

### Fast draft preview

The shader backing store can be shrunk for quick drafts. Final renders must keep
the default `internalScale: 1`.

```bash
npx remotion render CrackGlowV1 out/draft.mp4 --scale=0.25 --props='{"internalScale":0.25}'
```

## Tweaking

All look parameters (palette, camera tilt, distance, orbit and dolly) are
Zod-typed props in `src/CrackGlow.tsx` and can be edited live in Remotion Studio.
