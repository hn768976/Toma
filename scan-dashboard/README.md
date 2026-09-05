# Scanning Dashboard Plane

A violet/cyan data dashboard laid on a receding grid plane, with columns of
readouts down both sides and a wireframe sphere being scanned at the centre.
Built with [Remotion](https://remotion.dev).

Two versions, same composition, different palette:

| Composition id            | Look                     |
| ------------------------- | ------------------------ |
| `V1-ScanDashboardViolet`  | Violet/magenta           |
| `V2-ScanDashboardCyan`    | Cyan/blue                |

Both are **3840×2160, 30 fps, 480 frames (16 s)** and loop seamlessly — every
animated quantity is a pure function of the frame number that completes an
integer number of cycles across the 480, so frame 480 is identical to frame 0.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

```bash
npx remotion render V1-ScanDashboardViolet out/V1_ScanDashboardViolet.mp4 --scale=1 --crf=16
npx remotion render V2-ScanDashboardCyan   out/V2_ScanDashboardCyan.mp4   --scale=1 --crf=16
```

Stills:

```bash
npx remotion still V1-ScanDashboardViolet out/V1_ScanDashboardViolet.png --frame=96 --scale=1
npx remotion still V2-ScanDashboardCyan   out/V2_ScanDashboardCyan.png   --frame=96 --scale=1
```

`--scale=0.5` renders the same compositions at 1920×1080 for previews.
Codec, pixel format (`yuv420p`) and CRF defaults live in `remotion.config.ts`.

If Remotion cannot download its own Chrome Headless Shell (an offline or
egress-restricted machine), point it at a local Chromium:

```bash
npx remotion render V1-ScanDashboardViolet out/V1.mp4 --browser-executable=/path/to/chrome
```

## How it is built

- **The plane.** One SVG authored in its own 4900×3000 coordinate space, laid
  out under a CSS `perspective` container and raked ~18° around X. No 3D
  engine: hairlines and small numerals stay crisp, and the plane overfills the
  frame so modules crop at every edge.
- **The sphere.** Latitude and longitude curves sampled from the true
  parametric equations of a sphere seen from 20° above its equator
  (`src/sphere.ts`), split into near and far halves so the far side sits back.
  Sampling the real curves — rather than stacking ovals — is what makes each
  meridian narrow to a line as it turns edge-on.
- **Determinism.** Module placement, labels and per-readout seeds are drawn
  once at module scope from a fixed `mulberry32` PRNG (`src/layout.ts`). There
  is no `Math.random()` and no component state at render time.
- **Looping.** `src/motion.ts` exposes `loopSin` / `loopRamp`, both of which
  take an integer cycle count over the 480-frame duration.
- **Grade.** Screen-space depth of field (a sharp pass and a blurred pass with
  complementary masks), bloom from a bright-only pass of the sphere and
  accents, a vignette, and fine tiled grain at ~5% over `overlay`.

## Layout

```
src/
  constants.ts          frame size, plane size, sphere and loop constants
  motion.ts             loop-safe easing helpers
  rand.ts               mulberry32 + helpers
  layout.ts             seeded dashboard layout (modules, panels, decor, streaks)
  sphere.ts             sphere projection and near/far curve splitting
  theme.ts              the two palettes
  fonts.ts              bundled monospace face
  ScanDashboard.tsx     the composition: stage, DOF, bloom, vignette, grain
  Root.tsx              composition registration
  components/           grid, readouts, panels, decor, sphere, scan passes
public/fonts/           DejaVu Sans Mono, bundled so renders match anywhere
```

## Third-party

`public/fonts/DejaVuSansMono.ttf` — DejaVu Sans Mono, bundled so the numerals
render identically on any machine. Licence in `public/fonts/DejaVu-LICENSE.txt`.
