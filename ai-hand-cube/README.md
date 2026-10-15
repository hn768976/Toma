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
| `AIHandCube-HoldLoopViolet` | `AIHandCube_HoldLoopViolet.mp4` | 20 s, 600 f | the Hold Loop in dark violet (lavender circuit, magenta HUD accents) |
| `AIHandCube-HoldLoopGold` | `AIHandCube_HoldLoopGold.mp4` | 20 s, 600 f | the Hold Loop in gold / warm bronze |
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
npx remotion render src/index.ts AIHandCube-HoldLoopViolet out/AIHandCube_HoldLoopViolet.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts AIHandCube-HoldLoopGold out/AIHandCube_HoldLoopGold.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
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

### Banding check (results)

Frames decoded from each encoded 720p mp4, a 13-row strip of pure background
glow above the cube, averaged to remove grain, then read left to right:

| Version | 8-bit levels across the strip | largest step between neighbours | residual vs. smooth curve (rms) |
|---|---|---|---|
| Story | 35.3 → 7.5 | 0.19 | 0.29 |
| HoldLoop | 33.0 → 7.4 | 0.16 | 0.27 |
| Gold | 13.3 → 2.3 | 0.13 | 0.19 |
| Mirrored | 31.7 → 11.2 | 0.14 | 0.30 |

Values change smoothly (well under one 8-bit level per pixel, no plateaus or
staircases); a contrast-stretched view (0–60 → 0–255) shows no rings. The few
larger local deviations are particles crossing the strip.

## Render times (measured)

Machine used here: 4 vCPU, no GPU — Chromium WebGL2 through ANGLE →
SwiftShader (CPU). `--concurrency=1` (more tabs were *slower*: 30 frames took
70 s at 1 tab, 82 s at 4 tabs). Per-frame time = full-render wall time ÷
frames (includes ~7 s of browser start-up spread over the run).

| Composition | Frames | Full 720p render (wall) | Per frame at 720p |
|---|---|---|---|
| AIHandCube-Story | 450 | 1561 s | **3.5 s** |
| AIHandCube-HoldLoop | 600 | 2433 s | **4.1 s** |
| AIHandCube-Gold | 450 | 1560 s | **3.5 s** |
| AIHandCube-Mirrored | 600 | 2225 s | **3.7 s** |
| AIHandCube-HoldLoopViolet | 600 | 2167 s | **3.6 s** |
| AIHandCube-HoldLoopGold | 600 | 2073 s | **3.5 s** |

(The final framing puts a large out-of-focus hand in the foreground; the
depth-of-field gather over that area is the biggest cost.)

**One real 4K frame** of `AIHandCube-Story` at the hold (frame 380,
3840×2160): **~50 s** (59 s wall for a single cold `remotion still`, minus
~9 s of browser start-up and scene build measured with the same command at
720p).

**4K estimates on this CPU-only machine:** Story / Gold ≈ 450 × 50 s ≈ **6.3 h
each**, HoldLoop / Mirrored ≈ 600 × 50 s ≈ **8.3 h each** — ≈ 29 h for all
four. On a machine with a real GPU (ANGLE on GL/Vulkan) expect roughly an
order of magnitude faster, and `--concurrency` can then be raised; that
figure is an estimate, not measured here.

## Verification results

| Check | Result |
|---|---|
| 1. ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, 15.0 s / 20.0 s | pass (all four; 450 / 600 frames) |
| 2. Loop: frame 0 vs frame 600 of a temporary 601-frame composition | pass — 0 differing pixels (HoldLoop, Mirrored, HoldLoopViolet, HoldLoopGold) |
| 3. Determinism: middle frame rendered alone, cold, vs the same frame from a 3-tab out-of-order render | pass — byte-identical PNGs (all four) |
| 4. Banding on frames decoded from the mp4 | pass (table above) |
| 5. Contact sheets | pass — rise → square → edges → glass → circuit → "AI" → hold; loops move gently; Mirrored keeps the left half clear |
| 6. Motion | pass — no joint pops or isolated jumps; HUD ticks are staggered per panel |
| 7./8. Look vs. reference | matched over three rounds of independent comparison (see the delivery report) |

## Completion checklist

- [x] One Remotion project, 4 compositions, 3840×2160 @ 30 fps (450 / 600 frames)
- [x] three.js on WebGL2 via `@remotion/three`; `--gl=angle`
- [x] Robot hand: jointed hierarchy, 4 fingers × 3 segments + 2-segment thumb, ball joints, seams, wrist going out of frame
- [x] Realism gate run (stills in `realism-gate/`)
- [x] Glass cube: transmission 0.6, roughness 0.1, fresnel rim, circuit texture, "AI" in Exo 2 SemiBold, 12-edge frame
- [x] Build: square on palm → edges draw on → glass → circuit traces from the centre → "AI" flash
- [x] 14 HUD panels at several depths, JetBrains Mono, seeded ticking, in-shader DoF blur
- [x] ~300 particles from the palm; navy background with glow; DoF focused on the cube
- [x] Gold colourway; Mirrored framing (cube at x ≈ 68 %, left half clear)
- [x] Half-float targets, ±1/255 dither, ~1.5 % grain from pixel + frame index
- [x] Deterministic: no `Math.random()`, no clocks, no state, no TAA / accumulation
- [x] Loops seamless; middle frames byte-identical when rendered alone
- [x] OFL fonts + licence texts; no logos, brands or product names
- [x] One data row per version; README with commands, timings and checks

## Notes / deviations from the brief

- Composition ids use `-` (Remotion forbids `_`); output files use `_`.
- The cube is 80 % of the palm width (brief: ~70 %) to match the reference's
  proportions.
- The hand colour is a light silver-grey `#C6CCD5` (brief: `#E8ECF2`) — chosen
  in review as a middle ground between the brief and the reference. After
  review the finish became polished satin metal (metalness 0.85, roughness
  0.22, thin clearcoat) reflecting a procedural studio environment with strip
  lights, to match the reference's polished silver hand (brief: metalness
  0.3, roughness 0.3). Gold uses silver-champagne `#D6CBB8`.
- The thumb is shorter than the fingers but the chunkiest digit (chosen in
  review).
- Hand pose follows the reference: palm up, fingers toward the viewer as a
  soft-focus row at the bottom, thumb rising beside the cube, the cube
  floating just above the palm over a glow pool. The forearm is aimed away
  from the camera behind the palm, so **the wrist is never visible**
  (the brief's "wrist going out of frame below" was replaced at review).

## Licences

Exo 2 and JetBrains Mono are licensed under the SIL Open Font License 1.1 —
see `public/fonts/OFL-Exo2.txt` and `public/fonts/OFL-JetBrainsMono.txt`.

