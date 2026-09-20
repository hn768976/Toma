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
| `AiCodeCity`     | 1920 x 1080 | V1 — identical "AI" cards rising over a bed of scrolling code                |
| `AiCodeCity4K`   | 3840 x 2160 | V1 at 4K                                                                     |
| `AiCodeWall`     | 1920 x 1080 | V2 — full-frame wall of scrolling code, top glow, breathing focus plane      |
| `AiCodeWall4K`   | 3840 x 2160 | V2 at 4K                                                                     |
| `AiNetwork`      | 1920 x 1080 | V3 — dim code bed under a drifting graph of ringed "AI" nodes                |
| `AiNetwork4K`    | 3840 x 2160 | V3 at 4K                                                                     |

All six are 300 frames at 30fps (10.000s) and seamlessly loopable: frame
300 is identical to frame 0, so they can be cut end-to-end or set to
`loop` in a player with no visible join.

### Rendering

These are the exact flags the delivered 1080p files were rendered with:

```console
FLAGS="--codec=h264 --crf=16 --muted --color-space=bt709 --image-format=png"

npx remotion render AiCodeCity out/ai-code-v1-code-city-1080p.mp4 $FLAGS
npx remotion render AiCodeWall out/ai-code-v2-code-wall-1080p.mp4 $FLAGS
npx remotion render AiNetwork  out/ai-code-v3-ai-network-1080p.mp4 $FLAGS
```

Swap the composition ID for the 4K variant to get 3840x2160:

```console
npx remotion render AiCodeCity4K out/ai-code-v1-code-city-4k.mp4 $FLAGS
npx remotion render AiCodeWall4K out/ai-code-v2-code-wall-4k.mp4 $FLAGS
npx remotion render AiNetwork4K  out/ai-code-v3-ai-network-4k.mp4 $FLAGS
```

Why those flags:

- `--muted` drops the silent audio track Remotion adds by default. With
  it the container is exactly 10.000s; without it the audio stream runs
  slightly long and the file reports 10.05s.
- `--color-space=bt709` gives limited-range `yuv420p (tv, bt709)`
  instead of the default full-range `yuvj420p`, so levels are not
  crushed or lifted by players and NLEs that assume broadcast range.
- `--image-format=png` avoids JPEG banding in the intermediate frames.
  These plates are almost entirely dark gradients, which is exactly
  where that banding shows.

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
- **PixiJS v8** draws the 2D optical pass on top — lens veil, top glow,
  bokeh and grain — composited with `screen`.
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

### Per-plate notes

- **V1** keeps every card at one size on a single depth plane, so they
  all read at exactly the same scale. Cards wrap well outside the frame,
  which is why they need no fade to hide the join. The background code
  never moves: it scrolls *inside* its panels by whole texture repeats,
  so there is nothing to dissolve at a panel edge.
- **V2** carries no overlaid graphics at all — no rays, no flicker bars,
  not even selection bands inside the code sheets. Only the cool wash
  across the top. Its blur is measured against the band nearest the
  focus rather than against the focus itself: with three discrete bands
  a continuous sweep almost never lands on a centre, and measuring
  absolutely leaves every band slightly soft at once. Panel x, vertical
  phase and depth are stratified on decorrelated strides, because purely
  random placement leaves holes and a hole in the sharp band reads as a
  dead patch of frame.
- **V3** has no free-floating lettering: every "AI" on screen belongs to
  a node and is ringed by its circle or wireframe sphere.

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
