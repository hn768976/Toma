# Energy Beam — Composition 1 (Remotion, WebGL 2 shader)

A pulsing vertical energy beam: every 1.125 s a flare bursts at the base, the
beam settles into striated cyan filaments that die off into deep blue, goes dark,
then a white pre-flash triggers the next burst. Rendered procedurally by a
WebGL 2 fragment shader (`src/beam/beamShader.ts`) at native 4K.

| Composition ID      | Size        | FPS | Frames | Duration  | Variant                                  |
| ------------------- | ----------- | --- | ------ | --------- | ---------------------------------------- |
| `EnergyBeam-V1-4K`  | 3840 × 2160 | 30  | 673    | 22.433 s  | V1 — electric cyan / deep blue (matches reference) |
| `EnergyBeam-V2-4K`  | 3840 × 2160 | 30  | 673    | 22.433 s  | V2 — alternative colour palette: solar amber / crimson |

Reference length is 22.4167 s (538 frames @ 24 fps) = 672.5 frames @ 30 fps;
673 frames is the nearest whole-frame length that does not cut content short.

## Project layout

```
src/index.ts              registerRoot
src/Root.tsx              both 4K compositions
src/gl/ShaderCanvas.tsx   minimal WebGL 2 full-screen shader renderer (deterministic, per frame)
src/beam/beamShader.ts    the beam / flare fragment shader
src/beam/palettes.ts      V1 and V2 colour palettes (tone-map tints)
src/beam/EnergyBeam.tsx   composition component
remotion.config.ts        H.264, yuv420p, CRF 16, PNG frames, ANGLE GL
```

No external assets are needed — everything is procedural.

## Commands

```console
npm ci                      # install exact dependency versions
npm run dev                 # Remotion Studio preview

# 4K masters
npx remotion render EnergyBeam-V1-4K out/EnergyBeam-V1-4K.mp4
npx remotion render EnergyBeam-V2-4K out/EnergyBeam-V2-4K.mp4

# 1080p deliverables (the 4K composition rendered at scale 0.5)
npx remotion render EnergyBeam-V1-4K out/EnergyBeam-V1-1080p.mp4 --scale=0.5
npx remotion render EnergyBeam-V2-4K out/EnergyBeam-V2-1080p.mp4 --scale=0.5
```

### Machines without a GPU

WebGL 2 is required. On a GPU-less machine / container add `--gl=swangle`
(SwiftShader software rendering):

```console
npx remotion render EnergyBeam-V1-4K out/EnergyBeam-V1-1080p.mp4 --scale=0.5 --gl=swangle
```

If Remotion cannot download its headless Chrome (offline / firewalled machine),
point it at an existing Chrome / Chromium headless shell with
`--browser-executable=/path/to/chrome-headless-shell`.
