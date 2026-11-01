# Silver Satin — Remotion project (4K)

Flowing silver satin: long, layered horizontal folds with fine ripples billow and travel across the frame, lit by a large overhead softbox with navy shadows and warm-white sheen. Fold direction slowly turns towards a diagonal over the clip.

Rendered entirely with a **WebGL 2 fragment shader** inside Remotion. No external assets: every frame is generated procedurally and depends only on the frame number, so renders are deterministic.

## Compositions

| ID | Resolution | FPS | Frames | Duration |
|---|---|---|---|---|
| `SilverSatin-V1-Reference` | 3840 × 2160 | 30 | 401 | 13.367 s |
| `SilverSatin-V2-LowAngleDolly` | 3840 × 2160 | 30 | 401 | 13.367 s |

- **V1 — reference match.**
- **V2 — alternative camera angle and movement.** The same cloth seen from a low-angle perspective camera that dollies forward while orbiting (yaw) with a slight roll; distant cloth falls off into navy shadow. A camera change suits this reference best: the palette is near-monochrome silver, so the strongest alternative is revealing the depth of the folds.

The reference clip is 13.380 s / 401 frames @ 29.97 fps. At exactly 30 fps the composition keeps the same frame count (401), so its length is the nearest whole-frame match, within one frame of the reference.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- On first render, Remotion downloads its Chrome Headless Shell. If your network blocks that, point `REMOTION_BROWSER` at an existing Chrome Headless Shell binary; `remotion.config.ts` picks it up.

## Commands

```console
npm ci                 # install exact dependency versions
npm run dev            # Remotion Studio preview
npm run render:v1      # V1 -> out/SilverSatin-V1-Reference-1080p.mp4 (4K composition, 1080p output)
npm run render:v2      # V2 -> out/SilverSatin-V2-LowAngleDolly-1080p.mp4
npm run render:v1:4k   # V1 at full 3840x2160
npm run render:v2:4k   # V2 at full 3840x2160
```

Output is H.264 MP4 (yuv420p, BT.709, CRF 14, peak bitrate capped at 30 Mbit/s), set in `remotion.config.ts`. The 1080p deliverables are the 4K compositions rendered with `--scale=0.5`: the shader still runs at 3840 × 2160 and is downsampled, which gives 2×2 supersampled anti-aliasing.

**GPU-less machines / servers:** add `-- --gl=swangle` to use SwiftShader, e.g. `npm run render:v1 -- --gl=swangle`. The deliverables were rendered this way.

## Source layout

- `src/SilverSatin.tsx` — component, Zod schema, palette and camera-mode props
- `src/gl/satinShader.ts` — WebGL 2 fragment shader (cloth heightfield, satin environment, both cameras)
- `src/gl/ShaderCanvas.tsx` — reusable WebGL 2 full-frame shader canvas (per-frame uniforms, `delayRender` handling)
- `src/gl/noise.glsl.ts` — GLSL simplex noise / hashing helpers
- `src/Root.tsx` — composition registration (4K, 30 fps, duration)
- `remotion.config.ts` — codec, quality, GL renderer, timeouts
