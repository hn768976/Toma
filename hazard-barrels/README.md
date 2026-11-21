# hazard-barrels

Stacked hazard drums with a slow crane-up camera, built in Remotion with three.js
(`@remotion/three`, React Three Fiber's canvas, pmndrs `postprocessing`).

Two compositions, both 3840×2160, 30 fps, 250 frames (8.333 s):

| Composition | What it is |
|---|---|
| `V1-hazard-barrels` | Matches the reference: hazard-yellow drums under a teal sky. |
| `V2-hazard-barrels` | The same scene, camera, light and timing with **one change: the palette** (turquoise drums, cream markings, amber dusk sky). |
| `LookDev` | Three stills (frames 0, 1, 2 = video frames 0, 124, 249) used to match the look. |

**Why the palette for Version 2:** the shot is one simple move over a single-colour
subject, so the colour carries the mood. Swapping it changes the picture at a glance
while everything else (layout, light direction, gloss, depth of field, motion) stays
identical, which makes the two versions easy to compare and to intercut.

## Install

```bash
npm ci
```

## Render

4K masters (the compositions' native size):

```bash
npx remotion render V1-hazard-barrels out/V1-hazard-barrels-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-hazard-barrels out/V2-hazard-barrels-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
```

One 4K frame (quick check):

```bash
npx remotion still V1-hazard-barrels out/V1-frame-124-4k.png --frame=124 --scale=1 --gl=angle
npx remotion still V2-hazard-barrels out/V2-frame-124-4k.png --frame=124 --scale=1 --gl=angle
```

1080p (how the delivered MP4s were made):

```bash
npx remotion render V1-hazard-barrels out/01-V1-hazard-barrels.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-hazard-barrels out/02-V2-hazard-barrels.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
```

Preview: `npx remotion studio`.

Notes:

- `remotion.config.ts` sets PNG intermediate frames, the ANGLE GL backend, BT.709 colour
  (tagged in the stream) and a 10-minute per-frame timeout for slow machines. It also
  points Remotion at a pre-installed headless Chrome **only if** that file exists (a
  sandbox without download access); on a normal machine Remotion uses its own browser.
- Blur sizes are defined at 1080p and scale with the render size, so 4K and 1080p
  look the same.

## Where to change things

| What | File |
|---|---|
| Colours (both palettes), drum size, marking text and sizes, stack layout, camera path, duration | `src/config.ts` |
| Light, fill, gloss, haze, depth of field, motion blur, bloom, grade, grain, dither | `src/look.ts` |
| Drum geometry, layout, lights | `src/scene/barrelWorld.ts` |
| Paint, wear and marking textures | `src/scene/barrelTextures.ts` |
| Camera move | `src/scene/camera.ts` |
| Render pipeline (shared) | `src/three/Stage.tsx`, `GradeEffect.ts`, `MotionBlurEffect.ts` |

## How it stays deterministic

- Every frame is a pure function of `useCurrentFrame()`: the scene is static and only
  the camera depends on the frame number. No `useFrame`, `requestAnimationFrame`,
  clocks, `Math.random()` or temporal anti-aliasing.
- Random values come from `mulberry32` seeded in `src/config.ts`.
- The marking font loads behind `delayRender` (`AssetGate`), and each frame is held
  with `delayRender` until its WebGL render has been issued.
- Grain and dither are a hash of (pixel, frame). Motion blur is computed from the
  camera half a shutter before and after the frame.

## Scripts

- `scripts/measure-look.py` – measures tone, colour, glow falloff, haze, grain, detail and vignette of a frame.
- `scripts/compare-look.py` – compares two frames against the ±10% targets and writes a side-by-side image.
- `scripts/lookdev.sh` – renders the three `LookDev` stills and compares them with reference frames.
- `scripts/sample-grid.py` – prints mean colours on a coarse grid for a reference frame and an attempt.

## Render time

Measured on a 4-core machine with no GPU (software WebGL):

| Size | Per frame | Whole video (250 frames) |
|---|---|---|
| 1920×1080 (`--scale=0.5`) | about 7.5 s | 32–37 min (measured on three full renders) |
| 3840×2160 (`--scale=1`) | about 23.5 s (measured on consecutive frames) | about 1 h 40 min (estimate) |

The first frame of a render takes longer (bundling, texture generation, shader compilation):
about 20 s at 1080p and up to a minute at 4K. A machine with a GPU will be many times faster.

## Assets

- `public/fonts/Montserrat-ExtraBold.woff2` – SIL Open Font License (`public/fonts/Montserrat-OFL.txt`).
- Everything else (geometry, textures, sky) is generated in code. The trefoil is the
  standard public hazard symbol; no logos or brand names are used.
