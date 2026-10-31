# Iridescent Foil — Remotion project (4K)

A holographic liquid-foil surface: long diagonal streaks of magenta / cyan / green highlights on deep violet that relax into crumpled bulges, with surface-locked glitter flakes and soft lens glows. The camera slowly pushes in with a gentle roll and drift.

Rendered entirely with a **WebGL 2 fragment shader** inside Remotion. No external assets: every frame is generated procedurally and depends only on the frame number, so renders are deterministic.

## Compositions

| ID | Resolution | FPS | Frames | Duration |
|---|---|---|---|---|
| `IridescentFoil-V1-Reference` | 3840 × 2160 | 30 | 202 | 6.733 s |
| `IridescentFoil-V2-GoldSapphire` | 3840 × 2160 | 30 | 202 | 6.733 s |

- **V1 — reference match.**
- **V2 — alternative colour palette.** Same surface, camera and timing, re-lit in molten gold / amber with sapphire-blue rim light on a deep navy base. A palette change suits this reference best: its identity is the iridescent colour play, while the framing and motion are already what make it work.

The reference clip is 6.740 s / 202 frames @ 29.97 fps. At exactly 30 fps the composition keeps the same frame count (202), so its length is the nearest whole-frame match, within one frame of the reference.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- On first render, Remotion downloads its Chrome Headless Shell. If your network blocks that, point `REMOTION_BROWSER` at an existing Chrome Headless Shell binary; `remotion.config.ts` picks it up.

## Commands

```console
npm ci                 # install exact dependency versions
npm run dev            # Remotion Studio preview
npm run render:v1      # V1 -> out/IridescentFoil-V1-Reference-1080p.mp4 (4K composition, 1080p output)
npm run render:v2      # V2 -> out/IridescentFoil-V2-GoldSapphire-1080p.mp4
npm run render:v1:4k   # V1 at full 3840x2160
npm run render:v2:4k   # V2 at full 3840x2160
```

Output is H.264 MP4 (yuv420p, CRF 14), set in `remotion.config.ts`. The 1080p deliverables are the 4K compositions rendered with `--scale=0.5`: the shader still runs at 3840 × 2160 and is downsampled, which gives 2×2 supersampled anti-aliasing.

**GPU-less machines / servers:** add `-- --gl=swangle` to use SwiftShader, e.g. `npm run render:v1 -- --gl=swangle`. The deliverables were rendered this way.

## Source layout

- `src/IridescentFoil.tsx` — component, Zod schema and the two palettes
- `src/gl/foilShader.ts` — WebGL 2 fragment shader (heightfield, lighting, iridescence, glitter)
- `src/gl/ShaderCanvas.tsx` — reusable WebGL 2 full-frame shader canvas (per-frame uniforms, `delayRender` handling)
- `src/gl/noise.glsl.ts` — GLSL simplex noise / hashing helpers
- `src/Root.tsx` — composition registration (4K, 30 fps, duration)
- `remotion.config.ts` — codec, quality, GL renderer, timeouts
