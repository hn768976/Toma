# Spiral Ribbon Vortex — Remotion project (4K)

Layered, pleated ribbons winding into soft violet vortices with peach/orange
tails, recreated from the reference clip as real **3D geometry in Three.js**
(React Three Fiber via `@remotion/three`).

| Composition ID                       | Version | Description |
| ------------------------------------ | ------- | ----------- |
| `SpiralRibbonVortex-V1-Reference`    | V1      | Matches the reference: gentle sideways drift towards the hero vortex and back — a seamless loop (last frame flows into the first) |
| `SpiralRibbonVortex-V2-OrbitPlunge`  | V2      | Alternative **camera angle & movement**: starts low and wide, orbits around the hero vortex and plunges down its throat with a slow barrel roll (same palette & ribbons) |

* Resolution: **3840 × 2160 (4K UHD)** compositions
* Frame rate: **30 fps**, 270 frames = **9.000 s** (reference: 270 frames @ 29.97 fps)
* Codec: H.264 (yuv420p, CRF 18, BT.709) — set in `remotion.config.ts`

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* Internet access on first render (Remotion downloads Chrome Headless Shell),
  **or** an existing Chrome / Chrome Headless Shell (see below).

## Commands

```bash
npm install                 # install dependencies (uses package-lock.json)
npm run dev                 # open Remotion Studio preview

npm run render:v1           # V1 -> out/SpiralRibbonVortex-V1-Reference-1080p.mp4 (4K comp rendered at 1080p)
npm run render:v2           # V2 -> out/SpiralRibbonVortex-V2-OrbitPlunge-1080p.mp4
npm run render:v1:4k        # V1 at full 3840x2160
npm run render:v2:4k        # V2 at full 3840x2160
npm run still:v1            # single 4K PNG of frame 60
```

The canvases follow Remotion's `--scale` (device-pixel-ratio), so `--scale=0.5`
draws the 4K composition natively at 1920×1080.

### GPU / browser notes

* `remotion.config.ts` uses the `swangle` GL backend (ANGLE on SwiftShader), which
  works on any machine, including servers without a GPU (≈4 s/frame at 1080p on
  4 CPU cores). On a machine with a GPU add `--gl=angle` for a large speed-up.
* To use a pre-installed Chrome instead of letting Remotion download one:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render:v1`

## Source layout

```
src/
  index.ts                         registerRoot
  Root.tsx                         the two 4K compositions (V1 / V2)
  vortex/SpiralRibbonVortex.tsx    scene: vortex layout, lights, fog, two stacked
                                   canvases (blurred far layer = depth of field)
  vortex/geometry.ts               layered conical log-spiral ribbon builder +
                                   procedural pleat/groove texture
  vortex/camera.ts                 camera moves: V1 looping drift, V2 orbit-plunge
```

`previews/` holds native 3840×2160 stills of each composition (rendered with
`npm run still:v1` style commands) as proof of the 4K output.

No external image/video/audio assets are needed — everything is procedural.
The videos are silent (the reference has no audio track).
