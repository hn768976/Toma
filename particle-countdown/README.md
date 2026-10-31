# Composition 2 — Glitter Particle Countdown (4K, Remotion + raw WebGL 2)

A countdown from 10 to 1. Each number condenses out of fine glitter, flashes,
then bursts into a rising cloud of glitter, coloured bokeh and soft haze while
the next number forms in the same place. The clip ends on black.

| Composition ID       | Version | Description                                                                |
| -------------------- | ------- | -------------------------------------------------------------------------- |
| `Countdown-V1-Match` | V1      | Matches the reference: silver-blue glitter, magenta/teal/green bokeh, black background |
| `Countdown-V2-Ember` | V2      | Alternative **colour palette**: molten-gold glitter, ember/amber/rose bokeh, warm-black background |

* **Resolution:** 3840 × 2160 (4K UHD) master compositions
* **Frame rate:** 30 fps
* **Duration:** 345 frames = 11.5 s (identical to the reference clip)
* **Timing:** a new number every 30 frames, measured from the reference's luminance curve
  (see `src/countdown/timeline.ts`)
* **Technology:** raw **WebGL 2** with GLSL ES 3.00 shaders and no 3D library:
  * tens of thousands of GPU particles per number. The positions are sampled from the bundled
    Barlow Medium glyphs. Each particle's whole life (condense, flash, burst, drift,
    fade) is evaluated in the vertex shader from static seeds and the frame number,
    so there is no simulation state and frames are deterministic.
  * Additive HDR (RGBA16F) accumulation, a two-level separable Gaussian bloom
    (1/4 and 1/16 resolution), an exponential tone curve and a dithered composite.

## Commands

```bash
npm install                 # install dependencies (Node 20.19+/22.13+)
npm run dev                 # Remotion Studio (compositions under "Particle-Countdown-4K")

# Deliverables: 4K composition supersampled to 1920×1080, H.264 MP4
npm run render:v1           # -> out/Particle_Countdown_V1_Match_1080p.mp4
npm run render:v2           # -> out/Particle_Countdown_V2_Ember_1080p.mp4
npm run render:all

# Full 4K masters (3840×2160, H.264 MP4)
npm run render:v1:4k
npm run render:v2:4k

# Equivalent raw CLI
npx remotion render Countdown-V1-Match out/v1.mp4 --scale=0.5
npx remotion still  Countdown-V1-Match out/frame26.png --frame=26
```

Codec (H.264, yuv420p, CRF 16), GL backend and timeouts are set in `remotion.config.ts`.
SwiftShader (`swangle`) is the default, so the project renders on GPU-less machines.
Pass `--gl=angle` on a GPU workstation for speed.

## Project structure

```
public/fonts/
  Barlow-Medium.woff2       numeral font (SIL Open Font License, see Barlow-OFL-LICENSE.txt)
src/
  index.ts / Root.tsx       registerRoot + the two 4K compositions
  countdown/
    ParticleCountdown.tsx   Remotion component (loads font, delayRender, renders on every frame)
    CountdownRenderer.ts    WebGL 2 setup, particle buffers, bloom chain, composite
    shaders.ts              GLSL ES 3.00: particle VS/FS, downsample, blur, composite
    glyphs.ts               rasterise numbers → deterministic particle positions
    palette.ts              COOL (V1) and EMBER (V2) palettes
    timeline.ts             peak frames, formation/dissolve lengths, ambient level
remotion.config.ts
```
