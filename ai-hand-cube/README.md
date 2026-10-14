# AI Hand Cube — Remotion + three.js (WebGL2)

A robot hand rises, a glass "AI" cube builds itself above the palm, and the
scene holds among floating HUD panels. One look, four compositions, one
Remotion project. Everything is built in code (no models, no images, no MCP
servers); fonts are OFL.

| Composition id (Remotion) | Output file | Length | What it is |
|---|---|---|---|
| `AIHandCube-Story` | `AIHandCube_Story.mp4` | 15 s, 450 f | the reference move: rise → build → "AI" → hold |
| `AIHandCube-HoldLoop` | `AIHandCube_HoldLoop.mp4` | 20 s, 600 f | the finished scene as a seamless loop |
| `AIHandCube-Gold` | `AIHandCube_Gold.mp4` | 15 s, 450 f | the Story in gold-white / warm bronze |
| `AIHandCube-Mirrored` | `AIHandCube_Mirrored.mp4` | 20 s, 600 f | the loop, hand + cube in the right third, left half clear |
| `HandStudy` | — | 3 f | realism-gate stills of the hand alone (front, ¾, below) |

Remotion composition ids may not contain `_`, so the ids use `-`; the output
files use the names from the brief.

All compositions are defined at **3840×2160, 30 fps**.

## Setup

```bash
npm install
npx remotion studio        # preview (renders at reduced resolution in the Studio)
```

Node 18+ is required. The Studio preview draws at 0.4× device-pixel-ratio to
stay interactive; final renders use the full resolution.

## Chromium / GL

WebGL2 runs in headless Chromium with the **ANGLE** backend:

```
--gl=angle
```

`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("angle")`,
so the flag is only needed when you call the Node APIs directly
(`chromiumOptions: { gl: "angle" }`). On machines without a GPU, ANGLE falls
back to SwiftShader (CPU) — it works, just slowly (see render times).

## 4K render commands

```bash
npx remotion render src/index.ts AIHandCube-Story    out/AIHandCube_Story.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts AIHandCube-HoldLoop out/AIHandCube_HoldLoop.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts AIHandCube-Gold     out/AIHandCube_Gold.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts AIHandCube-Mirrored out/AIHandCube_Mirrored.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

On a GPU machine raise `--concurrency`; on a CPU-only (SwiftShader) machine
keep `--concurrency=1` — SwiftShader already uses every core, and more tabs
only compete for them.

720p previews (what was rendered here):

```bash
npx remotion render src/index.ts AIHandCube-Story out/AIHandCube_Story.mp4 --scale=0.3333333333333333 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --concurrency=1
```

`--scale=0.3333333333333333` gives exactly 1280×720 (verified with ffprobe).

## 6K still (6000×3375)

```bash
npx remotion still src/index.ts AIHandCube-Story out/AIHandCube_Story_6K.png --frame=380 --scale=1.5625 --gl=angle
```

(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375.) Change the id/frame for the
other versions. No 6K stills were rendered here.

## Changing the cube text or adding a colourway

Everything per version is **one data row** in `src/versions.ts`:

```ts
{
  id: "AIHandCube-Story",      // Remotion id (no underscores)
  durationInFrames: 450,
  timeline: "story",           // "story" (15 s build) or "loop" (seamless)
  palette: BLUE,               // colours (see below)
  framing: { cubeScreenX: 0.525, clearLeft: false },
  cubeText: "AI",              // letters on the cube's front face
}
```

- **Cube text:** change `cubeText` (short words work best; the font size
  shrinks for 3+ letters).
- **New colourway:** copy the `BLUE` or `GOLD` palette object, change the hex
  values (`background`, `glow`, `circuit`, `text`, `hud`, `hudAccent`,
  `handBase`, `handJoint`, `rim`, `key`, and `emissive` — overall glow
  strength; warm hues bloom harder, so gold uses 0.62), then add a row that
  uses it. The composition is registered automatically from the row.
- **Copy-space framing:** `cubeScreenX` moves the subject horizontally (0.68 =
  right third); `clearLeft: true` removes the HUD panels from the left half
  except up to three soft far ones.

## Project layout

```
src/
  versions.ts          one data row per version (colours, framing, timeline, text)
  AIHandCube.tsx       the composition: builds the scene once, updates it per frame
  HandStudy.tsx        realism-gate stills of the hand alone
  lib/timeline.ts      every animated value as a pure function of the frame
  lib/random.ts        mulberry32, seeded at module level
  lib/fonts.ts         OFL fonts loaded once (delayRender until ready)
  scene/hand.ts        procedural robot hand (joint hierarchy, sculpted lofts)
  scene/geom.ts        loft / tube helpers
  scene/cube.ts        glass cube, circuit texture, "AI", edges, glows
  scene/hud.ts         14 HUD panels (canvas textures, in-shader DoF blur)
  scene/particles.ts   300 specks (closed-form motion in the vertex shader)
  scene/background.ts  navy base + glow behind the cube
  scene/environment.ts procedural PMREM environment
  post/pipeline.ts     half-float targets, DoF, bloom, tone map, grain, dither
public/fonts/          Exo 2 SemiBold + JetBrains Mono (woff2) and OFL licence texts
```

## Determinism

Remotion renders frames out of order, across several tabs. Every visible value
is derived from `useCurrentFrame()`:

- `computeState(frame, version)` (`src/lib/timeline.ts`) returns every animated
  value; the scene is updated from it in a layout effect before Remotion asks
  R3F to draw.
- No `Math.random()` at render time — `mulberry32` is seeded at module level;
  HUD text, tick schedules, circuit layout and particle paths are generated
  once. HUD panel content is a pure function of (panel seed, tick index).
- No `useFrame` clock (the one `useFrame` only *draws*, at priority 1), no
  `Date.now()`, no `useState` driving visuals, no physics/IK; finger angles are
  direct functions of the frame.
- No TAA, no accumulation. Grain and dither are a fixed integer hash of pixel
  position and `frame % durationInFrames`.
- Loops: every periodic motion completes whole cycles in 20 s (cube turn,
  bob, finger flex, camera orbit, HUD drift, circuit pulses with a 2 s period,
  particle periods of 20/n s, HUD ticks with periods that divide 600 frames).

## Banding

- Scene, DoF, HUD and bloom buffers are **half-float** render targets.
- The final pass adds a triangular **±1/255 dither** and **~1.5 % grain**
  (hash of pixel + frame index).
- The check was done on frames decoded **from the encoded mp4** — see results.

RESULTS_PLACEHOLDER
