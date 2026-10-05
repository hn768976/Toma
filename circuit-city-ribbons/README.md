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

## References

Reference clips go in `refs/<referenceID>.mp4`. They were used only for visual
comparison and are not part of this package.

| Look | Reference(s) |
|------|--------------|
| Holo City | `1020170812` |
| Neon Ribbons | `1077857705` |
| Circuit Chip | `3503768559` (low glide over the traces) and `1067060245` (chip with edge flare) |

The Circuit Chip brief names `1101145185`, but that clip was not supplied, so
the two clips above were used in its place.

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
npx remotion still CircuitChip-Blue out/CircuitChip_Blue_6K.png --frame=420 --scale=1.5625 --gl=angle --timeout=300000
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

Measured in this build environment: **4 vCPU, no GPU**. Chromium fell back to
SwiftShader (software WebGL via ANGLE). Times are steady-state seconds per frame
for one render worker. The method: render 6 frames and 21 frames, then take the
difference ÷ 15, so browser start-up and scene build are excluded.

| Look | 720p (measured) | 1080p (measured) | 4K (estimate) |
|------|-----------------|------------------|---------------|
| Circuit Chip | 0.94 s | 1.68 s | **≈ 5.7 s** |
| Holo City    | 3.77 s | 5.94 s | **≈ 17.6 s** |
| Neon Ribbons | 0.94 s | 1.84 s | **≈ 6.7 s** |

The 4K estimate fits time = a + b × megapixels through the 720p and 1080p
measurements and evaluates it at 8.29 MP. On the same kind of CPU-only machine
the whole 4K renders would take, with one worker:

| Look | 4K render time (estimate) |
|------|---------------------------|
| Circuit Chip, 450 frames | ≈ 43 min |
| Holo City, 600 frames | ≈ 2.9 h |
| Neon Ribbons, 600 frames | ≈ 67 min |

Software WebGL runs every tab through one GPU process, so raising
`--concurrency` helps little. Running several compositions as separate
processes does help. On a machine with a real GPU, expect these numbers to drop
by an order of magnitude or more; the output is identical.

Start-up note: Holo City builds about 427k points and compiles its shaders
before the first frame. Under software GL that can take more than Remotion's
default 30 s, so the config sets `setDelayRenderTimeoutInMilliseconds(300000)`.

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
fog, Circuit Chip haze and the flare falloff). Each region was checked twice. First, the
tones were stretched 3–8× to look for visible contour steps. Second, row-mean
profiles were read across each region. All six encoded previews are smooth: no
steps or plateaus, and the per-row noise from grain and dither is present
everywhere (row std ≈ 1.3–1.7 levels in the empty ribbon sky). The 2% grain and
±1/255 dither are applied after tonemapping, in the final pass.

## Completion checklist

| Check | CircuitChip Blue / Gold | HoloCity Green / Blue | NeonRibbons Purple / Gold |
|-------|------------------------|------------------------|---------------------------|
| 1. ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, exact duration | ✅ / ✅ (15.0 s) | ✅ / ✅ (20.0 s) | ✅ / ✅ (20.0 s) |
| 2. Loop: frame 600 == frame 0 (601-frame build), pixel for pixel | n/a (story) | ✅ / ✅ | ✅ / ✅ |
| 3. Cold-start frame 300 == full-render frame 300, byte for byte | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ |
| 4. Banding, read from the encoded mp4 | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ |
| 5. Contact sheet shows the required content | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ |
| 6. Frames 299/300/301: no pops, flicker or shimmer | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ |
| `npm install && npx remotion studio` from a clean copy | ✅ | | |

What each look's contact sheet shows:

- **Circuit Chip:** a very low view over glowing traces, with pulses running
  toward the chip and the horizon. The chip emerges, focus is pulled onto it,
  and its edges and pins flare. The chip has no markings.
- **Holo City:** dot-lattice towers with light lines, scanning rings and squares
  at the tower bases, crossing light lines, fog and depth. The camera moves
  forward between frames.
- **Neon Ribbons:** 12 curved glossy bands in the lower half. Highlights and
  magenta glints move along the bands between frames, and the upper half stays
  dark and empty.

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
