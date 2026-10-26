# Crumpled Grid Paper (Remotion, 4K)

Stop-motion loop of a crumpled sheet of graph paper, rebuilt procedurally as a
**WebGL2 fragment shader** (no image assets). It matches the 9.6 s reference:
8 crumple states, each held for 0.12 s, cycling every 0.96 s.

| Composition            | Size        | FPS | Frames | Duration | Look |
| ---------------------- | ----------- | --- | ------ | -------- | ---- |
| `CrumpledGridPaper-V1` | 3840 × 2160 | 30  | 288    | 9.6 s    | Charcoal paper, light-grey grid (matches the reference) |
| `CrumpledGridPaper-V2` | 3840 × 2160 | 30  | 288    | 9.6 s    | Alternative palette: blueprint (cyanotype blue, pale-cyan ink) |

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- Internet access on first render, so Remotion can download Chrome Headless
  Shell (unless the Playwright build referenced in `remotion.config.ts` exists)

## Commands

```console
npm ci                 # install exact dependencies from package-lock.json
npm run dev            # Remotion Studio preview

npm run render:v1      # -> out/CrumpledGridPaper-V1_1080p.mp4 (H.264, 1920x1080, 30 fps)
npm run render:v2      # -> out/CrumpledGridPaper-V2_1080p.mp4
npm run render:all     # both 1080p deliverables

npm run render:v1:4k   # native 4K master -> out/CrumpledGridPaper-V1_4K.mp4
npm run render:v2:4k
```

The 1080p renders use `--scale=0.5` on the 4K composition. The shader canvas
sizes its backing store from `devicePixelRatio`, so a 1080p render shades
exactly the output pixels and a 4K render shades all 3840 × 2160 of them. The
image is the same at either scale. WebGL runs through SwiftShader
(`--gl=swangle`, set in `remotion.config.ts`), so no GPU is needed.

Outputs include a silent stereo AAC track (`--enforce-audio-track`), mirroring
the reference, whose audio track is digital silence.

## Source layout

- `src/Root.tsx` — composition registration and the V1 / V2 palettes
- `src/paper/CrumpledGridPaper.tsx` — stop-motion timing and uniforms
- `src/paper/paperShader.ts` — GLSL heightfield (folds, creases, grain), lighting and grid
- `src/gl/ShaderCanvas.tsx` — minimal synchronous WebGL2 full-frame renderer
