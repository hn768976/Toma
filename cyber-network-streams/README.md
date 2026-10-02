# Cyber Network Streams — Remotion project

Six looks, nine compositions, one Remotion project. Every composition is
defined at **3840×2160, 30 fps**.

| # | Look | Composition ID(s) | Engine | Frames | Loop |
|---|------|-------------------|--------|--------|------|
| 1 | Cyber Flythrough | `CyberFlythrough` | three.js via `@remotion/three` + Canvas 2D panel atlas | 600 | yes |
| 2 | Network Hub | `NetworkHub-DarkBlue`, `NetworkHub-Light` | three.js via `@remotion/three` | 360 | no |
| 3 | Light Streams | `LightStreams-Blue`, `LightStreams-Amber` | three.js via `@remotion/three` | 600 | yes |
| 4 | Data Burst | `DataBurst` | PixiJS 8 (WebGL2), 3D projected in JS | 450 | no |
| 5 | Fibre Strands | `FibreStrands-Blue`, `FibreStrands-Gold` | PixiJS 8 (WebGL2), 3D projected in JS | 600 | yes |
| 6 | Big Data HUD | `BigDataHUD` | SVG/HTML + Canvas 2D (dense bar charts) | 600 | yes |

Composition IDs use `-` because Remotion IDs can't contain `_`. The preview
files use the names from the brief (`NetworkHub_DarkBlue.mp4` and so on). See
`scripts/render-previews.sh` for the mapping.

## Pinned versions

| Package | Version |
|---|---|
| remotion, @remotion/cli, @remotion/three | 4.0.515 |
| three / @types/three | 0.180.0 |
| @react-three/fiber | 9.4.0 |
| pixi.js | 8.14.0 |
| react / react-dom | 19.2.3 |
| typescript | 5.9.3 |
| @fontsource/inter, @fontsource/jetbrains-mono (source of the shipped woff2 files) | 5.2.8 |

All versions are exact (no `^`/`~`) in `package.json`, and `package-lock.json` is included.

## Setup

```bash
npm install
npx remotion studio          # opens the Studio; every composition is listed
```

### Chromium GL flag (required for looks 1–5)

Looks 1–5 need WebGL2. Headless Chromium has to be started with ANGLE:

```bash
--gl=angle
```

`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("angle")`, so
the CLI commands below pick it up automatically. The flag is also passed
explicitly in the commands so they work with the Node APIs. WebGPU is not used.

## 4K render commands

Each command writes a 3840×2160 H.264 file (yuv420p, CRF 16, PNG intermediates):

```bash
npx remotion render CyberFlythrough      out/CyberFlythrough.mp4      --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png
npx remotion render NetworkHub-DarkBlue  out/NetworkHub_DarkBlue.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png
npx remotion render NetworkHub-Light     out/NetworkHub_Light.mp4     --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png
npx remotion render LightStreams-Blue    out/LightStreams_Blue.mp4    --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png
npx remotion render LightStreams-Amber   out/LightStreams_Amber.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png
npx remotion render DataBurst            out/DataBurst.mp4            --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png
npx remotion render FibreStrands-Blue    out/FibreStrands_Blue.mp4    --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png
npx remotion render FibreStrands-Gold    out/FibreStrands_Gold.mp4    --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png
npx remotion render BigDataHUD           out/BigDataHUD.mp4           --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png
```

On a machine with a real GPU you can add `--concurrency=<n>`. With a software
GL (SwiftShader), 1–2 is fastest, because each tab already uses several threads.

720p previews (what was delivered): `scripts/render-previews.sh [ids…]`. It renders a PNG
sequence at `--scale=0.3333333333333333`, which Remotion gives as exactly 1280×720,
then encodes it with ffmpeg (`libx264 -crf 16 -pix_fmt yuv420p -r 30 -an`).

## Stills (6000×3375)

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375, so:

```bash
npx remotion still CyberFlythrough out/CyberFlythrough_6K.png --frame=300 --scale=1.5625 --gl=angle --image-format=png
```

Use any composition ID and frame. Every element is drawn from the frame size (point
sizes, line widths, canvas resolutions, SVG), so it stays sharp at any scale.

## Measured render times

RENDER_TIMES_PLACEHOLDER

## Determinism

Remotion renders frames out of order and across tabs. Every value here is a
function of `useCurrentFrame()` and data that is seeded once at module level:

- Seeded `mulberry32` at module level only. No `Math.random()` anywhere, and no
  `Date.now()`, `useFrame` clock, CSS animations or transitions.
- Nothing is simulated step by step. The Data Burst camera is a fixed
  monotone-cubic spline of the frame. The burst, network, warp and chip use
  closed-form functions of the frame.
- Pixi: `autoStart: false`, ticker stopped, exactly one `app.render()` per Remotion
  frame. Every per-frame object is reset at the start of each update.
- three.js: R3F's `frameloop` is `never` during rendering. A priority-1 `useFrame`
  callback reads only the Remotion frame and renders through the post pipeline.
  No TAA, no temporal AO, no accumulation.
- Canvas 2D textures and charts are redrawn from the frame each time, never
  incrementally. The Cyber Flythrough atlas is redrawn whenever `floor(frame/12)`
  changes.
- Fonts, the Natural Earth data, textures and the Pixi initialisation all sit behind
  `delayRender` / `continueRender`.
- Grain and dither come from an integer PCG hash of pixel position and the frame. For
  loops the frame used is `frame % 600`.

**Loops.** Every looping look uses `t = (frame % 600) / 600`. Camera travel is
exactly N·L, with block length L:

| Look | L | N |
|---|---|---|
| Cyber Flythrough | 96 | 2 |
| Light Streams | 120 | 4 |

Widget values change on whole-number cycles. Fibre Strands samples its spine noise
on a circle in time (cos 2πt, sin 2πt), and its heads travel whole laps. HUD
counters step through a fixed 40-entry sequence that wraps. Pass
`--props='{"loopCheck":true}'` to make the looping compositions 601 frames long,
so frame 600 can be rendered and compared with frame 0.

## Banding

- Looks 1–3 render into a HalfFloat MSAA target. Bloom is a half-float mip chain.
  The composite tone-maps, converts to sRGB, then adds TPDF dither (±1/255) and
  about 2% grain (a fixed hash of pixel and frame) **after** bloom.
- Looks 4–5 render into a real RGBA16F target. **Note:** Pixi 8 allocates every
  `RenderTexture` as RGBA8, whatever `format` says (see
  `GlTextureSystem.onSourceUpdate`). That 8-bit path banded the wide glows, so
  `src/lib/pixi/floatTarget.ts` uses a buffer-backed `BufferImageSource`, which
  goes through the uploader that honours `rgba16float`. Pixi's `BlurFilter` also
  bounces through pooled 8-bit textures, so bloom is done by
  `src/lib/pixi/FloatBlur.ts` (RT→RT meshes). Wide soft glows are analytic
  (`GlowBatch`), not 8-bit gradient textures. Dither and grain are applied in the
  final composite `Filter` (with a `uFrame` uniform), which is the only pass that
  writes 8-bit.
- Look 5 (Fibre Strands) has no grain. Dither is gated to areas with signal, and
  near-zero output is forced to exactly 0,0,0.
- Look 6 is flat UI on black, with no grain or dither.

BANDING_RESULTS_PLACEHOLDER

## Fibre Strands blending

Fibre Strands is rendered on pure black (0,0,0) so it can be used as an overlay.
Put it over other footage with **Screen** or **Add (Linear Dodge)**. The black
disappears and only the glowing fibres remain.

## How to add a version

Each version is one data row in `src/versions.ts`. `src/Root.tsx` registers one
composition per row. For example, a green Light Streams:

```ts
export const lightStreamsVersions: LightStreamsVersion[] = [
  { id: "LightStreams-Blue", panel: "#2A6AFF", panelBright: "#4FD8FF", bg: "#020818" },
  { id: "LightStreams-Amber", panel: "#FF8A2A", panelBright: "#FFD27A", bg: "#120602" },
  { id: "LightStreams-Green", panel: "#1FCF6A", panelBright: "#9CFFB8", bg: "#02100A" }, // new
];
```

Every look has its own row type: `CyberFlythroughVersion`, `NetworkHubVersion` (with
`theme: "dark" | "light"`), `LightStreamsVersion`, `DataBurstVersion`,
`FibreStrandsVersion` and `BigDataHudVersion` (an 8-colour palette).

## Assets and licences

- **Fonts:** Inter (300/400/500/600/700) and JetBrains Mono (400/500/700), both SIL
  Open Font License 1.1. The woff2 files and licence texts are in `public/fonts/`
  (`OFL-Inter.txt`, `OFL-JetBrainsMono.txt`). They are loaded with
  `FontFace` + `delayRender` (`src/lib/fonts.ts`).
- **Map data:** Natural Earth 1:110m land (public domain), in
  `public/data/ne_110m_land.geojson` with `LICENSE-NaturalEarth.txt`.
- **Icons:** self-drawn SVG path data in `src/lib/icons.ts`, used inline in the HUD
  and through `Path2D` in the canvas atlases. No icon libraries, logos or brands. All
  numbers and labels are made up.

## Project layout

```
src/
  Root.tsx, versions.ts
  lib/
    random.ts, noise.ts, fonts.ts, icons.ts
    three/ (ThreeStage, post (HDR bloom/dither/grain), util)
    pixi/  (PixiStage, floatTarget, FloatBlur, LineBatch, StripBatch, GlowBatch, projector)
  looks/
    cyber-flythrough/  network-hub/  light-streams/  data-burst/  fibre-strands/  big-data-hud/
scripts/render-previews.sh
```

## Completion checklist

CHECKLIST_PLACEHOLDER
