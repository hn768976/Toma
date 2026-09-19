# Four abstract motion-graphic versions

Four self-contained abstract pieces, each a re-creation of one supplied
reference clip. No text, no logo — they are backgrounds you composite over.

| Composition id | Duration | Frames @30fps | Look |
| --- | --- | --- | --- |
| `V1-Mosaic`  | 16.17s | 485 | Layered grid of rectangles recolouring in waves — white → blues → cyan |
| `V2-Streaks` |  6.00s | 180 | Horizontal speed streaks, cutting between a dark and a light treatment |
| `V3-Bars`    | 20.43s | 613 | Monochrome stripes rotating vertical → diagonal → horizontal |
| `V4-Blocks`  |  3.63s | 109 | Orange/violet/black blocks snapping in over white, topped and tailed in black |

Every version is registered twice: at `1920x1080` under the id above, and at
`3840x2160` under `<id>-4K`. The scenes are resolution independent, so the two
render identically apart from pixel count.

## Rendering

```bash
npm install

# 1080p delivery
npx remotion render V1-Mosaic out/V1-Mosaic-1080p.mp4 --codec=h264 --crf=16

# 4K master
npx remotion render V1-Mosaic-4K out/V1-Mosaic-4K.mp4 --codec=h264 --crf=16

# Interactive preview of all compositions
npm run dev
```

4K renders are considerably slower than 1080p here because the sandbox has no
GPU and WebGL runs through SwiftShader. On a machine with a real GPU, drop
`Config.setChromiumOpenGlRenderer("swangle")` from `remotion.config.ts` to use
hardware acceleration.

## How it is built

Remotion drives the timeline; **PixiJS v8** owns every pixel inside the frame.

`PixiStage.tsx` is the bridge. Remotion screenshots the page once React has
committed and all `delayRender()` handles have resolved, so the contract is:

1. initialise Pixi once behind a `delayRender()` handle (v8's `init` is async),
2. paint frame 0 *before* releasing that handle, so the first screenshot is
   never blank,
3. redraw synchronously in a `useLayoutEffect` keyed on `useCurrentFrame()`,
4. keep `preserveDrawingBuffer: true` — without it the WebGL buffer can be
   cleared before the screenshot lands and every frame renders black.

The Pixi app is created once and reused across frames: Remotion keeps the same
page and seeks, so the component never unmounts mid-render.

### Shaders vs display objects

Two of the versions are pure fragment shaders, two are Pixi display objects,
chosen by what each look actually needs:

- **V1 and V3** are procedural fields — every pixel is a function of position
  and time — so they are single full-screen meshes with custom GLSL ES 3.00
  fragment shaders (`shaders/fullscreen.ts`). The vertex shader writes clip
  space directly instead of going through Pixi's projection matrices, so one
  oversized triangle always covers the viewport at any resolution.
- **V2 and V4** are made of discrete objects with their own lifetimes, so they
  use `Graphics` and `Container`, animated per frame.

Two details worth keeping:

- **V1's palette is baked into the shader source** from `constants.ts` rather
  than passed as a uniform. A `uniform vec3[8]` is padded to `vec4` by std140
  and reads back misaligned; the ramp never changes at runtime, so a
  compile-time constant is both safer and keeps one source of truth.
- **V3's contrast flips are seamless.** The stripe duty ramps to 1 so the frame
  goes fully solid, the fore/background swap happens on that solid frame, then
  the duty ramps up from 0 again. Width variation fades out as the duty nears 1
  so the fill really is complete. Nothing ever cuts.

### Determinism

All randomness comes from the seeded `mulberry32` in `rng.ts`, or from
hash functions inside the shaders. Re-rendering produces identical output, and
1080p and 4K agree frame for frame.
