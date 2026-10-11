# Android Trader HUD · Growth Chart HUD · Server Rack Close-ups

One Remotion project, three looks, six compositions. Everything is built in
code with three.js on WebGL2 (through `@remotion/three`). There are no
external models, no MCP servers and no downloaded assets except the two OFL
fonts.

| Composition | Look | Length | Output name |
|---|---|---|---|
| `AndroidTraderHUD-Left` | 1A, android in the left third (as ref) | 600 f / 20 s loop | `AndroidTraderHUD_Left.mp4` |
| `AndroidTraderHUD-Right` | 1B, re-laid out: android right, HUD left | 600 f / 20 s loop | `AndroidTraderHUD_Right.mp4` |
| `GrowthChartHUD-Story` | 2, chart draws on then holds | 450 f / 15 s story | `GrowthChartHUD_Story.mp4` |
| `ServerRack-FrontScroll` | 3A, square-on, straight down by H | 600 f / 20 s loop | `ServerRack_FrontScroll.mp4` |
| `ServerRack-DiagonalGlide` | 3B, 35° oblique, glides by (W, H) | 600 f / 20 s loop | `ServerRack_DiagonalGlide.mp4` |
| `ServerRack-LowAngle` | 3C, low, looking up the face, rises by H | 600 f / 20 s loop | `ServerRack_LowAngle.mp4` |

All compositions are defined at 3840×2160, 30 fps. `HeadCheck` is the bare
head on grey used for the model check (not a deliverable).

## Setup

```bash
npm install
npx remotion studio
```

Node 18+ (tested with Node 22). Versions are pinned in `package.json`.

### Chromium GL flag

WebGL2 runs through ANGLE: `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the CLI flag
`--gl=angle`. On a machine without a GPU, ANGLE falls back to SwiftShader
(slow but deterministic); on a GPU machine it uses the GPU. Add `--gl=angle`
explicitly if you render through the Node API.

## 4K render commands

```bash
npx remotion render AndroidTraderHUD-Left    out/AndroidTraderHUD_Left.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render AndroidTraderHUD-Right   out/AndroidTraderHUD_Right.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render GrowthChartHUD-Story     out/GrowthChartHUD_Story.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render ServerRack-FrontScroll   out/ServerRack_FrontScroll.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render ServerRack-DiagonalGlide out/ServerRack_DiagonalGlide.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render ServerRack-LowAngle      out/ServerRack_LowAngle.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

Add `--concurrency=N` to taste. On a GPU machine 2–4 tabs is a good start.
On SwiftShader each tab already uses all cores, so keep it at 1–2.

### 720p previews

```bash
scripts/render-previews.sh out            # all six
scripts/render-previews.sh out GrowthChartHUD-Story
```

The script renders at `--scale=0.3333333333333333` (1280×720 exactly) as a
PNG sequence and encodes it with ffmpeg: H.264, yuv420p, 30 fps, CRF 16.

### Stills (6K)

```bash
npx remotion still AndroidTraderHUD-Left out/AndroidTraderHUD_Left_6K.png --frame=150 --scale=1.5625 --gl=angle
```

`--scale=1.5625` turns 3840×2160 into 6000×3375. Use any composition id and
frame (for the chart story, take the hold, e.g. `--frame=420`).

## Rebuilding the android head

```bash
node scripts/build-android.mjs            # 320^3, about 7 s
node scripts/build-android.mjs --res=160  # quick preview
```

This writes `public/models/android/head.bin`. The head is a signed distance
field (smooth unions and subtractions of ellipsoids, rounded boxes, cones and
a ring-grooved neck, plus 0.004-deep panel seams). It is meshed with
marching cubes (the tables come from three.js' `MarchingCubes.js`), welded
per grid edge, then given 2 Taubin passes weighted down near the seams.
Normals come from the SDF gradient. The face wireframe (140 points
triangulated in face UV space, edges resampled on the surface) is generated
by the same script and stored in the file's JSON header.

## How it is built

- `src/lib/GLStage.tsx` loads assets behind `delayRender`, then mounts a
  `ThreeCanvas`. The canvas follows the render scale (`dpr` =
  `devicePixelRatio`), so a 720p preview renders a 1280×720 buffer, not a 4K
  one. Rendering is taken over with an R3F `useFrame` priority callback, and
  the frame number always comes from `useCurrentFrame()`, never R3F's clock.
- `src/lib/post.ts` is the shared post chain. It runs:
  1. MSAA HDR scene;
  2. gather-pass depth of field (half resolution, fixed 48-tap golden-angle
     pattern with a fixed per-pixel rotation);
  3. sharp overlays (waves, flares);
  4. bloom (threshold plus a deterministic 6-level mip chain);
  5. the final pass: chromatic aberration (3C only), tone shoulder, grade,
     vignette, then grain and ±1/255 triangular dither last.

  Grain is a hash of pixel position and `frame % loop` (`% 450` for the
  chart).
- `src/hud/` is the shared HUD kit: Canvas-2D element painters and
  `HudPanel`. Static parts are drawn once. Widgets are small canvases
  redrawn from the frame number, and only when their frame-derived key
  changes.
- `src/android/` is Look 1: head mesh with seam-darkened clear-coat plastic
  and wrap diffuse, emissive irises, halos, lens flares, the surface
  wireframe and the targeting rings as screen-space fat lines, 24
  screen-space wave ribbons with sparkle beads, and HUD panels at 10 depths.
- `src/chart/` is Look 2: a tilted screen, the area chart in a fragment
  shader, kit elements around it and light sweeps.
- `src/racks/` is Look 3. Procedural faceplates (colour, roughness and a
  Sobel normal map from a painted height canvas) go on instanced bevelled
  chassis, with instanced fins, handles, caddies, LEDs and glows. Patch
  cables are `TubeGeometry` port-to-port loops with clear plugs and boots
  (one red per switch). LED blink schedules are an integer hash of
  `(frame % 600, seed)` in the shader.

### Determinism

- No `Math.random()`, `Date.now()` or `useState` driving visuals, and no
  TAA.
- All randomness is `mulberry32` seeded at module level, or stateless hashes.
- Loops use whole cycles: walks return to their start, holds divide the
  composition length, and cameras move exactly one period.

RESULTS_PLACEHOLDER
