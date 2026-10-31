# Stage Lights — Composition 2 (Remotion, Three.js / React Three Fiber)

A concert lighting rig in haze: four overhead moving heads and four mid-level
spots sweep their beams while their colour wheels rotate through the spectrum
(with the two-colour "split beam" look while the wheel is between filters).
The scene is real 3D (Three.js via `@remotion/three`):

* volumetric beams — each beam is a capped cone hull; the fragment shader
  intersects the view ray with the cone analytically and integrates the
  in-scattered light along the inside segment (soft profile, distance falloff,
  drifting 3D haze noise), so beams stay correct from any camera position;
* a lit back haze layer, lens glows with a faint four-point star;
* an HDR (half-float) render target with exponential tone mapping, vignette and
  dither in a final pass.

Light positions, hue cycles and swing motions were measured from the reference
clip (see `src/stage/lights.ts`). The 10 s animation loops seamlessly.

| Composition ID       | Size        | FPS | Frames | Duration | Variant |
| -------------------- | ----------- | --- | ------ | -------- | ------- |
| `StageLights-V1-4K`  | 3840 × 2160 | 30  | 300    | 10.000 s | V1 — locked-off front camera (matches reference) |
| `StageLights-V2-4K`  | 3840 × 2160 | 30  | 300    | 10.000 s | V2 — alternative camera: low-angle crane arc (≈55° orbit, rise and push-in) |

Reference: 300 frames @ 29.97 fps (10.01 s); at exactly 30 fps the same 300
frames last 10.000 s, the nearest whole-frame match.

## Project layout

```
src/index.ts               registerRoot
src/Root.tsx               both 4K compositions
src/stage/StageLights.tsx  ThreeCanvas scene, per-frame updates, HDR post pass
src/stage/lights.ts        rig definition, measured hue keys and swing curves
src/stage/camera.ts        "locked-off" (V1) and "crane-arc" (V2) camera paths
src/stage/shaders.ts       beam, haze wall, lens glow and post shaders
remotion.config.ts         H.264, yuv420p, CRF 16, PNG frames, ANGLE GL
```

No external assets are needed — everything is procedural.

## Commands

```console
npm ci                      # install exact dependency versions
npm run dev                 # Remotion Studio preview

# 4K masters
npx remotion render StageLights-V1-4K out/StageLights-V1-4K.mp4
npx remotion render StageLights-V2-4K out/StageLights-V2-4K.mp4

# 1080p deliverables (the 4K composition rendered at scale 0.5)
npx remotion render StageLights-V1-4K out/StageLights-V1-1080p.mp4 --scale=0.5
npx remotion render StageLights-V2-4K out/StageLights-V2-1080p.mp4 --scale=0.5
```

### Machines without a GPU

WebGL 2 is required. On a GPU-less machine / container add `--gl=swangle`
(SwiftShader software rendering; expect a few seconds per 4K frame):

```console
npx remotion render StageLights-V1-4K out/StageLights-V1-1080p.mp4 --scale=0.5 --gl=swangle --concurrency=2
```

If Remotion cannot download its headless Chrome (offline / firewalled machine),
point it at an existing Chrome / Chromium headless shell with
`--browser-executable=/path/to/chrome-headless-shell`.
