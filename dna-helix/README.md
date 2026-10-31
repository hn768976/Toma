# Composition 1 — DNA Helix Repair (4K, Remotion + Three.js)

A glossy ball-and-stick DNA double helix spins against a deep-blue lab backdrop.
A red (mutated) base pair scrolls into view, the helix stops, a healthy pair
slides in from the right and replaces it while the red pair is pushed out and
dissolves into sparkles. Then the helix starts spinning again.

| Composition ID        | Version | Description                                                                 |
| --------------------- | ------- | --------------------------------------------------------------------------- |
| `DnaHelix-V1-Match`   | V1      | Matches the reference: locked-off camera, helix at ~37 % width, slow dolly-out |
| `DnaHelix-V2-Orbit`   | V2      | Alternative **camera**: low-angle orbit around the helix, dutch-angle roll, push-in on the repair, then a pull-back |

* **Resolution:** 3840 × 2160 (4K UHD) master compositions
* **Frame rate:** 30 fps
* **Duration:** 520 frames = 17.333 s (identical to the reference clip)
* **Technology:** Three.js (WebGL 2): `MeshPhysicalMaterial` with clearcoat and a PMREM
  environment, instanced meshes, plus custom GLSL shaders for the procedural
  background (gradient, lens streaks, flares), the bokeh/dust point sprites and a tilt-shift
  depth-of-field pass. Post-processing uses `UnrealBloomPass` and `OutputPass` with ACES tone mapping.
* Every frame is a pure function of the frame number (`src/dna/timeline.ts`), so
  parallel/out-of-order rendering is deterministic.

## Commands

```bash
npm install                 # install dependencies (Node 20.19+/22.13+)
npm run dev                 # open Remotion Studio (both compositions under "DNA-Helix-4K")

# Deliverables: 4K composition supersampled to 1920×1080, H.264 MP4
npm run render:v1           # -> out/DNA_Helix_V1_Match_1080p.mp4
npm run render:v2           # -> out/DNA_Helix_V2_Orbit_1080p.mp4
npm run render:all

# Full 4K masters (3840×2160, H.264 MP4)
npm run render:v1:4k        # -> out/DNA_Helix_V1_Match_4K.mp4
npm run render:v2:4k        # -> out/DNA_Helix_V2_Orbit_4K.mp4

# Equivalent raw CLI
npx remotion render DnaHelix-V1-Match out/v1.mp4 --scale=0.5
npx remotion still  DnaHelix-V1-Match out/frame268.png --frame=268
```

Codec (H.264 High, yuv420p, CRF 16, BT.709 TV range), PNG frame capture and timeouts are set in
`remotion.config.ts`.

### Rendering notes

* `remotion.config.ts` selects `swangle` (SwiftShader) for WebGL, so the project renders
  on any machine, including servers without a GPU (about 2–3 s per 4K frame on 4 CPU cores).
  On a workstation with a GPU, add `--gl=angle` for a much faster render.
* If a Playwright headless-shell is present at `/opt/pw-browsers/...` it is used.
  Otherwise Remotion downloads its own Chrome Headless Shell on the first render.
* `--scale=0.5` renders the 4K canvas and downsamples it, so the 1080p files are 2×2 supersampled.
  MSAA is switched off automatically in that case and stays on for native 4K renders.

## Project structure

```
src/
  index.ts              registerRoot
  Root.tsx              the two 4K compositions
  dna/
    DnaHelix.tsx        Remotion component (canvas + delayRender, renders on every frame)
    DnaScene.ts         Three.js scene, materials, lights, particles, post-processing
    shaders.ts          GLSL: background, point sprites, tilt-shift blur
    timeline.ts         all timing / camera curves (V1 "match" and V2 "orbit")
remotion.config.ts      render settings (H.264, CRF, GL backend, browser)
```

## Timeline (frames @ 30 fps)

| Frames    | Action                                                                   |
| --------- | ------------------------------------------------------------------------ |
| 0 – 110   | helix spins and travels downward, camera close                           |
| ~65 – 185 | red base pair enters at the top and glides to the centre as the helix slows |
| 185 – 320 | helix holds; red pair glows                                               |
| 236 – 320 | healthy pair materialises on the right and docks; red pair is pushed left and dissolves |
| 320 – 520 | helix resumes a slower spin, camera keeps pulling back                    |
