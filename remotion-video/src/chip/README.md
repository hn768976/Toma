# AI Chip Reveal — three variants

Three 30fps motion pieces of an AI accelerator package seating into a
motherboard and bringing the board to life, each matching one reference clip.

| Variant | Composition | Length | Look |
| --- | --- | --- | --- |
| V1 | `Chip-V1-EnergyPulse` | 288f / 9.6s | Near-black board, electric blue-white traces, amber ignition on contact, energy pulse racing outward |
| V2 | `Chip-V2-PorcelainLab` | 240f / 8.0s | Porcelain-white board, pastel glass components, iridescent violet-to-pink package, halftone dot ripple |
| V3 | `Chip-V3-SystemOnline` | 240f / 8.0s | Satin black board, blue holographic package that resolves into glossy black with a white rim; traces cool from blue to white |

Each exists at both `-1080p` and `-4K` (3840×2160). The 4K compositions are the
same scene with `detail: 2`, which doubles the baked texture resolution.

```bash
npx remotion studio                                    # interactive
npx remotion render Chip-V1-EnergyPulse-1080p out.mp4 --codec=h264 --crf=17
npx remotion render Chip-V1-EnergyPulse-4K     out.mp4 --codec=h264 --crf=15
```

## Rendering stack

```
 Pixi.js v8 ──(bakes data textures)──> three.js ──(renders 3D)──> Pixi.js v8
  procedural PCB artwork,              PBR scene,                 bloom, DOF,
  chip lid, "AI" marking               IBL, particles             vignette, grain
```

Pixi is used twice, for two different jobs:

1. **Texture authoring** (`gfx/bake.ts`). The copper artwork is drawn as vector
   geometry and read back as a *data* texture, not a colour one:
   `R` = copper coverage, `G` = distance from the chip along the run,
   `B` = a per-run phase. Because `G` is baked per run, a trace lights up when
   the wavefront reaches *that point along its own path*, not when it reaches a
   straight-line radius — which is what makes the pulse follow the routing
   instead of sweeping over it as a circle.
2. **Post-processing** (`post/overlay.ts`). The three.js canvas is uploaded each
   frame and run through threshold bloom, a macro depth-of-field band, vignette
   and grain.

The traces are sampled inside a real `MeshStandardMaterial` fragment shader
(`scene/boardMaterial.ts`) rather than composited as a 2D overlay, so they stay
lit, occluded and correctly foreshortened as the camera moves.

## Backends

`gfx/caps.ts` resolves a backend: **WebGPU → WebGL2 → WebGL**. Two details are
worth knowing before changing it:

- Headless Chromium exposes `navigator.gpu` but returns `null` from
  `requestAdapter()`, so probing for the namespace alone selects a backend that
  dies on the first draw. Detection insists on a real adapter *and* device, and
  sanity-checks its limits.
- Remotion drives several tabs concurrently and the software GPU stack only
  satisfies the first one's WebGPU device request; the losers get a dead device
  and throw mid-render. So `"auto"` uses WebGL2 during an offline render and
  reserves automatic WebGPU for interactive use.

Override per composition with the `tier` prop (`auto` / `webgpu` / `webgl2` /
`webgl`) — on real GPU hardware, `webgpu` renders fine.

## Determinism

Remotion renders frames out of order across several tabs, so nothing may depend
on wall-clock time or call order. All randomness goes through the seeded
`mulberry32` PRNG in `gfx/random.ts`, and every animated value is a pure
function of the frame number (`scene/animate.ts`).

## Layout

```
config.ts              durations, beats and per-variant palettes
ChipScene.tsx          Remotion component; owns init and the per-frame draw
Root.chip.tsx          the six compositions
gfx/caps.ts            backend detection
gfx/backend.ts         three renderer (WebGPU or WebGL) + shared Pixi renderer
gfx/bake.ts            Pixi-authored board and chip-lid data textures
gfx/traceGraph.ts      octilinear PCB router
gfx/random.ts          seeded PRNG
gfx/easing.ts          easing and spring helpers
scene/build.ts         board, socket, components, chip, particles, lighting
scene/environment.ts   procedural studio IBL (metals are black without it)
scene/boardMaterial.ts trace shader: energy wave, data packets, dot ripple
scene/chipMaterial.ts  package body and lid: Fresnel rim, hologram lattice
scene/animate.ts       camera paths and every per-frame value
post/overlay.ts        Pixi bloom / DOF / vignette / grain
```

## Tuning

Most art direction lives in `config.ts`. `beats` retimes a variant (all motion
is keyed off `seat`, the contact frame); `palette` re-skins it; `env` controls
what the metals and glass reflect.
