# DNA Helix HUD — Remotion project (4K)

A silver DNA double helix floating over layered holographic HUD "data floors",
with a cinematic camera, shallow depth of field, bloom and film grain.
Built with **Remotion 4 + Three.js (WebGL 2) + custom GLSL post-processing**.

| Composition ID | Resolution | FPS | Frames | Duration | Description |
| --- | --- | --- | --- | --- | --- |
| `DnaHelixHUD-V1-Reference` | 3840 × 2160 | 30 | 600 | 20.000 s | Matches the reference: low fly-over of the HUD floor, tilt-up reveal of the helix at ~3 s, slow pull-back, drift to a ¾ view with the helix receding right. |
| `DnaHelixHUD-V2-OrbitCamera` | 3840 × 2160 | 30 | 600 | 20.000 s | Alternative **camera movement**: overhead crane shot that descends and orbits ~120° around the helix, ending on a low-angle hero view with the helix spiralling into depth. Same look and palette. |

## Quick start

```bash
npm install            # Node 20.19+ / 22.13+ / 24+
npm run dev            # Remotion Studio preview

# Deliverables (1080p, H.264, rendered from the 4K compositions at --scale=0.5)
npm run render:v1      # -> out/DNA-Helix-HUD_Version-1_Reference-Match_1080p.mp4
npm run render:v2      # -> out/DNA-Helix-HUD_Version-2_Orbit-Camera_1080p.mp4

# Full 4K masters
npm run render:v1:4k
npm run render:v2:4k

# Single frame check
npx remotion still DnaHelixHUD-V1-Reference out/frame.png --frame=180
```

Codec settings (H.264, yuv420p, CRF 20) live in `remotion.config.ts`.

### GPU / no-GPU machines

`remotion.config.ts` uses the `angle` OpenGL backend (GPU). On machines without
a GPU (CI, containers), add `--gl=swangle` (SwiftShader). It is slower
(≈2 s/frame at 1080p on 4 CPU cores) but produces identical frames.
If Remotion cannot download its Chrome Headless Shell, point it at any local
Chromium with `--browser-executable=/path/to/chrome`.

## How it works

```
src/
  Root.tsx                 two 4K compositions (V1 / V2), 30 fps, 600 frames
  DnaHelixHud.tsx          React wrapper: owns the <canvas>, renders one frame per Remotion frame
  lib/fonts.ts             loads the bundled fonts (public/fonts) before rendering
  lib/random.ts            stateless deterministic hashing (no Math.random → frame-exact renders)
  scene/engine.ts          Three.js scene: instanced helix (beads + base-pair rungs), HUD layers,
                           light streaks with travelling pulses, warm bokeh particles, lights
  scene/hudTexture.ts      procedural Canvas 2D HUD textures (data blocks, labels, rings, ticks)
  scene/cameraPaths.ts     camera keyframes for V1 and V2 (Catmull-Rom + Hermite timing)
  scene/post.ts            custom WebGL 2 post chain:
                           depth pre-pass → HDR MSAA colour → CoC prefilter (½ res)
                           → golden-angle bokeh gather DOF (½ res) → DOF composite
                           → 2-level bloom → ACES tonemap, split-tone grade, vignette,
                           chromatic aberration, film grain
public/fonts/              Rajdhani + Share Tech Mono (SIL OFL 1.1, licences included)
```

* Every frame is a pure function of the frame number, so renders are
  deterministic and can run in parallel.
* The WebGL buffer is sized `composition size × devicePixelRatio`, so the 4K
  composition renders natively at 3840 × 2160, and `--scale=0.5` renders a true
  1920 × 1080 frame (all blur radii are resolution-independent).
