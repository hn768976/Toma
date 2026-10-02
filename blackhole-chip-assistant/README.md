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

`verify/stills.sh` renders all 18.

## Measured render time per frame (1080p) and 4K estimate

RENDER_TIMES_TABLE

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
diagnosis the chip also takes `"hide": ["dof","trace","shell","mirror","inner","filament","spark","board"]`
(any subset) in the same props.

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
- the font is loaded with `delayRender`/`continueRender`
  (`src/assistant/fonts.ts`). The 3D looks load no texture files: the chip's
  cell-schedule texture is a `DataTexture` built in memory at module load, so
  it exists before the first frame. (`<ThreeCanvas>` itself holds each frame
  with `delayRender` until R3F has drawn it.)

## Checks

VERIFY_SECTION

## Banding check (how to repeat it)

Take a frame **from the encoded mp4**, not from the preview:

```bash
ffmpeg -i out/previews/BlackHole_Blue.mp4 -vf "select=eq(n\,300)" -vframes 1 bh.png
python3 verify/banding.py bh.png 883 615 1919 120   # core -> top-right corner
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

CHECKLIST
