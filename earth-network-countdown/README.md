# Earth Network Countdown (Remotion, 4K)

A space shot of the Earth's horizon. A plexus data network is wrapped around
the planet, the sun rises behind the limb, and a broadcast-style countdown
(`00:00:20:00 → 00:00:00:00`) runs over it with digital glitch bursts. It is
recreated from the reference clip and offered in two versions.

| Composition ID | Version | Description |
| --- | --- | --- |
| `EarthCountdown-V1-Sunrise` | Version 1 | Matches the reference: a navy night side, a white-blue network and a golden sunrise with anamorphic streak. The countdown, sun path and glitch timing follow the reference. |
| `EarthCountdown-V2-AuroraPalette` | Version 2 | Alternative **colour palette** ("aurora dawn"): an emerald/teal atmosphere, network and HUD, and a magenta-violet sunrise. Camera, timing and animation are the same as V1. |

* Resolution: **3840 × 2160 (4K UHD)**, **30 fps**, **890 frames = 29.667 s**. This is the exact length of the reference.
* The countdown starts at `00:00:20:00` on frame 0, reaches `00:00:00:00` on frame 600 and holds there, as in the reference.
* Technology: **WebGL 2 + GLSL shaders** with a **Canvas 2D** HUD:
  * The procedural Earth map (continents, terrain, city lights) is baked once into a 4096×2048 mip-mapped texture.
  * The planet, atmosphere, terminator, city lights and sun flare come from a full-screen ray-cast shader writing into an HDR (RGBA16F) buffer.
  * The plexus network (~7,000 nodes) and stars are anti-aliased instanced capsules with planet occlusion.
  * A post pass applies tone mapping, RGB-split glitch bands, HUD compositing, vignette and dithering.
* The HUD font is Exo 2 (SIL Open Font License), bundled in `public/fonts/` with no network access needed.
* All randomness is seeded, so renders are deterministic. There is no audio, matching the reference.

## Requirements

* Node.js 20.19+ / 22.13+ / 24+
* Chrome Headless Shell. Remotion downloads it automatically on first render.
  On machines that cannot download it, set `REMOTION_BROWSER=/path/to/chrome-headless-shell`.

## Commands

```bash
npm ci                 # install the exact dependency versions (package-lock.json)
npm run dev            # open Remotion Studio to preview both compositions

npm run render:v1      # 4K master -> out/4k/…V1…_4K.mp4, then 1080p delivery -> out/1080p/
npm run render:v2      # same for Version 2
npm run render:all     # both versions

# Individual steps
npm run render:v1:4k   # remotion render EarthCountdown-V1-Sunrise (H.264, CRF 12, 4K)
npm run downscale:v1   # Lanczos 4K -> 1920x1080, H.264 High, CRF 16, yuv420p, BT.709
npx remotion render EarthCountdown-V1-Sunrise out/test.mp4 --frames=0-29   # quick partial render
npm run lint           # eslint + TypeScript check
```

Render settings live in `remotion.config.ts`: H.264, yuv420p, BT.709, JPEG
quality 95 and concurrency 2. The OpenGL backend is `swangle` (ANGLE on SwiftShader),
which works on any machine including GPU-less servers. With a GPU you can add
`--gl=angle` for faster renders.

## Project layout

```
src/index.ts                  registerRoot
src/Root.tsx                  the two 4K compositions
src/earth/EarthCountdown.tsx  component, camera rig, font loading
src/earth/timeline.ts         countdown, sun path / intensity keys, glitch bursts
src/earth/palette.ts          V1 sunrise and V2 aurora palettes
src/earth/network.ts          plexus nodes/edges + star field
src/earth/hud.ts              Canvas 2D countdown HUD
src/earth/shaders.ts          GLSL: Earth bake, scene, capsules, post
src/earth/renderer.ts         WebGL 2 renderer
public/fonts/                 Exo 2 (OFL) font files + licence
remotion.config.ts            render configuration
```
