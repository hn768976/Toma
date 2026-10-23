# Clock Spiral — Remotion project (Composition 1)

An endless fall into a spiralling antique clock dial: Roman-numeral dial strip
wound into a logarithmic spiral, sweeping clock hands, smoky troughs, lens
blur toward the edges, chromatic fringe, glow and vignette.

* Technology: **WebGL 2 fragment shaders** (two passes) + **Canvas 2D** for the
  procedural dial and smoke textures. No image, font or video assets — every
  pixel is generated from a fixed seed, so renders are deterministic.
* Compositions (3840 × 2160, 30 fps, 431 frames = 14.367 s):

| ID                  | Version | Description                                      |
| ------------------- | ------- | ------------------------------------------------ |
| `ClockSpiral-V1-4K` | V1      | Matches the reference: sepia parchment, amber glow |
| `ClockSpiral-V2-4K` | V2      | Alternative colour palette: moonlit silver dial, ice-blue/teal troughs |

The reference clip is 14.381 s; 431 frames is the closest whole-frame length at
30 fps (difference 14 ms, under half a frame).

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* Remotion downloads its own Chrome Headless Shell on first render.
* No GPU needed: the config uses `--gl=angle`, which falls back to SwiftShader
  (software). On a CPU-only machine a 4K frame takes ~3 s.

## Commands

```console
npm i                      # install dependencies
npm run dev                # Remotion Studio preview

# 4K masters
npm run render:v1:4k       # -> out/ClockSpiral-V1-4K.mp4
npm run render:v2:4k       # -> out/ClockSpiral-V2-4K.mp4

# 1080p delivery files (4K composition rendered at --scale=0.5)
npm run render:v1:1080p    # -> out/ClockSpiral-V1-1080p.mp4
npm run render:v2:1080p    # -> out/ClockSpiral-V2-1080p.mp4

npm run lint               # eslint + TypeScript check
```

Or directly with the CLI, e.g.
`npx remotion render ClockSpiral-V1-4K out/v1.mp4 --codec=h264`.
Output is H.264 / yuv420p MP4 (set in `remotion.config.ts`).

## Layout

```
src/
  index.ts, Root.tsx        registerRoot + the two 4K compositions
  constants.ts              resolution, fps, duration
  clock-spiral/
    ClockSpiral.tsx         WebGL 2 setup and per-frame animation
    shaders.ts              pass 1 (log-polar spiral) and pass 2 (lens, hands, grade)
    textures.ts             Canvas 2D dial strip (Roman numerals, ticks, rim) and noise
    palettes.ts             V1 sepia / V2 frost colours
    random.ts               seeded PRNG
remotion.config.ts          codec, pixel format, GL backend, JPEG quality
```
