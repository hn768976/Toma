# memory-chips

A memory module and loose chips on a studio table, with a slow camera glide along the
board. Built in Remotion with three.js (`@remotion/three`, React Three Fiber's canvas,
pmndrs `postprocessing`).

Two compositions, both 3840×2160, 30 fps, 450 frames (15.000 s):

| Composition | What it is |
|---|---|
| `V1-memory-chips` | Matches the reference: a three-quarter view gliding along the module, tilting down a little over the first half. |
| `V2-memory-chips` | The same scene, light, look, travel and timing with **one change: the camera angle** (a plan view from almost straight above, module square to the frame). |
| `LookDev` | Three stills (frames 0, 1, 2 = video frames 0, 224, 449) used to match the look. |

**Why the camera angle for Version 2:** the subject is a flat layout of parts, so the
viewing angle changes the picture more than anything else. From above it reads as a
clean graphic plan of the same board; the palette, light and motion stay identical,
so the two versions cut together.

## Install

```bash
npm ci
```

## Render

4K masters (the compositions' native size):

```bash
npx remotion render V1-memory-chips out/V1-memory-chips-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-memory-chips out/V2-memory-chips-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
```

One 4K frame (quick check):

```bash
npx remotion still V1-memory-chips out/V1-frame-224-4k.png --frame=224 --scale=1 --gl=angle
npx remotion still V2-memory-chips out/V2-frame-224-4k.png --frame=224 --scale=1 --gl=angle
```

1080p (how the delivered MP4s were made):

```bash
npx remotion render V1-memory-chips out/03-V1-memory-chips.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-memory-chips out/04-V2-memory-chips.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
```

Preview: `npx remotion studio`.

Notes:

- `remotion.config.ts` sets PNG intermediate frames and the ANGLE GL backend. It also
  points Remotion at a pre-installed headless Chrome **only if** that file exists (a
  sandbox without download access); on a normal machine Remotion uses its own browser.
- Blur sizes are defined at 1080p and scale with the render size, so 4K and 1080p
  look the same.

## Where to change things

| What | File |
|---|---|
| Colours, module and chip sizes and counts, the loose components (type, position, rotation, size), both camera rigs, duration | `src/config.ts` |
| Key light, environment, surface gloss, depth of field, motion blur, bloom, grade, grain, dither | `src/look.ts` |
| Geometry (board, chips, pins, fingers, packages), lights | `src/scene/chipsWorld.ts` |
| Board and chip-top textures (invented trace layout and made-up glyphs) | `src/scene/pcbTexture.ts` |
| Camera move | `src/scene/camera.ts` |
| Render pipeline (shared) | `src/three/Stage.tsx`, `GradeEffect.ts`, `MotionBlurEffect.ts` |

Lengths are millimetres. X runs across the module, Y along it (0 at the near end).

## How it stays deterministic

- Every frame is a pure function of `useCurrentFrame()`: the scene is static and only
  the camera depends on the frame number. No `useFrame`, `requestAnimationFrame`,
  clocks, `Math.random()` or temporal anti-aliasing.
- Random values come from `mulberry32` seeded in `src/config.ts`.
- All textures are generated synchronously in code; there are no external assets to
  load. Each frame is held with `delayRender` until its WebGL render has been issued.
- Grain and dither are a hash of (pixel, frame). Motion blur is computed from the
  camera half a shutter before and after the frame.

## Scripts

- `scripts/measure-look.py` – measures tone, colour, glow falloff, haze, grain, detail and vignette of a frame.
- `scripts/compare-look.py` – compares two frames against the ±10% targets and writes a side-by-side image.
- `scripts/lookdev.sh` – renders the three `LookDev` stills and compares them with reference frames.

## Render time

Measured on a 4-core machine with no GPU (software WebGL):

| Size | Per frame | Whole video (450 frames) |
|---|---|---|
| 1920×1080 (`--scale=0.5`) | RENDER_1080_PER_FRAME | RENDER_1080_TOTAL |
| 3840×2160 (`--scale=1`) | RENDER_4K_PER_FRAME (measured on single frames) | RENDER_4K_TOTAL (estimate) |

A machine with a GPU will be many times faster.

## Assets

None. Geometry, textures and the studio environment are generated in code. No logos,
brand names or real product markings are used.
