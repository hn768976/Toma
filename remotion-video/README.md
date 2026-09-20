# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## AI code background plates

Three loopable 10s motion-graphic backgrounds, 30fps, built to match a
set of reference plates. Each exists at 1080p and at 4K UHD.

| Composition ID   | Size        | What it is                                                                  |
| ---------------- | ----------- | --------------------------------------------------------------------------- |
| `AiCodeCity`     | 1920 x 1080 | V1 — fly-through of code panels, glass slabs, beaded beams and "AI" chips    |
| `AiCodeCity4K`   | 3840 x 2160 | V1 at 4K                                                                     |
| `AiCodeWall`     | 1920 x 1080 | V2 — full-frame wall of scrolling code, top glow, ray fan, focus breathing   |
| `AiCodeWall4K`   | 3840 x 2160 | V2 at 4K                                                                     |
| `AiNetwork`      | 1920 x 1080 | V3 — dim code bed under a drifting graph of "AI" nodes, defocused lettering  |
| `AiNetwork4K`    | 3840 x 2160 | V3 at 4K                                                                     |

All six are 300 frames at 30fps (10.000s) and seamlessly loopable: frame
300 is identical to frame 0, so they can be cut end-to-end or set to
`loop` in a player with no visible join.

### Rendering

```console
npx remotion render AiCodeCity   out/v1-1080p.mp4 --codec=h264 --crf=16
npx remotion render AiCodeWall   out/v2-1080p.mp4 --codec=h264 --crf=16
npx remotion render AiNetwork    out/v3-1080p.mp4 --codec=h264 --crf=16

npx remotion render AiCodeCity4K out/v1-4k.mp4 --codec=h264 --crf=16
npx remotion render AiCodeWall4K out/v2-4k.mp4 --codec=h264 --crf=16
npx remotion render AiNetwork4K  out/v3-4k.mp4 --codec=h264 --crf=16
```

The 4K compositions render the same picture, not a different one: a
`resolutionScale` prop drives texture resolution, particle counts, blur
radii and grain together, so 4K is a true 2x of the 1080p framing rather
than an upscale.

4K is roughly 4-6x the cost of 1080p per frame and needs more headroom;
on a machine without a hardware GPU, add `--concurrency=2` if a render
runs out of memory.

### How it is built

- **Remotion** owns time. Every animator in `src/ai-code` is a pure
  function of the frame number — no `Math.random()`, no `Date.now()`, no
  ticker-driven state. Remotion renders frames out of order across
  worker processes, so anything else would flicker or drift.
- **three.js** draws the 3D layer: code panels, chips, slabs, beams,
  nodes and lettering, all as additive emissive quads.
- **PixiJS v8** draws the 2D optical pass on top — lens veil, anamorphic
  flares, the ray fan, bokeh and grain — composited with `screen`.
- **WebGPU with a WebGL2/WebGL fallback.** `src/ai-code/gpu.ts` probes
  the backend once per page and hands the same answer to both three.js
  and Pixi, so a frame is never half one backend and half the other. The
  probe is an end-to-end render-and-read-back, not a feature check:
  headless and software Chromium hand out a WebGPU adapter and a device
  and then fail to allocate the canvas swap chain, which would silently
  produce 300 blank frames. three.js reaches WebGPU through a dynamic
  `import("three/webgpu")` that only loads when the probe passes, and
  falls back to `WebGLRenderer` if the renderer still fails to start.
- Because three's WebGPU renderer cannot compile raw GLSL, the scenes
  use core materials only, and depth of field is done by compositing
  depth bands (`src/ai-code/ThreeStage.tsx`) rather than with a bokeh
  shader pass. Every material is additive, so summing the bands is
  equivalent to drawing them together.

### Content and licensing

The on-screen code in `src/ai-code/code-source.ts` was written for this
project. It is ML-flavoured Python — tensors, dtypes, sparse kernels,
distributed state utilities — but it is not copied from any library.

`public/fonts/JetBrainsMono-*.woff2` is JetBrains Mono, SIL Open Font
License 1.1; the licence ships alongside it as
`public/fonts/JetBrainsMono-OFL.txt`. It is self-hosted so a render never
depends on a network fetch.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
