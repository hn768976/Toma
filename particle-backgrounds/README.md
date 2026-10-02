# Particle Backgrounds — Remotion project

Five looks, **8 compositions**, all **20 s seamless loops** at **30 fps** (600 frames),
defined at **3840×2160**.

| Composition id | Look | 2D / 3D | Output name |
|---|---|---|---|
| `PulseRings-White` | Pulse Rings | 2D (SVG) | `PulseRings_White.mp4` |
| `CyberNetwork-Blue` | Cyber Network Flythrough | 3D (WebGL2) | `CyberNetwork_Blue.mp4` |
| `ParticleSphere-Blue` | Particle Sphere | 3D | `ParticleSphere_Blue.mp4` |
| `ParticleSphere-Gold` | Particle Sphere | 3D | `ParticleSphere_Gold.mp4` |
| `ParticleWaves-Blue` | Particle Waves | 3D | `ParticleWaves_Blue.mp4` |
| `ParticleWaves-VioletPink` | Particle Waves | 3D | `ParticleWaves_VioletPink.mp4` |
| `DataCity-TealOrange` | Data City | 3D | `DataCity_TealOrange.mp4` |
| `DataCity-GoldViolet` | Data City | 3D | `DataCity_GoldViolet.mp4` |

Everything is built in code: no MCP servers, no icon libraries, no logos. The only
asset is the font **JetBrains Mono** (SIL OFL 1.1, `public/fonts/JetBrainsMono-OFL.txt`),
loaded with `delayRender` / `continueRender`. The padlock icon is a self-drawn SVG
(`src/looks/cyberBadges.ts`).

> **Pulse Rings** is a white-on-pure-black overlay (`#000000`, no grain). It is meant
> for **Screen / Add** blending in the edit; tint it to any colour with a fill/tint effect.

---

## Setup

```bash
npm install          # Node 18+ (tested with Node 22)
npx remotion studio  # live preview (the Studio caps the WebGL resolution so it stays interactive)
```

All versions are pinned in `package.json` (Remotion 4.0.515, @remotion/three, three 0.180,
@react-three/fiber 9.3, React 19.2).

### Chromium GL flag

Looks 2–5 are **WebGL2** (not WebGPU). Headless Chromium needs ANGLE:

```
--gl=angle
```

`remotion.config.ts` sets this (`Config.setChromiumOpenGlRenderer("angle")`), so the
commands below already use it. Add `--gl=angle` yourself if you call the Node render APIs.
On a machine with a GPU, ANGLE uses it; without one Chromium falls back to SwiftShader
(software), which is what the timings below were measured on.

---

## 4K render commands

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, PNG frames, muted (no audio
stream) and `--gl=angle`. Explicit flags are repeated here so the commands stand alone.

```bash
npx remotion render PulseRings-White         out/PulseRings_White.mp4         --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render CyberNetwork-Blue        out/CyberNetwork_Blue.mp4        --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render ParticleSphere-Blue      out/ParticleSphere_Blue.mp4      --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render ParticleSphere-Gold      out/ParticleSphere_Gold.mp4      --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render ParticleWaves-Blue       out/ParticleWaves_Blue.mp4       --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render ParticleWaves-VioletPink out/ParticleWaves_VioletPink.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render DataCity-TealOrange      out/DataCity_TealOrange.mp4      --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
npx remotion render DataCity-GoldViolet      out/DataCity_GoldViolet.mp4      --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle
```


720p preview (what was rendered here): add `--scale=0.3333333333333333` → exactly 1280×720.

## Still command

6000×3375 PNG (= 3840×2160 × 1.5625):

```bash
npx remotion still ParticleSphere-Blue out/ParticleSphere_Blue_f120.png --frame=120 --scale=1.5625 --image-format=png --gl=angle
```

`scripts/stills-6k.sh` renders 2 stills per composition (frames 120 and 420).

---

## How it's built

```
src/
  Root.tsx              one <Composition> per data row (3840x2160, 30 fps, 600 frames)
  versions.ts           THE colour table: one row per version
  lib/random.ts         mulberry32 (module-level seeds), stateless hash
  lib/timing.ts         loopPhase(frame) = (frame % 600) / 600
  lib/font.ts           JetBrains Mono via FontFace + delayRender/continueRender
  gl/Stage.tsx          <ThreeCanvas> wrapper; renders once per frame from useCurrentFrame()
  gl/Composer.ts        bloom (13-tap down / tent up mip chain), background, soft clip, grain, dither
  gl/glsl.ts            shared depth-of-field sprite model (circle of confusion per particle)
  looks/PulseRings.tsx  Look 1 (SVG radial gradients)
  looks/cyberNetwork.ts + cyberBadges.ts   Look 2
  looks/particleSphere.ts                  Look 3
  looks/particleWaves.ts                   Look 4
  looks/dataCity.ts                        Look 5
scripts/                render + verification helpers (bash / python)
```

* **2D (Look 1):** plain SVG; every radius/opacity is a function of `useCurrentFrame()`.
  No CSS `@keyframes`, no transitions.
* **3D (Looks 2–5):** `@remotion/three` `<ThreeCanvas>` with WebGL2. Particles are
  `THREE.Points` / instanced quads with custom GLSL. **Every particle position is a closed-form
  function of its seed and the frame** (evaluated in the vertex shader); nothing is
  simulated or stepped. The r3f clock is never read: the frame number is the only input.
* **Depth of field:** per-sprite circle of confusion `CoC = A·|1 − focus/depth|`; sprites
  grow to `sqrt(size² + CoC²)` and their alpha falls as `1/size²` (energy conserving), so
  near items become large soft bokeh. Links (Look 2) widen the same way; badges are blurred
  with a 24-tap disc whose radius is the same CoC.
* **Resolution independence:** sizes are authored in 4K pixels and scaled by
  `drawingBufferHeight / 2160`; the drawing buffer is exactly the output size
  (`dpr = devicePixelRatio`, which Remotion sets from `--scale`). 720p and 4K frame identically.

### Loops

| Look | What closes the loop |
|---|---|
| Pulse Rings | 75-frame pulse, 8 pulses per 600 frames; state depends only on `frame % 75` |
| Cyber Network | nodes/links/badges in a repeating block of depth L = 64; camera moves exactly 1·L; sway on a closed path; badge numbers change every 6 frames (100 states), bars every 15 (40 states) |
| Particle Sphere | exactly one full turn per loop; breathing 2 cycles, shimmer 3, twinkle 4; dust on closed orbits (1 cycle) |
| Particle Waves | height field = sum of waves that are periodic along travel (period L = 36, integer cycles) **and** in time (integer cycles per loop — noise on a circle in time); camera glides exactly 1·L; sway on a closed path |
| Data City | each stream's dash pattern repeats every R = len/q (q = 2, 3, 4) and flows exactly one repeat R per loop; tower flicker = 30 states (every 20 frames); camera sway closed |

### Determinism

* No `Math.random()` at render time — `mulberry32` seeded at module level.
* No simulation stepped frame by frame; no `useFrame` clock, `Date.now()`, `useState` driving
  visuals, or values carried between frames; no TAA / temporal effects; no CSS animation.
* Grain/dither are a PCG hash of `(pixel x, pixel y, frame % 600)`.

### Banding

* Scene, bloom chain: half-float render targets.
* Final pass: **±1/255 dither after bloom** + **~2 % monochrome grain** (triangular
  distribution) from a fixed formula of pixel position and `frame % 600` (Looks 2–5).
* Look 1 has no grain and no dither: the background is exactly `0,0,0`.

---

## Add a colourway (one data row)

Add a row to `VERSIONS` in `src/versions.ts`, e.g.

```ts
{ id: "ParticleSphere-Emerald", look: "particleSphere",
  colors: { particles: "#A8FFD8", glow: "#18C27A", background: "#02100A" } },
```

That's all — the composition appears in the Studio and can be rendered by its `id`.
The `look` field picks the renderer; `colors` must have the keys that look's type lists.
(For the verification scripts, also add `<id> <OutputName>` to `scripts/compositions.sh`.)

---

## Verification scripts

* `scripts/verify-one.sh <id> <Name> <outDir>` – 720p mp4 preview, ffprobe, full
  PNG-sequence render (concurrency 4) vs cold-start still of frame 300 (byte compare),
  601-frame loop check (frame 0 vs frame 600, byte compare), 720p still.
* `scripts/verify-all.sh` – the above for all 8.
* `scripts/analyze.py <outDir>` – checks on the **encoded mp4**: ffprobe spec, black check
  (Look 1), banding profiles (Looks 2–5), 5 evenly spaced frames + motion per composition.

The loop check uses the `loopCheck` input prop, which makes a composition 601 frames long:

```bash
npx remotion still ParticleWaves-Blue a.png --frame=0   --props='{"loopCheck":true}' --scale=0.3333333333333333
npx remotion still ParticleWaves-Blue b.png --frame=600 --props='{"loopCheck":true}' --scale=0.3333333333333333
cmp a.png b.png
```

<!-- RESULTS -->
