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

| | per frame | 600 frames (one composition) |
|---|---|---|
| 1080p, measured (full `Warning` render, 2 tabs) | **2.13 s** | 21 min 18 s |
| 1080p, measured (12-frame sample, after ~10 s startup) | 2.2 s | |
| 4K, measured on a 12-frame sample | **≈ 9.2 s** | **≈ 1 h 32 min** (estimate) |
| 4K, all 10 compositions | | ≈ 15 h on this machine (estimate) |

Concurrency doesn't help on a CPU-only machine, because SwiftShader already
uses every core. 24-frame tests: concurrency 1 ≈ 2.4 s/frame, 4 ≈ 3.5 s/frame. On a
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

Results on the delivered previews (frame 150, decoded from the mp4):

| | beam falloff (blue, centre → 480 px out) | dark board (blue, bottom-left) |
|---|---|---|
| `AIChat` grain-free range | 2.9 → 177.2 | 8.0 → 20.0 |
| `AIChat` staircase steps / missing codes | 0 / none | 0 / none |
| `Warning` grain-free range | 3.1 → 176.9 | 7.9 → 18.4 |
| `Warning` staircase steps / missing codes | 0 / none | 0 / none |

Raw single pixels in the beam tail look like `25 25 25 26 28 28 33 34 33 30 35 …`:
neighbouring codes are mixed by grain and dither instead of forming flat bands.
As a negative control, a deliberately posterised copy of a frame (6-level
steps) fails the check with 21 missing codes in the beam.

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

- [x] 3D with `@remotion/three` / react-three-fiber, WebGL2 (`--gl=angle`), built entirely in code
- [x] 10 compositions from 10 data rows (`id`, `svgPath`, `label`, `iconScale`), 3840×2160, 30 fps, 600 frames
- [x] Self-drawn SVG icons (stroke ≈ 8% of icon height, round joins), `ExtrudeGeometry` with depth 12% of height and a rounded bevel
- [x] Emissive gradient shader (OKLab), brighter bevels, faint white core, glints, strong bloom
- [x] Labels in Montserrat Bold (OFL, shipped) for ActiveProtection / Warning / SystemAlert / DataLock, same gradient, dimmer
- [x] Glossy reflective board (`MeshReflectorMaterial`), icon and label reflections
- [x] Seeded traces (45° bends) fanning from connector chips, pads and vias (some blinking), sparks, dark blocks, all instanced or merged
- [x] Blue light beam (additive cones and planes, looping noise) with a floor spot
- [x] 37 mm lens, 30° down, ±25° yaw sway with height change, depth of field, bloom, subtle chromatic edge, ACES, sRGB
- [x] Colour cycle magenta/cyan → hot pink/blue → red/pink → pink-white/magenta, one cycle per loop
- [x] Seamless loop: frame 0 ≡ frame 600 (pixel-identical) for `AIChat` and `Warning`
- [x] Deterministic: cold frame 300 ≡ full-render frame 300, byte for byte, for `AIChat` and `Warning`
- [x] Banding: dither ±1/255 + ~2% grain after tonemapping, checked on the encoded mp4
- [x] 1080p previews `NeonIcon_AIChat.mp4`, `NeonIcon_Warning.mp4`: 1920×1080, 30/1, 20.0 s, h264, yuv420p, no audio
- [x] 6000×3375 stills: frame 0 for all 10, plus frame 300 for `AIChat` and `Warning`
- [x] 1080p stills at frames 0 and 300 for the other eight
- [x] Render time measured (1080p) and 4K estimated
- [x] `npm install && npx remotion studio` checked from a clean copy

## Licences

- **Montserrat**: Copyright The Montserrat Project Authors, SIL Open Font
  License 1.1 (`public/fonts/OFL.txt`).
- Icons, board and code: original to this project. No icon libraries, logos or
  brand marks.
- Simplex noise GLSL: Ashima Arts / Stefan Gustavson (MIT).
