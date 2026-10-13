# Tech Loops: Triangle Relief · Iso Cloud Chip · AI Brain Chip · Circuit Horizon · Neon Podium

This is one Remotion project with five 3D looks and eight compositions. Every composition is a
**20 s seamless loop** (600 frames at 30 fps), defined at **3840×2160** and built entirely in
code with **three.js on WebGL2** through `@remotion/three`. There are no image or video assets.
The only external file is the OFL font used for the "AI" letters.

| Composition id | Output file | Look | Reference |
|---|---|---|---|
| `TriangleRelief-BlackGold` | `TriangleRelief_BlackGold.mp4` | 1A: as reference | 1097716673 |
| `TriangleRelief-NavySilver` | `TriangleRelief_NavySilver.mp4` | 1B | |
| `IsoCloudChip-BlueViolet` | `IsoCloudChip_BlueViolet.mp4` | 2: as reference | 1108151845 |
| `AIBrainChip-GoldBlue` | `AIBrainChip_GoldBlue.mp4` | 3A: as reference | 1096159459 |
| `AIBrainChip-CyanViolet` | `AIBrainChip_CyanViolet.mp4` | 3B | |
| `CircuitHorizon-Blue` | `CircuitHorizon_Blue.mp4` | 4: as reference | 1096241757 |
| `NeonPodium-BlueMagenta` | `NeonPodium_BlueMagenta.mp4` | 5A: as reference | 1099246071 |
| `NeonPodium-OrangeTeal` | `NeonPodium_OrangeTeal.mp4` | 5B | |

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ is needed. Versions are pinned in `package.json` (Remotion 4.0.515, three 0.180.0,
@react-three/fiber 9.3.0, React 19.2.3).

### Chromium GL flag

The project renders through WebGL2 in headless Chromium using **ANGLE**:

```ts
// remotion.config.ts
Config.setChromiumOpenGlRenderer("angle");   // CLI equivalent: --gl=angle
```

On a machine with a GPU, ANGLE uses it. Without one, Chromium falls back to SwiftShader, which
produces identical images but runs slower; all the timings below were measured on that path.
The config also sets PNG intermediate frames (no JPEG banding before the encode), concurrency 4,
and a 120 s delayRender timeout.

## Rendering at 4K

Run these from the project root. Remotion's built-in H.264 encode:

```bash
npx remotion render TriangleRelief-BlackGold  out/TriangleRelief_BlackGold.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render TriangleRelief-NavySilver out/TriangleRelief_NavySilver.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render IsoCloudChip-BlueViolet   out/IsoCloudChip_BlueViolet.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render AIBrainChip-GoldBlue      out/AIBrainChip_GoldBlue.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render AIBrainChip-CyanViolet    out/AIBrainChip_CyanViolet.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CircuitHorizon-Blue       out/CircuitHorizon_Blue.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render NeonPodium-BlueMagenta    out/NeonPodium_BlueMagenta.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render NeonPodium-OrangeTeal     out/NeonPodium_OrangeTeal.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

**Recommended for delivery (best gradients):** render a lossless PNG sequence, then encode it
with x264 settings that keep the shader's dither in the near-black gradients. Stock settings
smooth the ±1/255 dither away, which brings back steps; see *Banding* below. This is exactly
how the previews were made (`scripts/render-preview.sh`):

```bash
ID=CircuitHorizon-Blue; STEM=CircuitHorizon_Blue
npx remotion render $ID out/frames/$ID --sequence --image-format=png --gl=angle
ffmpeg -framerate 30 -i out/frames/$ID/element-%03d.png -c:v libx264 -preset slow -crf 16 \
  -x264-params aq-mode=3:aq-strength=1.4:deadzone-inter=0:deadzone-intra=0 \
  -pix_fmt yuv420p -r 30 -an -movflags +faststart out/$STEM.mp4
```

For a mezzanine master, `--codec=prores --prores-profile=4444` also works.

### 720p previews

The previews are the same thing at `--scale=0.3333333333333333`, which gives exactly 1280×720:

```bash
scripts/render-all.sh            # every version row, or: scripts/render-all.sh <id> <id> ...
```

### 6K stills (6000×3375)

These are not rendered here. Use:

```bash
npx remotion still <CompositionId> out/<FileStem>_6K.png --frame=300 --scale=1.5625 --image-format=png --gl=angle
# e.g.
npx remotion still NeonPodium-BlueMagenta out/NeonPodium_BlueMagenta_6K.png --frame=300 --scale=1.5625 --image-format=png --gl=angle
```

`--scale` sets the device pixel ratio, and the canvas uses it directly, so a 6K still is
rendered natively at 6000×3375 rather than upscaled.

## Adding a colourway (one data row)

All versions live in `src/versions.ts`. To add one, copy a row and change its id, file name
and colours:

```ts
{ id: "NeonPodium-GreenGold", file: "NeonPodium_GreenGold", look: "neonPodium",
  params: { neonA: "#3AFF8A", neonB: "#FFC83A", ambient: "#06100A" } },
```

The composition appears in the Studio and in `scripts/render-all.sh` automatically. Parameters
per look:

| Look | Params |
|---|---|
| `triangleRelief` | `tile`, `line`, `keyTint` |
| `isoCloudChip` | `boardA`, `boardB`, `cyan`, `screen`, `body` |
| `aiBrainChip` | `brain` (folds near the chip and badge), `outer` (cool folds), `city` (LEDs), `bg` (haze) |
| `circuitHorizon` | `board`, `light`, `horizon` |
| `neonPodium` | `neonA`, `neonB`, `ambient` |

## How it is built

- `src/engine/LoopCanvas.tsx`: a `<ThreeCanvas>` (from `@remotion/three`) whose only input is
  `useCurrentFrame()`. Each look is a plain imperative three.js program built once and asked to
  draw frame N. R3F's `useFrame` is used only as the "draw now" hook that `@remotion/three`
  fires per frame (priority 1); its clock is ignored. The canvas renders at the output pixel
  ratio, so `--scale=1/3` draws 1280×720 and not 4K-then-downscale.
- `src/engine/post.ts`: the shared post chain. HDR (half-float) scene target, MSAA where no depth
  texture is needed, a 13-tap bloom pyramid, a scatter-as-gather depth-of-field pass (CoC in
  the alpha channel), corner soft-focus, tonemap, vignette, grain and dither.
- `src/engine/bokeh.ts`: emissive LEDs drawn as bokeh discs whose radius is their own circle of
  confusion, occlusion-tested against the scene depth (Looks 3 and 4).
- `src/engine/periodic.ts`: Looks 3 and 4 use a layout tile of length P repeated K times. The
  world slides exactly P toward the camera per loop, which is the same as the camera flying
  forward exactly one layout period in 600 frames.
- `src/looks/*.ts`: the five looks. Layouts (tiles, tracer routes, components, lights, satellites,
  cube wall) are generated once at module level from seeded `mulberry32`.

### Determinism

- No `Math.random()`, no `Date.now()`, no `useState` driving visuals, no TAA or accumulation,
  and nothing carried between frames.
- Every periodic motion is `cyc(frame, k) = ((k·frame) mod 600)/600` with **whole** k, so the
  loop closes exactly. A non-whole k would fail the loop check below.
- Shader noise, grain and dither are integer (PCG) hashes of pixel position and `frame % 600`.
- The font is loaded with `FontFace` behind `delayRender`/`continueRender` before the canvas
  mounts. Canvas textures (badge text, chip circuit, device screens) are drawn once from seeded
  data.

## Measured render times

These were measured in this build environment: 4 CPU cores, no GPU (Chromium WebGL2 through
ANGLE, falling back to SwiftShader). A machine with a GPU will be much faster.

**720p** (`--scale=1/3`, 1280×720, PNG frames):

| Composition | Full 600-frame render, concurrency 4 | Wall time per frame | Single tab, per frame |
|---|---|---|---|
| TriangleRelief-BlackGold | 194 s | 0.32 s | 0.39 s |
| TriangleRelief-NavySilver | 186 s | 0.31 s | 0.40 s |
| IsoCloudChip-BlueViolet | 194 s | 0.32 s | 0.41 s |
| AIBrainChip-GoldBlue | 905 s | 1.51 s | 1.53 s |
| AIBrainChip-CyanViolet | 900 s | 1.50 s | 1.55 s |
| CircuitHorizon-Blue | 255 s | 0.43 s | 0.52 s |
| NeonPodium-BlueMagenta | 247 s | 0.41 s | 0.51 s |
| NeonPodium-OrangeTeal | 248 s | 0.41 s | 0.50 s |

The "single tab" column is (time for 31 frames − time for 1 frame) / 30 at concurrency 1, so
browser startup is excluded. On 4 cores the renders are CPU-bound, so concurrency 4 only adds
about 1.0–1.25× throughput.

**Two real 4K frames** (3840×2160, frame 300, concurrency 1):

| Composition | 1 frame from cold, including ~4.5 s browser and bundle startup | Each further frame |
|---|---|---|
| CircuitHorizon-Blue | 7.8 s | **2.7 s** |
| NeonPodium-BlueMagenta | 12.3 s (also compiles shaders and allocates the reflection targets) | **2.4 s** |

**4K estimates** for a full 600-frame render on this same CPU-only machine. These are based on
the 4K/720p cost ratio of about 5× measured above:

| Look | Per frame | 600 frames |
|---|---|---|
| Triangle Relief (each version) | ~2.0 s | ~17–20 min |
| Iso Cloud Chip | ~2.1 s | ~18–21 min |
| AI Brain Chip (each version) | ~7.5–9 s | ~75–90 min |
| Circuit Horizon | 2.7 s (measured) | ~23–27 min |
| Neon Podium (each version) | 2.4 s (measured) | ~20–24 min |

All eight together come to roughly 4.5–5 hours on this machine. On a workstation GPU, expect a
small fraction of that, since every pass is fragment-shader bound.

## Banding check (encoded mp4, not the preview)

The dark backgrounds of Looks 1, 4 and 5, the blue-violet board gradient of Look 2, the AI
Brain Chip haze and the Circuit Horizon glow were all checked. For each, frame 300 was decoded
from the **encoded mp4**, and luminance profiles were read across those areas, averaged over
16-px strips (`scripts/banding.py`, results in `out/verify/report.txt` when you run
`scripts/verify.sh`).

- What is in the pipeline: a ±1/255 triangular dither in the final pass (independent per RGB
  channel), and 1.5 % grain from an integer hash of (pixel, `frame % 600`). For Looks 1 and 4
  the grain fades to zero below about 3 % luminance.
- Finding: the stock x264 settings removed the dither in near-black flats and brought back
  2-level steps. In the Circuit Horizon sky, blue went 6, 6, 6, 6, 8, 8, … because yuv420p chroma
  in the dark blues moves in steps of about 2. The lossless PNG frames were smooth at that
  point.
- Fix: per-channel dither, plus x264 `aq-mode=3:aq-strength=1.4:deadzone-inter=0:deadzone-intra=0`
  (still CRF 16, yuv420p).
- Results after the fix:
  - Neon Podium sky and floor, Iso board, AI Brain haze and the Circuit Horizon glow change
    smoothly: no flat runs longer than 2–4 px and no staircase.
  - The Triangle Relief walls show runs of 10–19 px. Those are single flat-shaded tile faces
    (the profile crosses seams), not quantisation steps.
- Remaining: in the top of the Circuit Horizon sky, where luminance is about 1/255, blue still
  holds near-constant runs of about 20 px. This is at the 8-bit black floor and is not visible.
  For a master with no compromise, use the PNG sequence or ProRes 4444.

## Completion checklist

| Check | Result |
|---|---|
| 8 compositions, 3840×2160, 600 frames, 30 fps, one data row each | ✅ |
| three.js on WebGL2 via `@remotion/three`, ANGLE | ✅ |
| Determinism: no `Math.random`/`Date.now`/`useState`/`useFrame` clock/TAA; seeded module-level layouts | ✅ |
| Step 1: ffprobe on all 8: h264, yuv420p, 1280×720, 30/1, 20.000 s, no audio stream | ✅ |
| Step 2: loop check on all 8 (601-frame variant `--props='{"loopCheck":true}'`): frame 600 = frame 0 pixel for pixel | ✅ |
| Step 3: frame 300 rendered cold = frame 300 of the full render, byte for byte, on all 8 | ✅ |
| Step 4: banding read from the encoded mp4 | ✅ (see above) |
| Step 5: contact sheets (5 frames) per composition | ✅ |
| Step 6: motion around frame 300 (no flicker, strobing or crawl) | ✅ |
| Steps 7–8: matched to the references, three rounds of independent comparison per look | ✅ (residual differences listed in the delivery report) |
| `npm install && npx remotion studio` from a clean copy of the zip | ✅ |
| Inter Bold (OFL), with its licence in `public/fonts/OFL-Inter.txt`; no other text, logos or brands | ✅ |

Re-run the checks with `scripts/verify.sh` after `scripts/render-all.sh`.
