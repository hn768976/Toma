# Downtrend Charts — Remotion + Three.js

Two 3D "market downtrend" bar-chart animations, each in two versions. All
compositions are authored at **3840 × 2160 (4K UHD), 30 fps**; the delivery
renders are 1920 × 1080 H.264 MP4s produced from these 4K compositions with
`--scale=0.5`.

| Composition ID     | Concept | Version | Frames | Duration |
| ------------------ | ------- | ------- | ------ | -------- |
| `Comp1-V1-Ember`   | Glowing neon bars on a dark reflective stage, a red arrow tracking the decline, slow drifting camera | V1: matches the reference (red→orange bars, dark red arrow) | 450 | 15.000 s |
| `Comp1-V2-Glacier` | same | V2: **alternative colour palette** (electric blue→cyan bars, violet arrow, blue floor glow); same motion | 450 | 15.000 s |
| `Comp2-V1-Static`  | White bars on a grey studio cyclorama, a glossy red ribbon arrow snaking over the bar tops | V1: matches the reference (locked-off camera) | 210 | 7.000 s |
| `Comp2-V2-Orbit`   | same | V2: **alternative camera move** (low front-left → high front-right crane/arc that follows the arrow head) | 210 | 7.000 s |

## Technology

- **Remotion 4** (scaffolded with `npx create-video --three`), React 19
- **Three.js** via `@remotion/three` / React Three Fiber (WebGL 2)
- Post-processing: Three.js `EffectComposer` (4× MSAA, HDR half-float target),
  `UnrealBloomPass` (composition 1) and `OutputPass` (ACES tone mapping, sRGB)
- Everything is procedural: geometry, the ribbon sweep, glow textures (canvas),
  floor shader (GLSL) and studio reflections (`RoomEnvironment`). There are no
  external assets to download.

Every animation value is a pure function of the current frame, so renders are
deterministic and can be split across any number of render workers.

## Project layout

```
src/
  Root.tsx                   – registers the 4 compositions (4K, 30 fps)
  common/
    PostFX.tsx               – MSAA + bloom + tone-mapping chain (drives rendering)
    Environment.tsx          – procedural studio environment map
    math.ts, textures.ts     – easing/keyframe helpers, radial glow texture
  glow/                      – Composition 1
    GlowingDecline.tsx       – scene, camera rig, floor shader, bars, arrow, glows
    palettes.ts              – EMBER (V1) and GLACIER (V2) palettes
    timeline.ts              – bar heights, timing (measured from the reference)
  ribbon/                    – Composition 2
    RibbonDecline.tsx        – scene, cyclorama, bars, ribbon sweep, static/orbit cameras
remotion.config.ts           – H.264, CRF 16, yuv420p, PNG intermediates, ANGLE GL
```

## Setup

Requires Node.js 20.19+ / 22.13+ / 24+.

```bash
npm ci            # or: npm install
npm run dev       # Remotion Studio preview
npm run lint      # eslint + tsc type check
```

## Rendering

```bash
# 1080p delivery files (rendered from the 4K compositions at scale 0.5)
npm run render:all            # or render:comp1-v1 / render:comp1-v2 / render:comp2-v1 / render:comp2-v2

# Full 4K UHD masters
npm run render:4k:comp1-v1    # etc. (render:4k:comp1-v2, render:4k:comp2-v1, render:4k:comp2-v2)

# 4K stills of the final frame of every composition (quick sanity check)
npm run still:4k
```

Output goes to `out/`. Codec, CRF and pixel format come from
`remotion.config.ts` (H.264, CRF 16, yuv420p).

### GPU / headless notes

- By default `remotion.config.ts` selects the `angle` OpenGL backend, which uses
  the GPU when one is available.
- On a machine **without a GPU** (CI, containers), set `REMOTION_GL=swangle`
  for SwiftShader software WebGL, e.g. `REMOTION_GL=swangle npm run render:all`.
  Software rendering is slower: roughly 1.5–2 s per 1080p frame on 4 CPU cores.
- Remotion downloads its own Chrome Headless Shell on first render. On machines
  without internet access, point it at a local one with
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.

## Timing notes

- Composition 2's reference is 7.000 s at 30 fps, and it is matched exactly
  (210 frames).
- Composition 1's reference is 450 frames at 29.97 fps (15.015 s). At the
  required 30 fps, a whole number of frames can't land on 15.015 s exactly.
  450 frames (15.000 s) is the nearest possible value (15 ms off, under half a
  frame) and keeps the reference's frame count and frame-for-frame timing.
