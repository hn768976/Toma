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

MEASUREMENTS

## Verification

VERIFICATION

## Licences

JetBrains Mono (`public/fonts/JetBrainsMono-Regular.woff2`) is © The JetBrains Mono Project Authors
and licensed under the SIL Open Font License 1.1. See `public/fonts/OFL.txt`.
