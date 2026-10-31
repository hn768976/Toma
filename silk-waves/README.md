# Silk Waves — Composition 2 (Remotion · WebGL 2 fragment shader)

Two 4K (3840×2160) compositions of slow, translucent silk strands drifting
around a dark, eye-shaped void, recreated from the reference clip
(iStock 1757743022).

| Composition ID   | Version | Description |
|------------------|---------|-------------|
| `SilkWaves-V1`   | 1 — reference match | Midnight-navy silk on charcoal: soft defocused folds, sharp sheen edges with fine hair-like fibres, slow undulation. |
| `SilkWaves-V2`   | 2 — alternative palette | Same motion and structure re-graded as champagne-gold silk on warm black. A palette change suits this clip best: it is a flat, camera-less abstract, so a camera move would change little, while the colour completely changes its mood. |

* **Frame rate:** 30 fps
* **Duration:** 300 frames = 10.000 s (identical to the reference).
* All motion is periodic over the 10 s clip, so both versions loop seamlessly.
* **Resolution:** compositions are 4K UHD; the delivered MP4s are rendered from the
  4K compositions with `--scale=0.5` → 1920×1080.

## Technique

* `src/silk/silkShader.ts` – a single GLSL ES 3.00 fragment shader: radial
  background, broad fabric folds, 16 strands (two mirrored families) with
  per-strand defocus, sheen edge, soft veil and anisotropic fibre noise,
  vignette and dithering (avoids banding in the dark gradients after H.264).
* `src/silk/ShaderCanvas.tsx` – minimal WebGL 2 runner (full-screen triangle),
  drawn synchronously for every Remotion frame.
* `src/silk/palettes.ts` – the two colour palettes.
* No external assets are needed. The videos are silent, like the reference.

## Commands

```console
npm i                  # install dependencies (Node 20.19+ / 22.13+)
npm run dev            # open Remotion Studio
npm run render:v1      # out/SilkWaves-V1-1080p.mp4  (H.264, 1080p from the 4K comp)
npm run render:v2      # out/SilkWaves-V2-1080p.mp4
npm run render:v1:4k   # optional: full 4K renders
npm run render:v2:4k
```

Rendering uses `swangle` (SwiftShader) via `remotion.config.ts`, so it works on
machines without a GPU. Append `-- --gl=angle` to use the GPU instead.
