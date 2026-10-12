# Data Space & Underwater — Remotion project

Five 20-second seamless-loop motion backgrounds (30 fps, 600 frames, defined at 3840×2160), built entirely in code.

| Composition ID | Look | Engine | Reference |
|---|---|---|---|
| `DataSpace-Slate` | 1 · Data Space (3D fly-through) | three.js via `@remotion/three`, WebGL2 | `1055423438` |
| `UnderwaterBubbles-DeepBlue` | 2A · Underwater Bubbles | PixiJS 8, WebGL2 | `1023581437` |
| `UnderwaterBubbles-Turquoise` | 2B · Underwater Bubbles | PixiJS 8, WebGL2 | — |
| `UnderwaterRays-DeepBlue` | 3A · Underwater Rays | PixiJS 8, WebGL2 | `1021140598` |
| `UnderwaterRays-Turquoise` | 3B · Underwater Rays | PixiJS 8, WebGL2 | — |

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ (tested with Node 22). Versions are pinned in `package.json`.

### Chromium GL flag

All looks need WebGL2 in headless Chromium. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the same as passing **`--gl=angle`** on the
command line. Keep it on every render and still command. On a machine without a GPU, ANGLE falls
back to SwiftShader (software). That is how every number below was measured.

## Render commands (4K)

```bash
npx remotion render DataSpace-Slate             out/DataSpace_Slate.mp4             --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render UnderwaterBubbles-DeepBlue  out/UnderwaterBubbles_DeepBlue.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render UnderwaterBubbles-Turquoise out/UnderwaterBubbles_Turquoise.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render UnderwaterRays-DeepBlue     out/UnderwaterRays_DeepBlue.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render UnderwaterRays-Turquoise    out/UnderwaterRays_Turquoise.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

720p preview (as delivered): add `--scale=0.3333333333333333` (3840/3 = 1280 exactly). Every
composition sizes its WebGL backbuffer to composition size × device pixel ratio, so a scaled render
really renders at that size. It is not a 4K render downscaled.

`scripts/render-preview.sh <id> <name>` is the exact preview pipeline used here. Remotion renders a
PNG sequence, then ffmpeg encodes libx264, CRF 16, yuv420p, 30 fps, no audio.

## Stills (6K)

```bash
npx remotion still UnderwaterRays-DeepBlue out/UnderwaterRays_DeepBlue_6k.png --frame=300 --scale=1.5625 --gl=angle
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375, so `--scale=1.5625` gives 6000×3375. Swap in any
composition ID. (6K stills were not rendered here.)

## Adding a water colourway (one data row)

Add a row to `WATER_PALETTES` in `src/water/palettes.ts`:

```ts
Emerald: { deep: "#03261F", mid: "#0B5E4A", top: "#7FE0B8", rays: "#F0FFF4", rayGain: 1.15, sun: "#FAFFF6", bubble: "#ECFFF6" },
```

`Root.tsx` registers `UnderwaterBubbles-Emerald` and `UnderwaterRays-Emerald` automatically. Nothing
else changes.

## How it is built

- **Determinism.** The only clock is `frame % 600`, through `θ = 2π·(frame % 600)/600`.
  - All randomness is `mulberry32`, seeded at module level.
  - Bubbles, specks and strips are seeded records. Their positions are pure functions of
    `age = (frame − birth) mod 600`.
  - There is no `Math.random`, no `Date.now`, no `useFrame` clock, no ticker, no state carried
    between frames, and no TAA.
  - PixiJS is rendered manually once per Remotion frame. three.js is drawn manually in a layout
    effect; R3F only provides the GL context.
  - Fonts, sprite atlases and textures are built once, behind `delayRender`.
- **Loops.**
  - Every time term is `sin/cos(k·θ)` with integer `k`. The water caustic uses integer
    multiples of θ.
  - Data Space flies exactly one strip-layout period (40 units) per loop. The strips, specks and
    blooms repeat with that period, and the grid spacing (0.5) divides it, with every 8th line major.
  - Elements that leave or enter are fully fogged, behind the camera, or below or above the frame
    when they wrap.
- **Water kit** (`src/water/`).
  - `shaders.ts` holds the background column of light, the surface wave lines, Snell's window and
    its total-internal-reflection band, and the god-ray field. The rays are sums of ray families
    with whole-cycle sway, modulated by a loopable caustic.
  - `sprites.ts` holds the prebaked premultiplied bubble atlas. Its "emissive" rims let one
    normal blend give both the bright silver rim and the see-through occlusion.
  - `bubbles.ts` has bursts built from clumps sharing one trajectory, dense micro-bubble fizz, a
    trickle, three depth layers, and `ParticleContainer`.
  - `snow.ts` is the marine snow.
- **Banding.**
  - Gradients and rays are rendered into **half-float targets**: Pixi uses `rgba16float`, three.js
    uses `HalfFloatType` with 4× MSAA.
  - A tiled 64×64 **blue-noise** texture is generated in code (void-and-cluster). It dithers the
    water gradient, with its offset driven by `frame % 600`.
  - The final pass adds **film grain**, a fixed hash of (pixel, frame % 600): about 2% on water and
    1.5% on Data Space. It also adds **±1/255 triangular dither** before 8-bit output.

## Measured render times

All measured in this sandbox: 4 CPU cores, no GPU, ANGLE with SwiftShader software GL, headless
Chromium. A GPU machine will be much faster.

**720p** (`--scale=0.3333333333333333`). There are two numbers per composition:
- **Single frame, cold:** one `remotion still` on its own, including page load and asset build.
- **Throughput:** a full 600-frame render at `--concurrency=4`, wall time divided by 600.

| Composition | Single frame, cold | Throughput (wall per frame) | Full 600 frames |
|---|---|---|---|
| DataSpace-Slate | 2.9 s | 1.19 s | 715 s |
| UnderwaterBubbles-DeepBlue | 6.0 s | 0.53 s | 317 s |
| UnderwaterBubbles-Turquoise | 6.0 s | 0.54 s | 322 s |
| UnderwaterRays-DeepBlue | 5.0 s | 0.47 s | 282 s |
| UnderwaterRays-Turquoise | 5.3 s | 0.48 s | 286 s |

**Timed 4K frames** (scale 1, 3840×2160, one cold `remotion still` of frame 300):

| Composition | Time |
|---|---|
| UnderwaterBubbles-DeepBlue (2A) | 13.0 s |
| UnderwaterRays-DeepBlue (3A) | 12.5 s |

**4K throughput.** I also rendered 12 frames (290–301) of each look at 4K, `--concurrency=4`, and
measured wall time including browser startup:

| Composition | 12 frames | Per frame |
|---|---|---|
| DataSpace-Slate | 101 s | 8.4 s |
| UnderwaterBubbles-DeepBlue | 76 s | 6.3 s |
| UnderwaterRays-DeepBlue | 72 s | 6.0 s |

**4K estimates for a full 600-frame render on this kind of 4-core CPU-only machine.** These are
extrapolated from the 12-frame runs after subtracting about 20 s of startup. Encoding adds a few
minutes per file.

| Look | Estimate |
|---|---|
| DataSpace | about 70 min |
| Bubbles (each colourway) | about 48 min |
| Rays (each colourway) | about 44 min |
| All five | about 4 h |

On a machine with a real GPU (ANGLE over GL or Vulkan), expect roughly 5–20× faster, because these
looks are fill-rate-bound in SwiftShader.

## Verification

Every check below ran on the encoded 720p previews: H.264, CRF 16, yuv420p.

| # | Check | Result |
|---|---|---|
| 1 | ffprobe | All 5: 1280×720, h264, yuv420p, 30/1, 20.000 s, no audio stream. `--scale=0.3333333333333333` renders exactly 1280×720, so no fallback was needed. |
| 2 | Loop | All 5 rendered as 601 frames. Frame 0 and frame 600 are byte-identical PNGs. Also checked: the 599 → 0 step changes no more than a normal frame step (see note 1). |
| 3 | Determinism | All 5: frame 300 rendered alone from a cold browser is **byte-identical** to frame 300 from the full multi-threaded render. |
| 4 | Banding | See note 2. |
| 5 | Content | One contact sheet per composition (frames 0/120/240/360/480). All required features are present. |
| 6 | Motion | Frames 285–315 of each. The frame-to-frame difference is flat at 6.9–8.3 levels mean (mostly grain), with no spikes from popping. The grid and its dot mesh move rigidly with no crawl or moiré; lines finer than about 2 px fade out by design. |

**Note 1 (loop seam).** On the first pass, Data Space failed this check at 3.05 against a normal
2.2. The grid-line hash and the irregular dash pattern weren't periodic over the loop. Both are now
wrapped to the loop period, and the seam measures 2.30 against 2.24–2.26.

**Note 2 (banding).** Frames were decoded from the mp4 and profiled:
- **Water gradients:** a vertical profile down the full height (48-px column average). The largest
  step is ≤ 0.57 levels/px, and the longest run at one level is ≤ 7 px.
- **Ray edges:** a horizontal profile at y = 30%. The largest step is ≤ 2.0 levels/px, which is the
  real ray edges.
- **Data Space sky** (y = 12%): runs ≤ 8 px.
- **Contrast stretch:** a 3–8× stretch of the darkest gradients shows smooth grain and no contour
  bands. CRF 16 was enough; `-tune grain` was not needed.

### Completion checklist

- [x] 5 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] Look 1 three.js via `@remotion/three` (WebGL2); Looks 2–3 PixiJS 8 (WebGL2) with a shared water kit
- [x] One data row per water version (`src/water/palettes.ts`)
- [x] JetBrains Mono (OFL) only for the Data Space text; no other text
- [x] Seeded `mulberry32` at module level; no `Math.random`, `Date.now`, `useFrame` clock or ticker
- [x] Half-float render targets, blue-noise gradient dither, grain plus ±1/255 final dither
- [x] 2A: about 12k bubble sprites alive at frame 300 (12,194), using `ParticleContainer`
- [x] 720p previews and stills for all 5; verify steps 1–6 pass

**Not met, as agreed with the client:** the 2A realism gate. After 6 rounds, a blind reviewer still
judged 2A as CG, a polished stock-style look. 2A was accepted as is.

## Licences

JetBrains Mono (`public/fonts/JetBrainsMono-Regular.woff2`) is © The JetBrains Mono Project Authors
and licensed under the SIL Open Font License 1.1. See `public/fonts/OFL.txt`.
