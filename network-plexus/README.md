# Composition 1 — Network Plexus (Remotion + Three.js)

A dark-navy data network that the camera flies through. Hub nodes have a
white-hot core, an orange target ring, glittering particles, cyan/orange
satellite nodes and small HUD widgets. Long ice-blue lines connect the
hubs, data pulses travel along them, and blue HUD panels float through the
space. Everything has camera-style depth of field.

| Composition ID | Version | Camera |
| --- | --- | --- |
| `NetworkPlexus-V1-Reference` | V1, matches the reference | Forward fly-through from hub to hub, passing each hub off-centre, with gentle banking. |
| `NetworkPlexus-V2-CraneOrbit` | V2, alternative **camera movement** | Wide, high crane that orbits and descends around the whole network, zooming from 60° to 40° FOV and dollying in, with rack focus. Hubs switch on one by one. |

* Resolution: **3840 × 2160 (4K UHD)** compositions
* Frame rate: **30 fps**
* Duration: **650 frames = 21.667 s**, the same as the reference clip
* No audio

## Tech

* Remotion 4 (project created with `npx create-video --blank`)
* Three.js with custom WebGL2 shaders (`src/engine/batches.ts`):
  * instanced sprites, screen-space line ribbons and procedural SDF
    billboards (rings, panels, widgets)
  * a per-primitive circle of confusion that drives the depth of field
  * premultiplied additive blending, so draw order doesn't matter
* Everything is a pure function of the frame number and uses seeded random
  numbers, so renders are deterministic across workers.
* Pixel sizes are defined against a 1080-line frame and scaled by the
  drawing-buffer height. The 4K composition therefore looks the same
  rendered natively at 4K or at 1080p with `--scale=0.5`.

## Commands

```bash
npm ci                 # install exact dependency versions
npm run dev            # Remotion Studio preview
npm run typecheck      # TypeScript check

# 1080p deliverables (4K composition rendered with --scale=0.5)
npm run render:v1      # -> out/Composition1_V1_Reference_1080p.mp4
npm run render:v2      # -> out/Composition1_V2_CraneOrbit_1080p.mp4

# Native 4K masters
npm run render:v1:4k   # -> out/Composition1_V1_Reference_4K.mp4
npm run render:v2:4k   # -> out/Composition1_V2_CraneOrbit_4K.mp4
```

Output is H.264 MP4 (yuv420p, CRF 16), set in `remotion.config.ts`.

### Rendering notes

* Node 20.19+ or 22.13+ is required (see `engines` in `package.json`).
* WebGL uses `swangle` (ANGLE on SwiftShader), so it renders on any machine,
  including headless servers without a GPU. On a workstation with a GPU you
  can add `--gl=angle` to a render command to speed it up.
* Remotion downloads its own Chrome Headless Shell the first time it runs.
  If your environment cannot download it, set
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.
* For reference, one 1080p version took about 4.5 minutes on 4 CPU cores
  without a GPU.

## Layout

```
src/
  index.ts / Root.tsx         composition registration (4K, 30 fps, 650 frames)
  engine/batches.ts           instanced sprites / lines / SDF billboards + DOF shaders
  engine/spline.ts            time-keyed Hermite spline
  engine/random.ts            seeded PRNG
  plexus/network.ts           procedural network layout and scene content
  plexus/camera.ts            V1 fly-through rig, V2 crane-orbit rig, auto focus puller
  plexus/palette.ts           colours sampled from the reference
  plexus/NetworkPlexus.tsx    Remotion component (WebGL renderer, vignette, fade)
```
