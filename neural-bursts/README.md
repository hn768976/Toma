# Neural Bursts — Remotion project (4K)

Two motion-graphics compositions, each in two versions, authored as
**3840×2160 (UHD 4K) masters at 30 fps**. Created with the Remotion CLI
(`npx create-video --three`) and rendered with Three.js (WebGL 2) using
custom GLSL shaders and a custom HDR bloom pipeline.

| Composition ID     | Description                                                         | Frames | Duration |
| ------------------ | ------------------------------------------------------------------- | -----: | -------: |
| `NeuralBurst-V1`   | Comp 1, V1 — glass sphere → ray burst → bead star → fly-through → particle-network explosion (reference blue palette) | 421 | 14.033 s |
| `NeuralBurst-V2`   | Comp 1, V2 — identical motion, **"solar" colour palette** (gold/amber/crimson) | 421 | 14.033 s |
| `NeuronFiring-V1`  | Comp 2, V1 — glowing particle neuron, dendrites, light orbs, bokeh, lens flare (reference camera drift) | 600 | 20.000 s |
| `NeuronFiring-V2`  | Comp 2, V2 — same neuron with a **sweeping low-angle orbit, dolly-in and rack focus** | 600 | 20.000 s |

`*-Preview` compositions (960×540) render the same scenes for fast
iteration in the Studio — every size in the scenes is resolution
independent.

Composition 1's reference is 14.04 s long; at 30 fps the nearest whole
frame count is 421 frames (14.033 s), which is what the masters use.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- A Chrome that supports WebGL 2. Remotion downloads its own Chrome
  Headless Shell on first render; ANGLE is enabled in
  `remotion.config.ts`, so rendering works with or without a GPU (software
  GL is slower: ~1.5–2 s per 4K frame on 4 CPU cores).

## Commands

```console
npm install                    # install dependencies (uses package-lock.json)
npm run dev                    # open Remotion Studio
npm run lint                   # eslint + TypeScript check

# 4K masters (3840x2160, H.264 MP4)
npx remotion render NeuralBurst-V1  out/NeuralBurst-V1-4K.mp4
npx remotion render NeuralBurst-V2  out/NeuralBurst-V2-4K.mp4
npx remotion render NeuronFiring-V1 out/NeuronFiring-V1-4K.mp4
npx remotion render NeuronFiring-V2 out/NeuronFiring-V2-4K.mp4

# 1080p delivery files (the 4K composition, scaled 0.5 on output;
# WebGL still draws at 4K, so the 1080p frame is supersampled)
npx remotion render NeuralBurst-V1  out/NeuralBurst-V1-1080p.mp4 --scale=0.5
npx remotion render NeuralBurst-V2  out/NeuralBurst-V2-1080p.mp4 --scale=0.5
npx remotion render NeuronFiring-V1 out/NeuronFiring-V1-1080p.mp4 --scale=0.5
npx remotion render NeuronFiring-V2 out/NeuronFiring-V2-1080p.mp4 --scale=0.5

# or all at once
npm run render:all-1080p
npm run render:all-4k
```

Output settings (from `remotion.config.ts`): H.264, yuv420p, CRF 16,
PNG intermediate frames, 30 fps. No audio.

## Structure

```
src/
  Root.tsx                 compositions (4K masters + 540p previews)
  lib/
    GLStage.tsx            hosts a Three.js scene in Remotion; renders one
                           deterministic frame per Remotion frame
    post.ts                HDR bloom (dual-filter pyramid), tone map,
                           vignette, lens flare/streak, dither
    glsl.ts                shared shaders: glow / bead / bokeh sprites,
                           screen-space ribbons
    cloud.ts               animated point clouds (burst, twinkle, drift, DOF)
    segments.ts            static 3D ribbons with depth of field
    math.ts                seeded RNG, easing, keyframe tracks, colours
  burst/                   Composition 1 (scene, palettes, component)
  neuron/                  Composition 2 (scene + camera paths, component)
```

All randomness is seeded and every frame is a pure function of time, so
renders are deterministic and can be split across any number of workers.
No external assets are required (everything is procedural).
