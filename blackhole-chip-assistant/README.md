# Black Hole, Chip & AI Assistant — Remotion project

Three looks, two colour versions each, six compositions, all defined at
**3840×2160, 30 fps**:

| Composition id          | Look                | Version             | Length            | Loops? |
|-------------------------|---------------------|---------------------|-------------------|--------|
| `BlackHole-Blue`        | 1 Black Hole Jet    | A blue-white        | 600 f (20 s)      | yes    |
| `BlackHole-Gold`        | 1 Black Hole Jet    | B fiery orange-gold | 600 f (20 s)      | yes    |
| `ProcessorChip-Blue`    | 2 Processor Chip    | A electric blue     | 600 f (20 s)      | yes    |
| `ProcessorChip-Gold`    | 2 Processor Chip    | B amber-gold        | 600 f (20 s)      | yes    |
| `AIAssistant-Neon`      | 3 AI Assistant      | A purple-blue neon  | 300 f (10 s)      | **NO** |
| `AIAssistant-Terminal`  | 3 AI Assistant      | B green terminal    | 300 f (10 s)      | **NO** |

> **Look 3 does not loop.** It is a one-way exchange: the question types in,
> the send button pulses, the reply types in, then it holds. Don't edit it to
> loop and don't keyword it as a loop.

- **Looks 1 and 2 are 3D**: `@remotion/three` + react-three-fiber, WebGL2,
  post-processing from `@react-three/postprocessing` (bloom, depth of field,
  ACES filmic tonemapping, sRGB output) plus a custom film-grain/dither pass.
- **Look 3 is 2D**: React + SVG + CSS. One flat screen tilted with CSS 3D
  transforms. No WebGL.

## Setup

```bash
npm install          # versions are pinned in package.json / package-lock.json
npx remotion studio  # preview all six compositions
```

Node 18+ (built and checked with Node 22).

## Chromium GL flag

Looks 1 and 2 need WebGL2 in headless Chromium. `remotion.config.ts` sets

```ts
Config.setChromiumOpenGlRenderer("angle");   // == --gl=angle on the CLI
```

so every `npx remotion render|still` in this folder already uses it. If you
render through the Node API (`@remotion/renderer`), pass
`chromiumOptions: { gl: "angle" }` yourself — the config file doesn't apply
there. On a machine with no GPU, ANGLE falls back to SwiftShader (software);
that works, it's just slow (see timings below). `--gl=swangle` gives the same
result and speed on such machines.

The config also sets PNG intermediate frames, H.264, `yuv420p`, CRF 16, and a
3-minute delayRender timeout (shader compilation on software GL is slow).

## 4K render commands

```bash
npx remotion render BlackHole-Blue        out/BlackHole_Blue_4K.mp4
npx remotion render BlackHole-Gold        out/BlackHole_Gold_4K.mp4
npx remotion render ProcessorChip-Blue    out/ProcessorChip_Blue_4K.mp4
npx remotion render ProcessorChip-Gold    out/ProcessorChip_Gold_4K.mp4
npx remotion render AIAssistant-Neon      out/AIAssistant_Neon_4K.mp4
npx remotion render AIAssistant-Terminal  out/AIAssistant_Terminal_4K.mp4
```

(Codec, pixel format, CRF and `--gl=angle` come from `remotion.config.ts`;
add them explicitly if you prefer: `--codec=h264 --pixel-format=yuv420p --crf=16 --gl=angle`.)

1080p previews are the same commands with `--scale=0.5`.

## Still commands (6000×3375 PNG)

6000 / 3840 = 3375 / 2160 = **1.5625**, so stills are rendered with
`--scale=1.5625`:

```bash
npx remotion still BlackHole-Blue out/stills/BlackHole_Blue_f0090.png --frame=90 --scale=1.5625
```

The frames used for the delivered stills (3 per composition):

| Composition            | Frames            | Why |
|------------------------|-------------------|-----|
| BlackHole-Blue / Gold  | 90, 270, 450      | jet clearly defined, streaks well spread |
| ProcessorChip-Blue / Gold | 60, 240, 420   | different camera positions along the glide |
| AIAssistant-Neon / Terminal | 95, 170, 260 | question typed / mid-reply / full reply |

The 1080p PNG still of each composition is the first frame in that list.

`verify/stills.sh` renders all 18.

## Measured render time per frame (1080p) and 4K estimate

Measured on the machine these previews were made on: a 4-core cloud
container with **no GPU** (ANGLE → SwiftShader, software WebGL), one render
tab (`--concurrency=1`), nothing else running. Per-frame time is
(time for 40 frames − time for 5 frames) / 35, so start-up and shader
compilation are excluded. The 4K figures were measured the same way
(12 − 3 frames at `--scale=1`), not extrapolated.

| Look | 1080p (`--scale=0.5`) | 4K (measured) | 4K, 600 / 300 frames, 1 tab |
|------|----------------------:|--------------:|----------------------------:|
| 1 Black Hole Jet | **5.2 s/frame** | 6.1 s/frame | ≈ 61 min |
| 2 Processor Chip | **6.4 s/frame** | 7.0 s/frame | ≈ 70 min |
| 3 AI Assistant   | **2.6 s/frame** | 14.1 s/frame | ≈ 70 min |

Why 4K is barely slower than 1080p for looks 1 and 2: react-three-fiber
clamps the device pixel ratio to at least 1, so a `--scale=0.5` render
still draws the WebGL scene at 3840×2160 and Chromium downsamples the
screenshot. The 1080p previews are therefore supersampled 4K frames, and
the post effects (grain cell, bloom, depth-of-field radius, star sizes) are
sized from the real buffer height so they look the same at both scales.

Look 3 is CPU-bound in Chromium's CSS blur/mask compositing (four blurred
copies of the screen), which scales with pixel count — hence ~5× at 4K.

**4K estimate on a normal workstation with a GPU** (`--gl=angle` on real
hardware): the 3D looks are dominated here by software rasterisation, so
expect roughly 0.5–1.5 s/frame at 4K (5–15 min per 20 s clip) — this is an
estimate, not a measurement. Look 3 doesn't use WebGL; use
`--concurrency=4` or more (it parallelises across tabs; frames are
independent and deterministic).


## Where things are

```
src/
  Root.tsx               the six compositions (+ the loop-test switch)
  palettes.ts            ALL colours and the chat text  <- edit here
  common/
    constants.ts         fps, sizes, LOOP_FRAMES = 600
    random.ts            mulberry32 seeded PRNG (module-level only)
    time.ts              loop phase + periodic sin/cos helpers
    glsl.ts              4D simplex noise (looping fbm), integer hash
    GrainEffect.ts       film grain + ±1/255 dither (post, after bloom/tonemap)
    Post.tsx             bloom -> ACES -> grain chain
  blackhole/             look 1 (disc, jet, core, stars)
  chip/                  look 2 (cell schedule, traces, filaments, sparks, DOF)
  assistant/             look 3 (SVG screen, typing script, font loader)
public/fonts/            JetBrains Mono 500 + 700 (woff2) and OFL.txt
verify/                  the check scripts used below
```

## How to change the colours

Everything is in **`src/palettes.ts`**:

- `BLACK_HOLE_PALETTES.blue / .gold` — `core`, `inner`, `mid`, `outer` are the
  disc colour ramp from the centre to the edge; `jet` is the beam; `space`
  the background; `star` the star tint. Linear RGB 0..1.
- `CHIP_PALETTES.blue / .gold` — `cellDim`, `cellLine`, `cellLit` (HDR, >1
  makes it bloom), `innerGrid`, `edge`, `trace`, `pulse`, `spark`, `board`,
  `boardGlow`, `background`. Linear RGB; values above ~1 bloom.
- `ASSISTANT_PALETTES.neon / .terminal` — CSS colours for the screen gradient,
  neon lines, glow, text, the pixel-dot colour and `dotStrength` (0..1).

To add a third version, add a palette entry and register another
`<Composition>` in `src/Root.tsx` with `defaultProps={{ palette: "yourKey" }}`.
You can also try palettes live in Studio's props panel.

## How to change the chat text

`CHAT_TEXT` in **`src/palettes.ts`**: `title`, `question`, `reply`.
The reply wraps automatically (`replyMaxChars` in `src/assistant/Assistant.tsx`).
Timings are in **`src/assistant/script.ts`** (`TIMELINE`): question typing
frames 20–86, send pulse 93–109, reply 112–228. If you lengthen the text,
widen those windows; the per-character timings are re-generated from the same
seed, so they stay deterministic.

## How it loops (looks 1 and 2)

600 frames = 20 s. Every moving thing completes a whole number of cycles:

- disc pattern: 1 rigid turn (no radius-dependent spin — that can never return
  to its start);
- disc turbulence: 4D noise sampled around a circle in time,
  `noise(x, y, cos 2πt · r, sin 2πt · r)`, `t = frame/600`;
- jet streaks: noise made periodic in height (sampled around a circle as a
  function of y), scrolled up by 3–10 whole repeats per loop;
- camera paths: sums of sin/cos with whole cycles;
- trace pulses: 1–4 whole trips per loop;
- cell twinkle, filament flicker, sparks: fixed schedules built once from a
  seed and looked up by `frame % 600`;
- grain + dither: integer hash of (pixel, `frame % 600`).

Every periodic argument is reduced with `x - floor(x)` before `sin`/`cos`
(`src/common/time.ts`), and per-ribbon pulse parameters are `flat` varyings,
so phase 1.0 gives exactly the same pixels as phase 0.0 — not just nearly.

**Loop test** (`verify/loopcheck.sh`): `--props='{"loopTest":true}'` makes a
looping composition 601 frames long *and stops wrapping the phase*, so frame
600 is computed as phase 1.0, not as frame 0. Frame 600 then equals frame 0
only if every motion truly completes whole cycles. For the switch-off
diagnosis both 3D looks take a `"hide"` list in the same props (any subset):
chip `["dof","trace","shell","mirror","inner","filament","spark","board"]`,
black hole `["stars","disc","jet","core","bloom","grain"]`. Example:
`verify/loopcheck.sh ProcessorChip-Blue blue src/index.ts '["trace"]'`.

## Determinism

Everything on screen is a function of `useCurrentFrame()` only:

- no `Math.random()` at render time — `mulberry32` seeded at module level
  generates stars, traces, cell schedules, filaments, sparks, typing timings;
- no particle simulation, no `useFrame` clock, no `Date.now()`, no
  `useState` driving visuals, nothing carried between frames;
- look 3 has **no CSS `@keyframes` and no CSS transitions** (grep the source:
  there are none); typing, cursor blink and the send pulse are inline values
  computed from the frame;
- look 3 remounts its DOM every frame (`key={frame}`): Chrome otherwise
  re-uses raster tiles of the blurred focus layers from the previous frame
  drawn in the same tab, which moved ~10–20 pixels by 1/255 versus rendering
  that frame on its own;
- the black hole's core glow sprite gets a fresh copy of the camera
  orientation every frame (`camera.quaternion.clone()`): react-three-fiber
  only re-applies a prop whose value changed, so passing the camera's own
  quaternion object froze the sprite at the first frame each render tab drew;
- the font is loaded with `delayRender`/`continueRender`
  (`src/assistant/fonts.ts`). The 3D looks load no texture files: the chip's
  cell-schedule texture is a `DataTexture` built in memory at module load, so
  it exists before the first frame. (`<ThreeCanvas>` itself holds each frame
  with `delayRender` until R3F has drawn it.)

## Checks

All scripts are in `verify/` and were run on the delivered 1080p previews.

| Step | Script | Result |
|------|--------|--------|
| 1 File checks | `verify/probe.sh <mp4> <seconds>` | all six: h264, yuv420p, 1920×1080, 30/1, no audio; 600 frames / 20.000 s (looks 1, 2), 300 frames / 10.000 s (look 3) |
| 2 Loop check | `verify/loopcheck.sh <Comp> <palette>` | frame 600 == frame 0, **0 pixels differ**, for all four looping compositions; the 599→0 seam step is the same size as a normal 598→599 step |
| 3 Determinism | `verify/determinism.sh <Comp> <range>` | cold `remotion still` of frame 150 vs frame 150 of a multi-threaded render: **byte-identical PNGs** for all six (look 3: full 0–299 render; looks 1/2: frames 120–170 with 2 parallel tabs) |
| 4 Loading | every 15th frame of the encoded mp4 | 40/40 frames fully textured for both chips and both black holes; no grey/blank frames |
| 5 Banding | `verify/banding.py` on frame 300 of the encoded mp4 | 1A and 1B: smooth on four lines from the core to the frame edge (longest run of equal values ≤ 8 px outside the black floor; no steps) |
| 6 Content | five evenly spaced frames per composition | see the checklist below |

Look 3 has no CSS `@keyframes` or transitions (`grep -rnE "@keyframes|transition|animation" src/` finds only a comment).


## Banding check (how to repeat it)

Take a frame **from the encoded mp4**, not from the preview:

```bash
ffmpeg -i out/previews/BlackHole_Blue.mp4 -vf "select=eq(n\,300)" -vframes 1 bh.png
python3 verify/banding.py bh.png 883 616 1919 0     # core -> top-right corner
python3 verify/banding.py bh.png 883 616 1919 616   # core -> right edge, across the disc
```

It prints the luminance along the line and the lengths of runs of identical
values. In a dithered, grained gradient those runs stay a few pixels long;
banding shows as long flat runs followed by a jump.

## Font licence

JetBrains Mono — Copyright 2020 The JetBrains Mono Project Authors
(https://github.com/JetBrains/JetBrainsMono). Licensed under the **SIL Open
Font License 1.1**; full text in `public/fonts/OFL.txt`. Shipped as woff2
(weights 500 and 700, latin subset, from the `@fontsource/jetbrains-mono`
package). The OFL allows bundling and embedding in videos; it can't be sold
on its own.

## Names, logos

`AI Assistant` is a generic label. No real assistant, company or product names;
the chat layout (title, pill input with round send button, reply box) is
generic. The chip has no markings, model numbers or logos. The black hole is a
disc-and-jet image with **no ring of bent light** around the core.

## Completion checklist

- [x] 6 compositions, 3840×2160, 30 fps, one project (3D looks: R3F/WebGL2; look 3: 2D)
- [x] Looks 1 and 2: 600-frame loops, every motion a whole number of cycles; frame 600 == frame 0 pixel for pixel (phase not wrapped in the test)
- [x] Look 3: 300 frames, **not a loop**, timeline 0–20 / 20–90 / 90–110 / 110–230 / 230–299
- [x] No `Math.random()` at render time, no particle sim, no `useFrame` clock / `Date.now()` / `useState` visuals; all procedural data from module-level `mulberry32`
- [x] Look 3: no CSS `@keyframes` / transitions; typing, cursor, send pulse computed from the frame
- [x] Font loaded via `delayRender`; chip schedule texture built in memory (no async texture loads)
- [x] Frame 150 cold == frame 150 of a multi-threaded render, byte for byte, all six
- [x] Bloom with HDR threshold (only core, jet, lit cells, pulses bloom); ACES filmic tonemapping, sRGB output
- [x] Grain ~2 % (fixed hash of pixel and `frame % 600`) + ±1/255 dither after bloom/tonemap
- [x] Banding check on the encoded mp4 of 1A and 1B: smooth
- [x] Every size a fraction of the frame (look 3 fonts, strokes, glow, dot pitch; 3D grain cell, point sizes, DOF radius)
- [x] Look 1: core brightest; spiral arms with dark lanes; jet runs off the top with streaks moving up; faint counter-jet; **no ring of bent light**; 1B white-hot → gold → orange → red
- [x] Look 2: cell grid on top and side faces; lit cells change between frames; pulses move along traces; sharp band with near/far blurred; no markings/logos; 2B gold on a warm dark board with no blue
- [x] Look 3: empty input at frame 0, full question and reply at frame 299, exact text; dot grid across the whole screen; sharp around the input, softer away; cursor blinks; 3B green on near-black, same layout and text
- [x] 1080p previews (H.264, yuv420p, CRF 16, 30 fps, no audio), 1080p still of each, 3 × 6000×3375 stills per composition
- [x] Render time per frame measured at 1080p (and 4K) for each look
- [x] `npm install && npx remotion studio` works from a clean copy of the zip
- [x] No logos, no real product or company names
