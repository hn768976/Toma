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

Measured on the delivery machine: a 4-vCPU cloud container with **no GPU**, so WebGL runs on
ANGLE → SwiftShader (software). Seconds per frame come from timing `remotion render` over N frames and over 1
frame, then dividing the difference by N−1, so browser start-up is removed. All runs used `--concurrency=1`.

| Look | 720p s/frame | 4K s/frame | Full 720p preview (wall, `--concurrency=4`) |
|---|---|---|---|
| 1 Neural Layers | 0.73 | 4.0 | 430 s / 600 frames |
| 2A Sepia dust | 0.53 | **0.64** | 303 s |
| 2B Teal dust + smoke | 0.73 | **1.59** | 405 s |
| 2C White dust on black | 0.48 | (not measured; ≈ 2A) | 246 s |
| 3 Data Panels | 0.61 | **2.76** | 346 s |
| 4 Night Sky Meteor | 0.12 | 0.87 | 47 s |
| 5 Icon Network | 1.18 | 3.8 | 577 s / 450 frames |

The bold cells are the 4K measurements the brief asks for (looks 2 and 3); the other 4K figures are extra.

**4K estimate.** This is the per-frame time × the frame count on the same GPU-less box:
- Neural 2 × 40 min
- Sepia 6 min
- Teal 16 min
- White on black 6 min
- Data Panels 28 min
- Night Sky 9 min
- Icon Network 29 min

That adds up to **about 3 hours for all 8 at 4K**. Higher `--concurrency` barely helps here, because
SwiftShader already uses every core.

On a machine with a real GPU the WebGL looks should be well over 10× faster, though I couldn't measure that
here. Two costs don't depend on the GPU: the CPU-side Canvas 2D work (the Data Panels digit textures and the
Night Sky per-pixel pass) and PNG encoding of 4K frames. Even so, the whole set should take well under an hour.

For Data Panels, redrawing the digit textures takes ~25% of the 4K frame time. Texture size follows the render
resolution (about 40 px per digit cell at 4K, capped at 2048 px). The main cost is three.js geometry and post.


## Banding check

Checked on frames decoded **from the encoded mp4s**, not the preview. For each look I read luma profiles across
the dark gradients and glows (median-filtered to step over specks and stars), and counted perfectly flat 8×8
blocks in the dark areas.

| Look | Region | Largest step between adjacent pixels | Flat 8×8 blocks |
|---|---|---|---|
| 1A Neural | dark background, top-left / bottom-right | 0.07–0.30 levels | 0% |
| 2A Sepia | glow wash, top and bottom bands | 0.45–0.8 | 0% |
| 2B Teal | haze bands | 0.7–1.0 | 0% |
| 3 Data Panels | dark ground | 0.11–0.12 | 0% |
| 4 Night Sky | sky gradient, two bands | 0.19–0.55 | 0% |

**Found and fixed.** The first encode of the three.js looks had visible 1-level plateaus in near-black areas
(only seen with contrast stretched about 10×). The grain was weighted down in the darks, so x264 smoothed it away
and the steps showed. I made the grain close to uniform (about 2% everywhere) for the three.js looks and Dust,
and re-rendered. Now grain survives encoding (std 1.20 in the mp4 vs 1.45 in the lossless frame), and no flat
blocks remain.


## Completion checklist

| # | Check | Result |
|---|---|---|
| 1 | ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, 20.0 s (Icon 15.0 s) | **Pass**, all 8 |
| 2 | Loop: frames 0 and 600 of a 601-frame render are pixel-identical (looks 1–4) | **Pass**, all 7 loops (max diff 0). Re-run after every code change. |
| 3 | 2C black: gaps between specks are 0,0,0 in the mp4 (≤ 1) | **Fails as specified.** The lossless frames are exactly 0 between specks (66.6% of pixels). In the mp4, 88–91% of those pixels decode to ≤ 1, but x264 rings around the very dense specks: about 3% of pixels in 9×9 speck-free windows read 2–11. See the note below. |
| 4 | Frame 300 cold start vs full render | **Pass**, all 8: identical pixels and identical PNG bytes |
| 5 | Banding in the encoded mp4 | **Pass**, after the grain fix above |
| 6 | Five evenly spaced frames per look show the required features | **Pass** |
| 7 | Own side-by-side check against the reference | Done |
| 8 | Fresh sub-agent comparison, 3 rounds per look | Done. Differences that remain are listed in the delivery report. |

**Note on 2C.** The background really is 0,0,0. The non-zero pixels are H.264 ringing next to point-like detail at
CRF 16 in 4:2:0. I tried `aq-mode=3`, `psy-rd=0`, `-tune grain` and their combinations, and none brings it under 1.
I also tried dropping specks too faint to see (8-bit alpha < 24), which leaves cleaner black but doesn't fix the
ringing. For a clean Screen/Add overlay, render 2C to a lossless or 4:4:4 format, e.g.
`--codec=prores --prores-profile=4444`.


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
