# Holo Globe: Composition 1

A holographic "binary earth" built with Remotion and Three.js (WebGL 2 with custom GLSL shaders). The planet is made of about 40,000 flickering `0`/`1` glyphs. Landmasses come from the bundled Natural Earth 1:50m data. Orbital particle rings, a network mesh, floating binary data panels and read-outs surround it, with a bloom glow on top.

| Composition | Size | FPS | Frames | Duration | Description |
|---|---|---|---|---|---|
| `HoloGlobeV1` | 3840×2160 (4K UHD) | 30 | 900 | 30.000 s | Matches the reference: dive out of giant defocused digits, through the digit surface, reveal Africa, settle on the ringed, spinning globe. |
| `HoloGlobeV2` | 3840×2160 (4K UHD) | 30 | 900 | 30.000 s | Alternative **camera angle + movement**: top-down start over the Arctic, crane down through the ring plane while orbiting ~140°, end on a low "hero" angle with a slow push-in. |

## Requirements

- Node.js 20.19+ or 22.13+ (tested with 22.23)
- `ffmpeg` is bundled with Remotion; no system install is needed

## Commands

```console
npm ci                 # install the exact dependency versions from package-lock.json
npm run dev            # open Remotion Studio (preview + scrubbing)

npm run render:v1      # -> out/HoloGlobe_V1_1080p.mp4  (H.264, 1920x1080, 30 fps)
npm run render:v2      # -> out/HoloGlobe_V2_1080p.mp4
npm run render:v1:4k   # -> out/HoloGlobe_V1_4K.mp4     (H.264, 3840x2160, 30 fps)
npm run render:v2:4k   # -> out/HoloGlobe_V2_4K.mp4
```

The 1080p deliverables come from the same 4K compositions, rendered with `--scale=0.5`. Every size in the scene (line widths, point sizes) is defined relative to the output resolution, so 1080p and 4K renders look the same.

### GPU / headless notes

- `remotion.config.ts` defaults to `--gl=swangle`, which is CPU WebGL through SwiftShader. It works on any machine, including GPU-less servers. On a machine with a GPU, append `-- --gl=angle` to the render scripts for a large speed-up. Example: `npm run render:v1 -- --gl=angle`.
- If Remotion can't download its Chrome Headless Shell (for example, in an offline sandbox), set `REMOTION_BROWSER=/path/to/chrome-headless-shell`.
- Speed reference: CPU-only (4 vCPU, swangle) takes about 1.6 s per frame at 1080p and about 4x that at 4K.

## Project layout

```
src/
  Root.tsx               compositions (4K, 30 fps, 900 frames)
  HoloGlobe.tsx          composition component (+ vignette overlay)
  three/ThreeStage.tsx   deterministic Three.js <-> Remotion bridge (renders per frame)
  three/util.ts          seeded RNG, monotone keyframe tracks, font loader
  globe/config.ts        palette, globe spin and the two camera paths (v1 / v2)
  globe/GlobeScene.ts    scene: digit surface, panels, rings, labels, network, bloom
  globe/shaders.ts       GLSL for digits, labels, points and the atmosphere
  globe/landMask.ts      rasterises world-atlas land polygons into a land mask
public/fonts/            Share Tech Mono (SIL OFL 1.1, licence included)
```

Everything is deterministic: a seeded RNG drives the scene, and every frame is a pure function of the frame number. Remotion's parallel, out-of-order rendering therefore produces identical results.

Data: Natural Earth via the [`world-atlas`](https://github.com/topojson/world-atlas) npm package (public domain / ISC).
