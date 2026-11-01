# Tube Bloom — Remotion project (4K master)

A field of porcelain "pincushion" tori, each wound with raspberry-mouthed
tubes, blooms open into flat spirograph flowers whose petals weave over and
under the neighbouring flowers, morphs through several woven patterns, then
curls back into the starting tori.

* **Technology:** Three.js (WebGL 2). Every tube is an instanced cylinder whose
  centre-line (a twisted poloidal loop on a torus) is evaluated on the GPU,
  so the whole bloom is a smooth morph of a few torus parameters. A custom
  post pass adds depth of field, vignette and fine grain. No external assets.
* **Compositions (both 3840×2160, 30 fps, 270 frames = 9.000 s):**
  * `TubeBloom-V1-Match` — matches the reference: locked-off top-down camera.
  * `TubeBloom-V2-LowOrbit` — alternative camera: a low, oblique camera
    that orbits ~57° around the gap between the two central flowers while
    pushing in, with a shallow macro depth of field.

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* Chrome Headless Shell — Remotion downloads it automatically on first render.
  Offline machines can point to an existing one:
  `export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`

## Commands

```console
npm ci                      # install exact dependency versions
npm run dev                 # Remotion Studio preview

# 1080p deliverables (4K composition rendered at scale 0.5 → 1920×1080, H.264)
npx remotion render TubeBloom-V1-Match out/TubeBloom_V1_1080p.mp4 --scale=0.5
npx remotion render TubeBloom-V2-LowOrbit out/TubeBloom_V2_1080p.mp4 --scale=0.5

# Full 4K UHD masters
npx remotion render TubeBloom-V1-Match out/TubeBloom_V1_4K.mp4
npx remotion render TubeBloom-V2-LowOrbit out/TubeBloom_V2_4K.mp4
```

`remotion.config.ts` sets H.264 / yuv420p / CRF 16 and the `swangle`
(software) WebGL backend so renders work on servers without a GPU. On a
workstation with a GPU add `--gl=angle` for much faster renders.

## Source layout

| File | Purpose |
| --- | --- |
| `src/Root.tsx` | 4K composition definitions (size, fps, duration) |
| `src/bloom/TubeBloom.tsx` | Canvas + Three.js lifecycle, per-frame render |
| `src/bloom/scene.ts` | Renderer, instanced tube/body meshes, DOF pass |
| `src/bloom/shaders.ts` | GLSL: tube curve, shading, torus body, DOF |
| `src/bloom/timeline.ts` | Key-framed bloom / pattern / colour timeline |
| `src/bloom/cameras.ts` | V1 top-down and V2 low-orbit camera paths |
| `src/bloom/looks.ts` | Colour palette sampled from the reference |
| `src/bloom/keyframes.ts` | Monotone cubic key-frame interpolation |

## Note on duration

The reference is 270 frames at 29.97 fps (9.009 s). At exactly 30 fps the
same 270 frames last 9.000 s, which is the closest frame-accurate match:
every frame of the reference has a counterpart.
