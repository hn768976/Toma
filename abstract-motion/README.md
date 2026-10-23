# Abstract Motion: Question Field & Color Burst

This is a Remotion 4 project, scaffolded with `npx create-video --blank`. It holds two motion-graphics compositions, and each composition has two versions. All four are authored at **4K UHD (3840×2160), 30 fps**.

| Composition ID     | Reference clip      | Duration                 | Technology                                    | Version |
| ------------------ | ------------------- | ------------------------ | --------------------------------------------- | ------- |
| `QuestionField-V1` | glowing "?" in a field of "!" | 240 frames (8.000 s) | Three.js (WebGL 2), shadows, bokeh DOF, bloom | Matches the reference: slow pull-back, rise and drift around the "?" |
| `QuestionField-V2` | same                | 240 frames (8.000 s)     | same                                          | Alternative **camera**: low-angle hero orbit (~120°) through the field |
| `ColorBurst-V1`    | powder explosion    | 301 frames (10.033 s)    | Raw WebGL 2 shaders (instanced streak particles) | Matches the reference: violet/ultramarine body, crimson plume |
| `ColorBurst-V2`    | same                | 301 frames (10.033 s)    | same                                          | Alternative **palette**: "solar" amber/gold, ember red, teal glints |

The reference for ColorBurst lasts 10.04 s (251 frames at 25 fps). At 30 fps that would be 301.2 frames. A video can only hold whole frames, so 301 frames (10.033 s) is the closest possible length.

## Setup

Requires Node.js 20.19+, 22.13+ or 24+.

```bash
npm install
npm run dev          # Remotion Studio preview
```

## Rendering

These commands render the 1080p H.264 deliverables from the 4K compositions. `--scale=0.5` downsamples each 4K frame to 1920×1080:

```bash
npx remotion render QuestionField-V1 out/Composition1_Version1_1080p.mp4 --scale=0.5 --crf=18
npx remotion render QuestionField-V2 out/Composition1_Version2_1080p.mp4 --scale=0.5 --crf=18
npx remotion render ColorBurst-V1   out/Composition2_Version1_1080p.mp4 --scale=0.5 --crf=18
npx remotion render ColorBurst-V2   out/Composition2_Version2_1080p.mp4 --scale=0.5 --crf=18
```

To render the native 4K masters instead, leave out `--scale=0.5`.

The codec (`h264`), pixel format (`yuv420p`), colour space (limited-range BT.709) and WebGL backend are set in `remotion.config.ts`.

### Machines without a GPU

Both scenes are WebGL. On a headless server without a GPU, add three flags:

- `--gl=swangle` uses software rendering (SwiftShader).
- `--timeout=300000` gives slow 4K frames more time.
- A lower concurrency, for example `--concurrency=2`.

```bash
npx remotion render QuestionField-V1 out/Composition1_Version1_1080p.mp4 --scale=0.5 --crf=18 --gl=swangle --concurrency=2 --timeout=300000
```

## Structure

```
src/
  Root.tsx                     4 compositions (3840x2160, 30 fps)
  lib/random.ts                seeded PRNG + easing helpers (deterministic frames)
  question-field/
    scene.ts                   Three.js scene, instanced "!" field, glowing "?", post FX
    QuestionField.tsx          per-frame camera/glow animation, V1/V2 camera paths
  color-burst/
    burst-gl.ts                WebGL 2 particle renderer + tone-mapping pass
    palettes.ts                reference + "solar" palettes
    ColorBurst.tsx             expansion / collapse timeline, camera drift
```

Every frame is a pure function of the frame number. All randomness is seeded, and nothing depends on the previous frame. As a result, any frame range renders the same way, in any order, and at any concurrency. The project needs no external assets.
