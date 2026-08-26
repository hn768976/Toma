# ContourCrowd

A 4K "contour landscape with user pins" animation: a topographic wireframe
plane receding to a horizon, glowing avatar pins rising from it, shot with a
low real 3D perspective camera (Remotion + @remotion/three).

| | |
|---|---|
| Composition id | `ContourCrowd` |
| Resolution | 3840 × 2160 (4K) |
| Duration | 480 frames @ 30 fps = 16.0 s |
| Props | `variant: "violet"` (palette lives in `src/theme.ts` → `THEMES`) |

## Setup

```
npm install
```

Dependencies beyond a stock Remotion project:

```
@remotion/three  three  @react-three/fiber
@react-three/postprocessing  postprocessing
simplex-noise
```

## Commands

```
npx remotion studio

# 1080p preview from the 4K composition
npx remotion render ContourCrowd out/contour-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

# full-quality 4K render
npx remotion render ContourCrowd out/contour-crowd.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

If `--concurrency=8` exceeds your machine's core count, lower it — Remotion
refuses values above the available cores.

## Where things live

- `src/theme.ts` — every colour in the piece (`THEMES`); a v2 palette is a
  new entry + the `variant` prop.
- `src/config.ts` — camera path, pin field, contour spacing, noise scale,
  DOF and bloom settings.
- `src/cameraPath.ts` — the camera move as pure math over `t = frame/480`.
- `src/terrain.ts` — seeded simplex height field + marching-squares
  iso-line extraction.
- `src/Contours.tsx` / `src/Pins.tsx` / `src/Scene.tsx` — the 3D scene.
- `CAMERA-NOTES.md` — camera/DOF/material reference for future 3D builds.

No lights, no photos of real people, no audio. Everything animated derives
from `useCurrentFrame()`; all randomness is seeded — renders are
deterministic across machines and workers.
