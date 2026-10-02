# Neon Circuit Icons: Remotion + three.js template

A thick, glowing, extruded **neon icon** stands on a dark glossy **circuit
board**. Glowing traces fan out from connector chips, sparks travel along them
toward the icon, a soft blue beam falls from above, and dark blocks fade into
the background. The camera sways around the icon while its gradient cycles
magenta/cyan → hot pink/blue → red/pink → pink-white/magenta.

- **3D**: `@remotion/three` + react-three-fiber, WebGL2 (not WebGPU)
- **10 icons → 10 compositions**, each a **20 s seamless loop** (600 frames at
  30 fps), defined at **3840×2160**
- Same seeded board, same traces, same camera in every composition. Only the
  icon and its label change.

| # | Composition | Icon | Label |
|---|---|---|---|
| 1 | `AIChat` | two overlapping speech bubbles (text lines / "AI") | none |
| 2 | `Chatbot` | speech bubble with three dots | none |
| 3 | `AICloud` | cloud with circuit traces | none |
| 4 | `CloudUpload` | cloud with up arrow | none |
| 5 | `AINetwork` | "AI" box linked to three nodes | none |
| 6 | `ActiveProtection` | shield with circuit-brain pattern | ACTIVE PROTECTION |
| 7 | `Warning` | triangle with "!" | WARNING |
| 8 | `SystemAlert` | octagon with "!" | ALERT |
| 9 | `AIChip` | processor chip with "AI" | none |
| 10 | `DataLock` | padlock with circuit pattern | SECURED |

---

## Quick start

```bash
npm install
npx remotion studio          # preview (Studio caps the preview at 1080p internally)
```

Requires Node 18+ (tested on Node 22). Versions are pinned in `package.json`
and locked in `package-lock.json`.

## Chromium GL flag

Headless Chromium needs ANGLE for WebGL2:

```
--gl=angle
```

This is already set in `remotion.config.ts`
(`Config.setChromiumOpenGlRenderer('angle')`), so the commands below don't need
it, but it is harmless to pass explicitly. On a machine without a GPU, ANGLE
falls back to SwiftShader (software). `--gl=swangle` forces that path.

`remotion.config.ts` also sets the output format for every render: H.264,
CRF 16, `yuv420p`, BT.709, PNG intermediate frames (lossless, so no JPEG
blocking on the grain), and no audio track.

## Render at 4K (3840×2160)

One composition:

```bash
npx remotion render AIChat           out/NeonIcon_AIChat.mp4
npx remotion render Chatbot          out/NeonIcon_Chatbot.mp4
npx remotion render AICloud          out/NeonIcon_AICloud.mp4
npx remotion render CloudUpload      out/NeonIcon_CloudUpload.mp4
npx remotion render AINetwork        out/NeonIcon_AINetwork.mp4
npx remotion render ActiveProtection out/NeonIcon_ActiveProtection.mp4
npx remotion render Warning          out/NeonIcon_Warning.mp4
npx remotion render SystemAlert      out/NeonIcon_SystemAlert.mp4
npx remotion render AIChip           out/NeonIcon_AIChip.mp4
npx remotion render DataLock         out/NeonIcon_DataLock.mp4
```

The same, fully explicit:

```bash
npx remotion render AIChat out/NeonIcon_AIChat.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709 --image-format=png --muted
```

**All 10, one line:**

```bash
for c in AIChat Chatbot AICloud CloudUpload AINetwork ActiveProtection Warning SystemAlert AIChip DataLock; do npx remotion render "$c" "out/NeonIcon_$c.mp4" || break; done
```

1080p preview of any composition: add `--scale=0.5`. That renders natively at
1920×1080, because the canvas uses Remotion's device pixel ratio, so no 4K
work is wasted.

## Stills

```bash
# 6000×3375 PNG (3840×2160 × 1.5625), frame 0
npx remotion still AIChat out/NeonIcon_AIChat_6000x3375_f0.png --frame=0 --scale=1.5625

# 1080p PNG
npx remotion still AIChat out/NeonIcon_AIChat_f300.png --frame=300 --scale=0.5
```

`scripts/all-stills.sh` renders the full still set: 6000×3375 at frame 0 for
all 10, frame 300 for `AIChat` and `Warning`, and 1080p frames 0 and 300 for
the other eight.

## Render time

Measured in a 4-core cloud container with **no GPU** (Chromium WebGL on
SwiftShader, i.e. software rendering), 1080p (`--scale=0.5`), full 600-frame
render:

| | per frame | 600 frames |
|---|---|---|
| 1080p, measured | **RENDER_1080_PER_FRAME s** | RENDER_1080_TOTAL |
| 4K, estimate on the same machine (4× the pixels) | ~RENDER_4K_PER_FRAME s | ~RENDER_4K_TOTAL |

Concurrency barely matters on a CPU-only machine (SwiftShader already uses
every core: 2.4 s/frame at concurrency 1 vs 2.4 s at 2 and 3.5 s at 4). On a
machine with a real GPU and `--gl=angle`, expect a large speed-up (typically
10× or more). Benchmark one composition with `--frames=0-59` before batching.

## Loop, determinism, banding: how they were checked

All three scripts use Remotion's bundled ffmpeg, so there are no extra
dependencies.

```bash
npx remotion bundle src/index.ts --out-dir=out/bundle
scripts/verify-loop.sh AIChat            # frame 0 vs frame 600 of a 601-frame variant
scripts/render-preview.sh AIChat         # full 1080p render as PNG frames + mp4
scripts/verify-determinism.sh AIChat     # cold frame 300 vs full-render frame 300, byte for byte
node scripts/banding-check.mjs out/previews/NeonIcon_AIChat.mp4 150
```

- **Loop**: `--props='{"loopCheck":true}'` makes any composition 601 frames.
  Frames 0 and 600 must be pixel-identical. Everything moving completes whole
  cycles in 600 frames: camera (sines with frequencies 1 and 2), colour cycle
  (one cycle), sparks (`u = wrap(u0 + k·t, 1)` with whole-number `k`), blinking
  pads and glints (whole-number cycles), beam noise sampled on a circle in time
  (`noise(x, y, cos 2πt·r, sin 2πt·r)`), and grain hashed from `frame % 600`.
- **Determinism**: every value on screen is computed from `useCurrentFrame()`.
  There is no `Math.random()` at render time (board, chips, traces, pads,
  sparks, blocks and glints use `mulberry32` seeded at module level, the same
  seed for every icon), no `useFrame` clock, no `Date.now()`, no state carried
  between frames, and no TAA, temporal AO or accumulative shadows. Font and SVG
  load behind `delayRender` before the canvas mounts. `render-preview.sh` keeps
  the lossless frames of a normal two-tab (out-of-order) render, so frame 300
  can be compared byte for byte with a cold single-frame render.
- **Banding**: grain (about 2%, monochrome, an integer hash of pixel position
  and `frame % 600`) and ±1/255 triangular dither are applied **after** bloom
  and tonemapping, in display (sRGB) space. The check decodes a frame **from the
  encoded mp4** and reads pixel values across the beam falloff and the dark
  board. The grain-free (box-averaged) profile must change smoothly, with no
  flat plateaus followed by one-level jumps, and every 8-bit code inside smooth
  ranges must occur (missing codes mean posterisation).

BANDING_RESULTS

## How to add an icon

1. Draw `public/icons/MyIcon.svg`: 100×100 viewBox, stroked outlines
   (`stroke-width="7"`, round caps and joins). See
   [`public/icons/README.md`](public/icons/README.md) for the two extra
   attributes (`data-outline` for clouds, `data-knockout` for overlaps).
2. Add one row to `src/icons.ts`:

   ```ts
   { id: 'MyIcon', svgPath: 'icons/MyIcon.svg', label: 'MY LABEL', iconScale: 1.0 },
   ```

   `label` is optional (Montserrat Bold; it wraps to two lines when long).
   `iconScale` adjusts the size (1.0 is about 18% of frame width).

That's it: a new composition `MyIcon` appears in Studio, on the same board,
with the same camera and colour cycle.

## Project layout

```
remotion.config.ts      GL flag, codec/CRF/pixel format/colour space, PNG frames
src/icons.ts            the 10 data rows (id, svgPath, label, iconScale)
src/Root.tsx            one <Composition> per row (3840×2160, 30 fps, 600 frames)
src/NeonIcon.tsx        loads SVG + font behind delayRender, mounts <ThreeCanvas>
src/lib/geometry2d.ts   SVG strokes/fills and glyphs → Clipper → THREE.Shapes
src/lib/assets.ts       icon + label loading and layout (opentype.js)
src/lib/palette.ts      colour cycle, sampled in OKLab
src/lib/random.ts       mulberry32 + fixed seeds
src/scene/layout.ts     seeded board: chips, fanning traces with 45° bends, buses,
                        pads/vias/LED field, sparks, blocks
src/scene/*.tsx         Board (MeshReflectorMaterial), Traces (one merged mesh),
                        Chips (SDF), Pads/Sparks (instanced), Blocks (instanced),
                        Beam, IconMesh (extrusion, gradient shader, glints, label),
                        CameraRig, PostFX (DoF → chromatic edge → bloom, vignette,
                        ACES → grain + dither)
public/icons/           the 10 icon SVGs (+ authoring rules)
public/fonts/           Montserrat-Bold.ttf + OFL.txt (SIL Open Font License 1.1)
scripts/                stills, preview render, loop/determinism/banding checks
```

## Completion checklist

COMPLETION_CHECKLIST

## Licences

- **Montserrat**: Copyright The Montserrat Project Authors, SIL Open Font
  License 1.1 (`public/fonts/OFL.txt`).
- Icons, board and code: original to this project. No icon libraries, logos or
  brand marks.
- Simplex noise GLSL: Ashima Arts / Stefan Gustavson (MIT).
