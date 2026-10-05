# Circuit Chip · Holo City · Neon Ribbons

Three looks, six compositions, one Remotion project. Built entirely in code
(three.js shaders inside `@remotion/three`, WebGL2). No text, logos or markings.

| Composition id        | Look         | Version            | Frames | Length |
|-----------------------|--------------|--------------------|--------|--------|
| `CircuitChip-Blue`    | Circuit Chip | 1A Blue            | 450    | 15 s story |
| `CircuitChip-Gold`    | Circuit Chip | 1B Gold            | 450    | 15 s story |
| `HoloCity-Green`      | Holo City    | 2A Green           | 600    | 20 s loop |
| `HoloCity-Blue`       | Holo City    | 2B Blue            | 600    | 20 s loop |
| `NeonRibbons-Purple`  | Neon Ribbons | 3A Neon Purple     | 600    | 20 s loop |
| `NeonRibbons-Gold`    | Neon Ribbons | 3B Sunset Gold     | 600    | 20 s loop |

All compositions are 3840×2160, 30 fps. (Remotion ids cannot contain `_`, so the
ids use `-`; the preview files use `_`, e.g. `CircuitChip_Blue.mp4`.)

## Setup

```bash
npm install
npx remotion studio      # preview (draws at 720p for interactivity)
```

Node 18+ (tested on Node 22). All dependency versions are pinned in `package.json`.

### Chromium GL flag

WebGL2 in headless Chromium needs ANGLE. It is set in `remotion.config.ts`:

```ts
Config.setChromiumOpenGlRenderer("angle");   // == --gl=angle
```

When using the Node APIs instead of the CLI, pass `chromiumOptions: { gl: "angle" }`.
On a machine without a GPU Chromium falls back to SwiftShader (software); output
is the same, only slower.

## 4K renders (one per composition)

```bash
npx remotion render CircuitChip-Blue   out/CircuitChip_Blue.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render CircuitChip-Gold   out/CircuitChip_Gold.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render HoloCity-Green     out/HoloCity_Green.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render HoloCity-Blue      out/HoloCity_Blue.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render NeonRibbons-Purple out/NeonRibbons_Purple.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render NeonRibbons-Gold   out/NeonRibbons_Gold.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

(The codec/CRF/pixel-format/GL flags are also the defaults in `remotion.config.ts`;
they are repeated here so the commands work with any config.) For a mastering
copy use `--codec=prores --prores-profile=4444`.

## 6K stills (6000×3375)

`--scale=1.5625` turns 3840×2160 into 6000×3375. The canvas draws at the real
output size, so a 6K still is rendered natively, not upscaled.

```bash
npx remotion still CircuitChip-Blue out/CircuitChip_Blue_6K.png --frame=420 --scale=1.5625 --gl=angle
npx remotion still HoloCity-Green   out/HoloCity_Green_6K.png   --frame=300 --scale=1.5625 --gl=angle
npx remotion still NeonRibbons-Purple out/NeonRibbons_Purple_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(Same pattern for the other ids.)

## 720p previews

```bash
scripts/render-preview.sh <CompositionId> [concurrency]
```

renders a lossless PNG sequence with `--scale=0.3333333333333333` (exactly
1280×720) and encodes it with ffmpeg: H.264, `yuv420p`, CRF 16, 30 fps, no audio.
The PNG frames are kept in `out/frames/` for the determinism and banding checks.

## Render time

RENDER_TIME_TABLE

## How it is built

- `src/lib/GLStage.tsx` – wraps `<ThreeCanvas>`. The **only time source is
  `useCurrentFrame()`**; R3F's `useFrame` is used purely as the "draw now" hook
  (its clock is ignored). The canvas draws at composition size × `--scale`.
- `src/lib/post.ts` – shared post chain: MSAA half-float scene target →
  optional depth of field (circle of confusion in alpha, quarter-res gather) →
  resolution-independent bloom → exposure, ACES, sRGB, vignette, **grain** (a
  fixed hash of pixel position and `frame % 600`) and **±1/255 triangular
  dither** after tonemapping.
- `src/lib/random.ts` – `mulberry32`, seeded at module level. No `Math.random()`.
- `src/looks/circuit/` – `board.ts` is a seeded PCB router (occupancy grid,
  parallel buses, 45° bends, staggered ring pads/vias, chip fan-out, small
  components). `CircuitChip.tsx` extrudes bevelled traces, builds the chip
  (dark top, thin metal rim, pins, no markings), and runs pulses in the trace
  shader along an "along-the-trace" coordinate oriented toward the chip.
  Timeline: glide 0–9 s, focus pull 9–11 s, converge + edge flare 11–13 s, hold.
- `src/looks/holocity/` – `city.ts` generates one 80-unit city tile (~427k points
  in one `Points` buffer, ~20k instanced thick lines). The camera stays at z=0
  and the tile scrolls by exactly one tile length per 600 frames; towers wrap
  whole by their anchor inside fog. Rings, flickers (20-frame slots) and light
  lines all complete whole cycles per loop. Points are anti-aliased in the
  fragment shader (sub-pixel centre, energy-conserving size) so they do not
  shimmer; DoF is done per point (size grows, energy is conserved).
- `src/looks/ribbons/` – one full-screen fragment shader: 12 bands on one
  curve family; highlights, magenta glints, colour drift and undulation are all
  whole-number cycles of `u = (frame % 600) / 600`.

## Determinism

- No `Math.random()`, `Date.now()`, CSS animation, `useState`-driven visuals,
  or values carried between frames; no TAA / temporal effects.
- Every render target is fully overwritten each frame.
- Checked: frame 300 rendered alone from a cold start is byte-identical to
  frame 300 of the full render, for every composition (see checklist).

## Banding check

Frames were extracted **from the encoded mp4s** and pixel rows/columns were read
across the dark gradients and glow falloffs (sky above the ribbons, Holo City
fog, Circuit Chip haze and the flare falloff). BANDING_RESULT

## Completion checklist

CHECKLIST

## Adding a colourway

1. Add a row to the matching array in `src/versions.ts`, e.g.

   ```ts
   { id: "HoloCity-Red", point: "#FF4A3A", accent: "#FF9A7A", glass: "#3A0A0A", floor: "#0A0202", fog: "#140404" },
   ```

   (hex values are sRGB; shaders convert to linear.)
2. That's it: `Root.tsx` maps every row to a `<Composition>` with the row's `id`.
3. Render it with the commands above using the new id.

Each look's row type documents the fields (`CircuitVersion`, `HoloVersion`,
`RibbonsVersion`).
