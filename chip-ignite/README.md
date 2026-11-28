# chip-ignite

A 13.6-second 3D motion graphic built with [Remotion](https://www.remotion.dev)
and three.js: the camera drifts over a dense black-and-silver circuit board, a
small chip comes down into the centre of a large tiled package, starts to
glow, bursts into a flare, and warm light spreads along the circuit lines of
the tiles and out across the board.

Everything is procedural (geometry, textures, environment light) - there are
no models, images, fonts or footage to load.

| Composition       | Size      | fps | Frames | What it is |
|-------------------|-----------|-----|--------|------------|
| `V1-chip-ignite`  | 3840x2160 | 30  | 408    | Version 1 - the reference camera: slow orbit while craning up and back |
| `V2-chip-ignite`  | 3840x2160 | 30  | 408    | Version 2 - same film, different camera movement: starts high and wide, spirals down the other way and pushes in |
| `LookDev`         | 3840x2160 | 30  | 3      | three stills (frames 15, 192, 252) used for look development |

## Install

```bash
npm ci
```

Node 20.19+ / 22.13+ / 24+. Rendering uses WebGL 2 through ANGLE
(`--gl=angle`), which is also set in `remotion.config.ts`.

## Render

4K masters (`--scale=1`):

```bash
npx remotion render V1-chip-ignite out/V1-chip-ignite-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-chip-ignite out/V2-chip-ignite-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
```

One 4K frame (quick check):

```bash
npx remotion still V1-chip-ignite out/V1-frame-252.png --frame=252 --scale=1 --gl=angle
npx remotion still V2-chip-ignite out/V2-frame-252.png --frame=252 --scale=1 --gl=angle
```

1080p (how the delivered MP4s were made - the same composition at half scale):

```bash
npx remotion render V1-chip-ignite out/03-V1-chip-ignite.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-chip-ignite out/04-V2-chip-ignite.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
```

Preview: `npm run dev` (the Studio preview draws at half resolution so that
scrubbing stays responsive).

## What Version 2 changes, and why

**The camera movement** - nothing else. Version 1 follows the reference: a
slow orbit that cranes up and pulls back. Version 2 starts high, wide and
square to the package, then spirals down in the opposite direction and pushes
in, ending low and close on the burning chip.

The reference is a slow, almost static move over a scene that is detailed in
every direction, so a new camera path shows the same design from fresh angles
without touching its black / silver / amber identity (a palette change would
have weakened the warm-against-neutral contrast the ignition relies on). Both
versions use the same component (`src/Film.tsx`), the same scene, light and
timings; the only difference is which `CameraMove` `src/Root.tsx` passes in.

## Where to change things

| What | Where |
|------|-------|
| Colours (glow, flare, gold, silver, LEDs) | `src/config.ts` -> `PALETTE` |
| Timings (chip drop, glow, flare, how fast the lines spread) | `src/config.ts` -> `TIMING` |
| The two camera moves (orbit, height, distance, lens) | `src/config.ts` -> `CAMERA_V1`, `CAMERA_V2` |
| Counts and sizes (small parts, capacitors, lines, package) | `src/config.ts` -> `COUNTS`, `PACKAGE`, `BOARD_SIZE`, `SEED` |
| Exposure, tone mapping, bloom, depth of field, lens fringe, vignette, grain, grade | `src/look.ts` -> `LOOK`, `DOF` |
| Lights and the studio environment (reflections) | `src/look.ts` -> `LIGHTS`, `ENV_LOBES`, `ENV_PANELS` |
| Glow / flare / LED strengths | `src/look.ts` -> `MATERIAL_LOOK` |
| The scene itself | `src/scene/world.ts` |
| Render pipeline (shared engine) | `src/engine/` |

## How it renders (determinism)

- Every animated value is a pure function of `useCurrentFrame()`. There is no
  `Math.random()` (a seeded `mulberry32` stream builds the layout and the
  textures), no `requestAnimationFrame`, no `useFrame`, no clock, no temporal
  accumulation.
- `src/engine/Stage.tsx` sets the scene to the current frame and renders it
  synchronously in a layout effect: scene (MSAA, half-float HDR) -> depth of
  field -> bloom (pmndrs `postprocessing`) -> a final lens/film pass (radial
  colour fringe, vignette, ACES tone mapping, grade, hash-based grain,
  +-1/255 dither).
- Bloom and depth of field work at a fixed internal size, so 1080p and 4K
  renders of a frame have the same glow and blur.
- `remotion.config.ts` sends PNG frames to the encoder and adds x264 settings
  (`aq-mode=3`, weaker deblocking) so that dark gradients keep their dither
  instead of banding. The render commands above need no extra flags.

## Render time

Measured on a 4-core machine with software WebGL (no GPU), default
concurrency:

| | per frame | whole film (408 frames) |
|---|---|---|
| 1080p (`--scale=0.5`), measured | __T1080__ | __TOTAL1080__ |
| 4K (`--scale=1`), estimated from measured 4K stills | __T4K__ | __TOTAL4K__ |

A machine with a GPU will be many times faster.

## Tools

- `scripts/measure-look.py` - measures exposure, colour, glow falloff, haze,
  grain, detail and vignette of a frame (numpy + Pillow).
- `scripts/compare.py` - builds a `reference | ours | difference` sheet.
