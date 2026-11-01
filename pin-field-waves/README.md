# Pin Field Waves (Remotion · Three.js)

A field of white spherical pins on a blue-grey plate. A travelling, domain-warped
wave raises and shrinks the pins, so raised "islands" of large heads drift across a
field of tiny needles. Rendered with **Three.js** (instanced meshes, soft shadow
map, ACES tone mapping) plus a custom **WebGL depth-of-field** post pass.

Everything is procedural: there are no external image/video/font assets.

## Compositions (all 3840×2160 4K UHD, 30 fps, 270 frames = 9.000 s)

| ID | Description |
|----|-------------|
| `PinField-V1-4K` | Version 1 – matches the reference: fixed, rolled long-lens camera, foreground defocus, 3 s seamless loop (×3). |
| `PinField-V2-4K` | Version 2 – same field/animation, but a continuous **orbit + crane-down camera move** that ends on a low grazing angle, revealing the pins' height in profile. |

The reference clip is 270 frames at 29.97 fps (9.009 s); at exactly 30 fps the same
270 frames last 9.000 s (the closest whole-frame duration, < 1 frame difference).

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- On first render Remotion downloads its Chrome Headless Shell automatically.
- WebGL is rendered through ANGLE + SwiftShader (`--gl=swangle`, set in
  `remotion.config.ts`), so no GPU is needed. On a machine with a GPU you can pass
  `--gl=angle` for much faster renders.

## Commands

```console
npm ci                 # install exact dependency versions from package-lock.json
npm run dev            # open Remotion Studio to preview the 4K compositions
npm run render:v1      # out/PinField-V1-1080p.mp4  (4K comp downsampled, --scale=0.5)
npm run render:v2      # out/PinField-V2-1080p.mp4
npm run render:v1:4k   # optional: full 4K master of Version 1
npm run render:v2:4k   # optional: full 4K master of Version 2
```

Output: H.264, yuv420p, CRF 16, MP4 (configured in `remotion.config.ts`).

## Layout

```
remotion.config.ts      codec / GL / browser configuration
src/index.ts            registerRoot
src/Root.tsx            the two 4K compositions
src/pins/PinField.tsx   Three.js scene, camera poses (V1 reference, V2 orbit-crane)
src/pins/field.ts       deterministic height field (travelling warped waves)
src/pins/dof.ts         depth-of-field post-process shader
```
