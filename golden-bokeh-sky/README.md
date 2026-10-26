# Golden Bokeh to Sky (Remotion, 4K)

A slow camera rise from defocused golden light (bokeh through sunlit
foliage), through pale haze, into an open blue sky with soft light shafts.
Rendered procedurally as a **WebGL2 fragment shader** (no image assets),
28 s long to match the reference.

| Composition         | Size        | FPS | Frames | Duration | Camera |
| ------------------- | ----------- | --- | ------ | -------- | ------ |
| `GoldenBokehSky-V1` | 3840 × 2160 | 30  | 840    | 28 s     | Vertical tilt-up, eased like the reference (no parallax) |
| `GoldenBokehSky-V2` | 3840 × 2160 | 30  | 840    | 28 s     | Alternative movement: crane pull-back (opens 1.4x tight on an 8° dutch angle, fast rise then glide, pulls back wide and rolls level) with depth parallax |

The V1 tilt curve (`src/bokeh/camera.ts`) was fitted to the reference by
tracking its gold/sky boundary second by second.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- Internet access on first render, so Remotion can download Chrome Headless
  Shell (unless the Playwright build referenced in `remotion.config.ts` exists)

## Commands

```console
npm ci                 # install exact dependencies from package-lock.json
npm run dev            # Remotion Studio preview

npm run render:v1      # -> out/GoldenBokehSky-V1_1080p.mp4 (H.264, 1920x1080, 30 fps)
npm run render:v2      # -> out/GoldenBokehSky-V2_1080p.mp4
npm run render:all     # both 1080p deliverables

npm run render:v1:4k   # native 4K master -> out/GoldenBokehSky-V1_4K.mp4
npm run render:v2:4k
```

The 1080p renders use `--scale=0.5` on the 4K composition. The shader canvas
sizes its backing store from `devicePixelRatio`, so a 1080p render shades
exactly the output pixels and a 4K render shades all 3840 × 2160 of them. The
image is the same at either scale. WebGL runs through SwiftShader
(`--gl=swangle`, set in `remotion.config.ts`), so no GPU is needed. The
reference has no audio track, and neither do these renders.

## Source layout

- `src/Root.tsx` — composition registration and the palette (sampled from the reference)
- `src/bokeh/GoldenBokehSky.tsx` — per-frame camera and uniforms
- `src/bokeh/camera.ts` — V1 tilt (monotone-cubic keyframes) and V2 crane path
- `src/bokeh/bokehShader.ts` — GLSL sky, haze, warm light mass and bokeh layers
- `src/gl/ShaderCanvas.tsx` — minimal synchronous WebGL2 full-frame renderer
