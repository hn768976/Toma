# Light Streams — Composition 1 (Remotion · Three.js / WebGL 2)

Two 4K (3840×2160) compositions of glowing light lines flowing over animated
3D surfaces, recreated from the reference clip (iStock 1367857608).

| Composition ID     | Version | Description |
|--------------------|---------|-------------|
| `LightStreams-V1`  | 1 — reference match | Shot A (0–4.0 s): a sheet of lines climbs away from the camera into a tall wall on the left and sweeps right towards the horizon. Hard cut at 4.0 s (as in the reference) to Shot B: the sheet folds into a hairpin and its far branch curls up into a wall on the right. Near-locked camera with a subtle push, travelling light streaks, depth of field, sparkles. |
| `LightStreams-V2`  | 2 — alternative camera | Same scenes and palette, re-shot with sweeping camera moves: Shot A is a low, banked (dutch-angle) truck shot moving right-to-left along the foot of the wall; Shot B is an overhead crane that starts nearly top-down and orbits ~120° around the hairpin while descending. |

* **Frame rate:** 30 fps
* **Duration:** 241 frames = 8.033 s. The reference is 8.04 s (201 frames @ 25 fps);
  8.04 s × 30 = 241.2 frames, so 241 whole frames is the closest possible length
  (6.7 ms shorter than the reference — less than a quarter of one frame).
* **Resolution:** compositions are 4K UHD; the delivered MP4s are rendered from the
  4K compositions with `--scale=0.5` → 1920×1080.

## Technique

* `src/streams/surfaces.ts` – procedural, time-animated surfaces (CPU, deterministic).
* `src/streams/StreamRenderer.ts` – Three.js renderer. Each line is a screen-space
  ribbon (MeshLine technique) with a Gaussian profile; its width grows with the
  circle of confusion for depth-of-field while keeping its energy constant.
  Lines are accumulated additively into a half-float target, then a two-level
  bloom, filmic tone-map, background gradient, vignette and dithering are applied.
* `src/streams/shaders.ts` – all GLSL.
* `src/streams/look.ts` – line colour swatches, background and both camera rigs.
* No external assets (textures, fonts, audio) are needed. The videos are silent,
  like the reference.

## Commands

```console
npm i                  # install dependencies (Node 20.19+ / 22.13+)
npm run dev            # open Remotion Studio
npm run render:v1      # out/LightStreams-V1-1080p.mp4  (H.264, 1080p from the 4K comp)
npm run render:v2      # out/LightStreams-V2-1080p.mp4
npm run render:v1:4k   # optional: full 4K renders
npm run render:v2:4k
```

Rendering uses `swangle` (SwiftShader) via `remotion.config.ts`, so it works on
machines without a GPU (≈2 s/frame at 4K on 4 CPU cores). Append `-- --gl=angle`
to use the GPU instead, e.g. `npm run render:v1 -- --gl=angle`.
