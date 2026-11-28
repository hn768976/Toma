# ai-chip-reveal

A 10-second 3D motion graphic built with [Remotion](https://www.remotion.dev)
and three.js: a close-up of a glowing "AI" processor in its socket, a whip
pull-back with a full spin of the board, and the whole motherboard floating
in a dark grey void while its parts drift back into place.

Everything is procedural (geometry, textures, environment light) - there are
no models, images, fonts or footage to load.

| Composition          | Size      | fps | Frames | What it is |
|----------------------|-----------|-----|--------|------------|
| `V1-ai-chip-reveal`  | 3840x2160 | 30  | 301    | Version 1 - the reference look: black, silver and amber |
| `V2-ai-chip-reveal`  | 3840x2160 | 30  | 301    | Version 2 - same film, cold palette: black, silver and electric cyan |
| `LookDev`            | 3840x2160 | 30  | 3      | three stills (frames 15, 45, 180) used for look development |

## Install

```bash
npm ci
```

Node 20.19+ / 22.13+ / 24+. Rendering uses WebGL 2 through ANGLE
(`--gl=angle`), which is also set in `remotion.config.ts`.

## Render

4K masters (`--scale=1`):

```bash
npx remotion render V1-ai-chip-reveal out/V1-ai-chip-reveal-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-ai-chip-reveal out/V2-ai-chip-reveal-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
```

One 4K frame (quick check):

```bash
npx remotion still V1-ai-chip-reveal out/V1-frame-150.png --frame=150 --scale=1 --gl=angle
npx remotion still V2-ai-chip-reveal out/V2-frame-150.png --frame=150 --scale=1 --gl=angle
```

1080p (how the delivered MP4s were made - the same composition at half scale):

```bash
npx remotion render V1-ai-chip-reveal out/01-V1-ai-chip-reveal.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-ai-chip-reveal out/02-V2-ai-chip-reveal.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
```

Preview: `npm run dev` (the Studio preview draws at half resolution so that
scrubbing stays responsive).

## What Version 2 changes, and why

**The colour palette** - nothing else. The amber traces, letters, pin plating
and warm fill light become electric cyan, pale ice-blue and cool steel.

The signature of this piece is its camera: the angled close-up, the whip
pull-back and the spin. Changing the camera would make it a different film,
while a palette swap keeps the design and timing identical and is visible at
a glance. Both versions use the same component (`src/Film.tsx`); the only
difference is which palette object `src/Root.tsx` passes in.

## Where to change things

| What | Where |
|------|-------|
| Colours (both palettes) | `src/config.ts` -> `PALETTE_V1`, `PALETTE_V2` |
| Timings (whip start, flash, motion-blur window, end fade) | `src/config.ts` -> `TIMING` |
| Assembly: how far each group of parts floats out and when it settles | `src/config.ts` -> `ASSEMBLY` |
| Camera and board motion keyframes (distance, azimuth, spin, lens) | `src/config.ts` -> `MOTION` |
| Counts and sizes (pins, traces, small parts, slots...) | `src/config.ts` -> `COUNTS`, `BOARD`, `SOCKET`, `SEED` |
| Exposure, tone mapping, bloom, depth of field, grain, grade | `src/look.ts` -> `LOOK`, `DOF` |
| Lights and the studio environment (reflections) | `src/look.ts` -> `LIGHTS`, `ENV_LOBES`, `ENV_PANELS` |
| Backdrop (the grey void and its pool of light) | `src/look.ts` -> `BACKDROP` |
| Glow strengths, flash, motion-blur samples | `src/look.ts` -> `MATERIAL_LOOK` |
| The scene itself | `src/scene/world.ts` |
| Render pipeline (shared engine) | `src/engine/` |

## How it renders (determinism)

- Every animated value is a pure function of `useCurrentFrame()`. There is no
  `Math.random()` (a seeded `mulberry32` stream builds the layout), no
  `requestAnimationFrame`, no `useFrame`, no clock, no temporal accumulation.
- `src/engine/Stage.tsx` sets the scene to the current frame and renders it
  synchronously in a layout effect: scene (MSAA, half-float HDR) -> depth of
  field -> bloom (pmndrs `postprocessing`) -> a final lens/film pass (ACES
  tone mapping, grade, hash-based grain, +-1/255 dither).
- The whip uses real motion blur: 6 sub-frame renders are averaged for the
  frames between 2.1 s and 3.55 s (`MATERIAL_LOOK.motionSamples`, `TIMING`).
- Bloom and depth of field work at a fixed internal size, so 1080p and 4K
  renders of a frame have the same glow and blur.
- `remotion.config.ts` sends PNG frames to the encoder and adds x264 settings
  (`aq-mode=3`, weaker deblocking) so that dark gradients keep their dither
  instead of banding. The render commands above need no extra flags.

## Render time

Measured on a 4-core machine with software WebGL (no GPU), default
concurrency:

| | per frame | whole film (301 frames) |
|---|---|---|
| 1080p (`--scale=0.5`), measured | about 3.8 s on average (1.6 s in the wide shot, about 4 s in the close-up, about 16 s inside the motion-blur window) | 18.9 min (V1), 19.3 min (V2) |
| 4K (`--scale=1`), estimated from measured 4K stills | about 10 s on average (4.6 s in the wide shot, 13 s in the close-up, 28 s inside the motion-blur window) | about 50 min per version |

Frames inside the motion-blur window cost about 6x a normal frame. A machine
with a GPU will be many times faster.

## Tools

- `scripts/measure-look.py` - measures exposure, colour, glow falloff, haze,
  grain, detail and vignette of a frame (numpy + Pillow).
- `scripts/compare.py` - builds a `reference | ours | difference` sheet.
