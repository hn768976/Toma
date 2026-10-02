# Neural Layers · Dust & Smoke · Data Panels · Night Sky Meteor · Icon Network

One Remotion project, 8 compositions, all defined at **3840×2160, 30 fps**.

| Composition ID | Look | Engine | Frames |
|---|---|---|---|
| `NeuralLayers-IceBlue` | 1A Neural Layers, ice blue | three.js via `@remotion/three` | 600 (20 s loop) |
| `NeuralLayers-Violet` | 1B Neural Layers, violet + magenta pulses | three.js | 600 (loop) |
| `DustSmoke-Sepia` | 2A Sepia dust | PixiJS 8 (WebGL2) | 600 (loop) |
| `DustSmoke-Teal` | 2B Teal dust + smoke | PixiJS 8 | 600 (loop) |
| `DustSmoke-WhiteOnBlack` | 2C White dust on pure black | PixiJS 8 | 600 (loop) |
| `DataPanels-TealRed` | 3 Data panels | three.js + Canvas 2D textures | 600 (loop) |
| `NightSkyMeteor` | 4 Night sky + meteors | Canvas 2D | 600 (loop) |
| `IconNetwork` | 5 Icon network | three.js | 450 (15 s, not a loop) |

**2C (`DustSmoke-WhiteOnBlack`) is meant for Screen / Add blending over footage.** Its background is pure
0,0,0, with no beam, no vignette, no grain and no dither, so blending it adds only the specks.

## Setup

```bash
npm install
npx remotion studio          # preview (Studio caps the canvas resolution for speed)
```

Pinned versions (`package.json`):

| Package | Version |
|---|---|
| `remotion`, `@remotion/cli`, `@remotion/three` | 4.0.532 |
| `three` | 0.186.1 |
| `@react-three/fiber` | 9.8.1 |
| `pixi.js` | 8.22.0 |
| `react`, `react-dom` | 19.2.3 |
| `typescript` | 5.9.3 |

Everything is WebGL2, not WebGPU. Headless Chromium needs the ANGLE GL backend:

```
--gl=angle
```

This is already the default via `Config.setChromiumOpenGlRenderer("angle")` in `remotion.config.ts`. On a
machine without a GPU, ANGLE falls back to SwiftShader (software). That is how the previews here were made.

## Render at 4K

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16 and PNG intermediate frames (JPEG intermediates
add blocking in dark gradients).

```bash
npx remotion render NeuralLayers-IceBlue   out/NeuralLayers_IceBlue_4K.mp4   --gl=angle
npx remotion render NeuralLayers-Violet    out/NeuralLayers_Violet_4K.mp4    --gl=angle
npx remotion render DustSmoke-Sepia        out/DustSmoke_Sepia_4K.mp4        --gl=angle
npx remotion render DustSmoke-Teal         out/DustSmoke_Teal_4K.mp4         --gl=angle
npx remotion render DustSmoke-WhiteOnBlack out/DustSmoke_WhiteOnBlack_4K.mp4 --gl=angle
npx remotion render DataPanels-TealRed     out/DataPanels_TealRed_4K.mp4     --gl=angle
npx remotion render NightSkyMeteor         out/NightSkyMeteor_4K.mp4         --gl=angle
npx remotion render IconNetwork            out/IconNetwork_4K.mp4            --gl=angle
```

720p previews (as delivered): add `--scale=0.3333333333333333`. This gives exactly 1280×720.
`scripts/render_previews.sh` renders a PNG sequence and encodes it with ffmpeg
(`-c:v libx264 -crf 16 -pix_fmt yuv420p -r 30`).

## Stills (6000×3375)

```bash
npx remotion still NeuralLayers-IceBlue out/NeuralLayers_IceBlue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Use the same command with any composition ID. `--scale=1.5625` turns 3840×2160 into 6000×3375. Every look
sizes its canvas from `devicePixelRatio`, so it draws natively at that size; nothing is upscaled.

## How each look is built

- **1 Neural Layers.** 9 columns of rounded glass node boxes (InstancedMesh, ~90 nodes) and ~2,100 bezier
  link curves.
  - Each node-to-node link is 3–5 strands.
  - All curves form one merged geometry drawn by a custom screen-space line shader with fixed pixel width.
  - Pulses travel inside the line shader with head = `fract(phase + k·frame/600)`, where `k` is a whole
    number. Node flashes are computed from the same pulse times.
  - The camera moves on a closed path. The background is a far plane with faint circuit traces and specks.
- **2 Dust & Smoke.** 200,000 specks in a `ParticleContainer`, projected to the screen in JS every frame
  (perspective divide).
  - Speck positions use a three-term divergence-free sine flow plus a per-speck wobble. Time enters only
    as `cos/sin(n·θ)` with θ = 2π·frame/600, so every path closes. The flow is precomputed per speck, so
    each frame costs no trigonometry per particle.
  - Bokeh uses an atlas of 8 discs, from a sharp dot to a big soft disc. Each speck picks a disc by its
    circle of confusion from the focus depth, and alpha drops as the disc grows.
  - There are 9 large near-camera motes and a blurred-gradient beam sprite.
  - Smoke (2B) is domain-warped fbm in a mesh shader, drawn at ¼ resolution into a render texture each
    frame. Its time input is sampled around a circle.
  - A final Pixi `Filter` computes the background in float and adds the vignette, ~2% grain and ±1/255
    dither. 2C has no final filter.
  - The ticker is stopped. Each Remotion frame does one `app.render()`; the ¼-res smoke pre-pass renders
    to a texture inside the update.
- **3 Data Panels.** 12 flat panels per tile period (L = 15 units). The camera tracks exactly one L per loop.
  - Each panel face is a Canvas 2D texture redrawn from scratch every frame.
  - Glyphs (`0`, `1` in JetBrains Mono; `○`, `●` drawn as arcs) come from a pre-drawn glyph atlas. Each
    cell flickers on its own period `k` that divides 600: `floor((frame+off)/k) mod (600/k)`.
  - Fibre bundles (20–40 strands) fan from the hero panel into the next column. They have node dots and
    whole-number pulses.
  - Ground strips of digits lead into the first column.
  - Texture size is `cells × cellPx`, where `cellPx` follows the render resolution (≈40 px per cell at
    4K) and is capped at 2048.
- **4 Night Sky Meteor.** One full-frame Canvas 2D.
  - The sky gradient is computed in float per pixel (cached per size). Every frame adds 1.5% grain and
    ±1/255 dither from an integer hash of (x, y, frame mod 600).
  - 2,550 stars (2,100 uniform plus 450 in a faint diagonal band). Twinkles use whole-number cycles over
    600 frames.
  - 3 meteors at frames 40, 250 and 470, each about 1 s long, with sparks; none crosses the loop point.
- **5 Icon Network.** About 8,000 tiles: double glass plates, each with a self-drawn SVG-path icon from a
  canvas atlas.
  - Tiles are baked into one geometry rather than instanced. SwiftShader has a large per-instance cost,
    so baking is about 5× faster in software, and on a GPU it makes no difference.
  - Houses with halftone dot rings sit on ~8% of tiles.
  - Neighbour links use the same line shader.
  - A tile's activation frame = `18 + 2.6·gridDistance + jitter` (seeded). Activated tiles turn mint
    green and get a check mark that pops in (scale from 0.9, fade in, settle).
  - Camera: close shot for frames 0–90, eased pull back and up for 90–360, slow drift for 360–450.

**Post pipeline for the three.js looks** (`src/lib/three/post.ts`):

- **Depth of field.** The frame is rendered as a sum of depth slices. Each fragment splits between two
  blur levels by its circle of confusion, using tent weights that sum to 1. Each level is blurred with a
  Gaussian and added; blurred levels are rendered directly at reduced size.
- **Bloom.** Mip-chain bloom.
- **Final pass.** Soft shoulder, vignette, then ~2% grain and ±1/255 triangular dither from an integer hash
  of pixel and frame. Dither is applied after bloom.
- **Not used.** No TAA and no temporal effects.

## Determinism

Every value comes from `useCurrentFrame()`:

- **Seeded randomness.** `mulberry32` is seeded at module level. `Math.random()` is never used.
- **No stepped simulation.** No particle is stepped from frame to frame.
- **No clocks or carried state.** No clocks, no `useState` driving visuals, nothing carried between frames.
- **three.js.** R3F's `useFrame` is used only as the render hook (priority 1), and it reads the Remotion
  frame from a ref.
- **Async setup.** Fonts, Pixi init and canvas textures sit behind `delayRender` / `continueRender`.

## Measured render times

<!-- TIMINGS -->

## Banding check

<!-- BANDING -->

## Completion checklist

<!-- CHECKLIST -->

## Adding a version (one data row)

Each look has a `versions.ts` with one row per version (`src/looks/*/versions.ts`). Add a row with a new
`id` and colours, and it appears as a new composition. Nothing else needs to change.

```ts
// src/looks/neural/versions.ts
{ id: "NeuralLayers-Amber", node: "#FFC877", link: "#FFC877", edge: "#FFF4E0", pulse: "#FFFFFF", bg: "#140E06", grid: "#2A1E0E" },
```

## Fonts and icons

JetBrains Mono and Inter are shipped in `public/fonts` under the SIL Open Font License 1.1 (licence texts
next to them) and loaded with `FontFace` behind `delayRender`. The icons are self-drawn SVG path data in
`src/looks/icons/icons.ts`. No icon libraries, logos or brands.
