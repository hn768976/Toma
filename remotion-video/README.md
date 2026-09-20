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

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

## Cyber Eye (Remotion + three.js + WebGPU)

Four colourways of a 12 s "cybernetic HUD eye" loop, built from the Meshy
"Ocean Gaze" GLB, rendered through three.js' `WebGPURenderer` inside Remotion.

| Composition            | Size        | fps | Frames | Use            |
| ---------------------- | ----------- | --- | ------ | -------------- |
| `Eye-Blue-4K`          | 3840 x 2160 | 30  | 361    | 4K master      |
| `Eye-Blue-1080p`       | 1920 x 1080 | 30  | 361    | delivery       |
| `Eye-Crimson-4K/1080p` | …           | 30  | 361    |                |
| `Eye-Navy-4K/1080p`    | …           | 30  | 361    |                |
| `Eye-Green-4K/1080p`   | …           | 30  | 361    |                |

361 frames at 30 fps = 12.03 s, matching the 12.05 s / 29.97 fps references.

### Render

```console
npm run render:eye              # the four 1080p H.264 MP4s -> out/
npm run render:eye:4k           # the four 4K masters
npx remotion render Eye-Navy-4K out/navy-4k.mp4 --scale=0.5   # 4K comp, 1080p output
```

Extra flags are passed through, e.g. `npm run render:eye -- --concurrency=2`.

### How it is put together

- `src/cyber-eye/EyeCanvas.tsx` bridges `useCurrentFrame()` to a
  `WebGPURenderer`. Every frame registers `delayRender()` and releases it only
  after `queue.onSubmittedWorkDone()`, so screenshots are never half-drawn.
- `src/cyber-eye/scene/eyeParticles.ts` turns the GLB into ~130k additive
  sprites (mesh vertices + area-weighted surface samples) plus a faint
  wireframe. TSL nodes drive the twinkle and the brightness wave.
- `src/cyber-eye/scene/hudIris.ts` is the procedural HUD iris: dashed rings,
  rotating arcs, a TSL "radial streak" burst, the pupil, lens-flare sprites,
  a warm horizontal streak and a scan line.
- `src/cyber-eye/scene/createEyeScene.ts` assembles camera, bloom
  post-processing (`three/addons/tsl/display/BloomNode`) and the slow orbit.
- `src/cyber-eye/HudOverlay.tsx` is the crisp SVG HUD chrome (Share Tech Mono).
- `src/cyber-eye/palettes.ts` holds the four colourways; everything reads
  from there.

### WebGPU in headless Chrome

Remotion always launches Chromium with `--enable-unsafe-webgpu`. On Linux the
config additionally selects `--gl=vulkan`; on a machine without a GPU, point
the Vulkan loader at Chromium's SwiftShader (`VK_ICD_FILENAMES`, done
automatically in `remotion.config.ts` for the Playwright Chromium path).
`src/cyber-eye/webgpu-compat.ts` works around a `createView({ swizzle })`
mismatch between three r186 and older Dawn builds.

Software rendering is slow (~5 s per 1080p frame, ~20 s per 4K frame). With a
real GPU the same project renders in a few seconds per second of video.

### Model clean-up

The raw Meshy export had 4,846 disconnected shells and no materials.
`tools/clean-model.py` drops the debris, finds the pupil hole and re-centres
the mesh on it; `npm run model:optimize` welds, simplifies (60%) and prunes it
into `public/models/eye.glb` (1.2 MB, 54k vertices).

```console
pip install trimesh numpy scipy networkx
npm run model:clean && npm run model:optimize
```
