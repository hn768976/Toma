# circuit-chip-beam

A glowing chip on a circuit board powers up and throws a beam of data streaks upward while the
camera pushes in, orbits and sinks to a low angle. Built with Remotion + three.js (WebGL 2).

| Composition | What it is |
|---|---|
| `V1-circuit-chip-beam` | Matches the reference: navy board, electric-blue frame, teal beam |
| `V2-circuit-chip-beam` | Same scene, **one change: the colour palette** (ember orange + gold) |
| `LookDev` | 3 stills (frames 0, 1, 2 = start / peak / late) used for look development |

All compositions are **3840x2160, 30 fps, 440 frames (14.667 s)**. Nothing loops.

## Install

```bash
npm ci
```

## Render

4K masters (the compositions' native size):

```bash
npx remotion render V1-circuit-chip-beam out/01-V1-circuit-chip-beam-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-circuit-chip-beam out/02-V2-circuit-chip-beam-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
```

One 4K frame (quick test):

```bash
npx remotion still V1-circuit-chip-beam out/v1-4k.png --frame=150 --scale=1 --gl=angle
npx remotion still V2-circuit-chip-beam out/v2-4k.png --frame=150 --scale=1 --gl=angle
```

1080p (how the delivered MP4s were made):

```bash
npx remotion render V1-circuit-chip-beam out/01-V1-circuit-chip-beam.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-circuit-chip-beam out/02-V2-circuit-chip-beam.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
```

The WebGL drawing buffer follows `--scale`, so 1080p renders shade 1920x1080 pixels and 4K renders
shade 3840x2160. Line widths, glows and grain are defined relative to the frame, so both look the same.

`remotion.config.ts` uses a locally installed Chrome Headless Shell if one exists at
`/opt/pw-browsers/chromium_headless_shell`; on any other machine Remotion downloads its own.

## What Version 2 changes, and why

Only the **palette** (`PALETTE_V2` in `src/config.ts`): warm-black board, ember-orange frame and
light, gold beam, with a few cool accent parts. The reference already has a full camera move
(push-in, orbit, descent, roll), so changing the camera would fight the original design; a palette
swap is the one change that is obvious at a glance while geometry, timing, camera and every look
setting stay identical.

## Where to change things

| What | Where |
|---|---|
| Colours (both palettes) | `src/config.ts` -> `PALETTE_V1`, `PALETTE_V2` |
| Counts (traces, parts, streaks, dust) | `src/config.ts` -> `COUNTS` |
| Timings (power-up, die rise, beam start) | `src/config.ts` -> `TIMING` |
| Camera path | `src/config.ts` -> `CAMERA_KEYS`, `CAMERA_FOV` |
| Sizes (board, frame, die, beam) | `src/config.ts` -> `SIZES` |
| Duration / fps / resolution | `src/config.ts` -> `DURATION_FRAMES`, `FPS`, `WIDTH`, `HEIGHT` |
| Exposure, light, fog, haze, emissive levels | `src/look.ts` -> `LOOK` |
| Bloom, depth of field, grade, vignette, grain | `src/look.ts` -> `POST` |
| Random layout of the board | `src/config.ts` -> `SEED` |

## How it is built

- `src/lib/ThreeStage.tsx`: a plain WebGL 2 canvas driven only by `useCurrentFrame()`. No
  `requestAnimationFrame`, `useFrame`, clocks or state; each frame is drawn synchronously behind
  `delayRender()`. three.js is used directly rather than through React Three Fiber so that nothing
  but the frame number can drive the picture.
- `src/lib/post.ts`: half-float MSAA scene target -> bloom mip chain -> depth-of-field blur ->
  ACES tone map, grade, vignette, chromatic aberration, fixed film grain (hash of pixel + frame),
  +-1/255 dither.
- `src/scene/board.ts`: the board (routed traces, lit parts, relief blocks) from a seeded
  `mulberry32` generator. No textures, fonts or models are loaded: everything is procedural.
- `src/scene/createScene.ts`, `src/scene/shaders.ts`: meshes, materials and the per-frame update.

## Look development and measurement

```bash
python3 scripts/measure-look.py frame.png                 # numbers for one frame
python3 scripts/measure-look.py ref.png ours.png          # comparison, +-10% / +-10 deg verdicts
scripts/lookdev.sh <reference.mp4>                        # renders LookDev, writes lookdev/compare-*.png
scripts/compare.sh <reference.mp4> V1-circuit-chip-beam out/cmp 0.5 5.0 13.5
python3 scripts/scan-frames.py out/01-V1-circuit-chip-beam.mp4       # black / frozen / flicker scan
```

(`measure-look.py` needs Python 3 with numpy and Pillow. The reference clip is not included.)

## Render time

Measured on a 4-core cloud machine with **no GPU** (ANGLE on software rendering). A machine with a GPU will be much faster.

| | Time |
|---|---|
| 1080p (`--scale=0.5`) | about 1.2 s per frame measured (440 frames in 520 s, rendered alone, default concurrency) |
| 4K (`--scale=1`) | about 4.5 s per frame measured on an 8-frame 4K test (single thread), so roughly 33 minutes for the 440 frames |
