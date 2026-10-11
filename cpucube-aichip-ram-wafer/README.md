# CPU Cube · AI Hologram Chip · RAM Macro · Silicon Wafer

One Remotion project, four three.js looks, eight compositions. Every composition is
a **20 s seamless loop** (600 frames at 30 fps), defined at **3840×2160**.

| Composition id | Look | Reference |
|---|---|---|
| `CPUCube-Blue` | 1A, a CPU cube on a glowing board, blue | `4179143245` |
| `CPUCube-Amber` | 1B, amber traces, cyan sparks, copper die | — |
| `AIHologramChip-Teal` | 2A, wireframe hologram chip, teal | `4106549693` |
| `AIHologramChip-Violet` | 2B, violet | — |
| `RAMMacro-GreenBlue` | 3A, memory-module macro, green and blue light | `3987353183` |
| `RAMMacro-MagentaOrange` | 3B, magenta and orange light | — |
| `SiliconWafer-SilverPrism` | 4A, silver wafer, patchy diffraction | `4120896537` |
| `SiliconWafer-VioletGrating` | 4B, violet wafer, diagonal bands, curved rim | `1074937472` |

`dev/Dev-RAMCheck-Module` and `dev/Dev-RAMCheck-Row` are one-frame stills used for the
RAM model check. They are not deliverables.

## Setup

```bash
npm install
npx remotion studio          # preview (the studio caps the GL resolution at half size)
```

Node 18+ is needed. Versions are pinned in `package.json`: Remotion 4.0.515, three 0.186.1,
@react-three/fiber 9.8.1.

### Chromium GL flag

All looks are **WebGL2** through `@remotion/three`. Headless Chromium needs ANGLE:

```
--gl=angle
```

`remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("angle")`, so the CLI commands
below already use it. When calling the Node APIs, pass `chromiumOptions: { gl: "angle" }`
(see `tools/stills.mjs`). On a machine with a GPU, ANGLE uses it. Without one (CI,
containers) Chromium falls back to SwiftShader, which is slow but gives the same image.

## Rendering

### 4K, per composition (H.264, yuv420p, CRF 16)

```bash
npx remotion render src/index.ts CPUCube-Blue               out/CPUCube_Blue.mp4               --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts CPUCube-Amber              out/CPUCube_Amber.mp4              --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts AIHologramChip-Teal        out/AIHologramChip_Teal.mp4        --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts AIHologramChip-Violet      out/AIHologramChip_Violet.mp4      --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts RAMMacro-GreenBlue         out/RAMMacro_GreenBlue.mp4         --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts RAMMacro-MagentaOrange     out/RAMMacro_MagentaOrange.mp4     --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts SiliconWafer-SilverPrism   out/SiliconWafer_SilverPrism.mp4   --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render src/index.ts SiliconWafer-VioletGrating out/SiliconWafer_VioletGrating.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
```

On a GPU machine raise `--concurrency`. With SwiftShader one tab already uses every core,
so `--concurrency=1` or `2` is fastest.

### 6K stills (6000×3375)

```bash
npx remotion still src/index.ts CPUCube-Blue out/CPUCube_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

The same command works for any composition id. `--scale` scales the GL drawing buffer,
so the still is rendered natively at 6000×3375, not upscaled.

### 720p previews

```bash
bash tools/render-previews.sh            # all 8, or pass composition ids
```

This renders all 600 frames as a PNG sequence with
`npx remotion render … --sequence --image-format=png --scale=0.3333333333333333 --concurrency=2`
(1280×720 exactly), then encodes H.264 / yuv420p / 30 fps / CRF 16 with ffmpeg. The
frames stay in `renders/frames/<id>/` for the determinism check.

## How it is built

- `src/lib/LookCanvas.tsx` is a `ThreeCanvas` whose only `useFrame` (priority 1) takes over
  rendering. It reads the Remotion frame (`useCurrentFrame()`) and calls
  `look.update(frame)` and then the post pipeline. R3F's clock is never read.
- `src/lib/post.ts` is the shared post pipeline. Every pass is single-frame: no history
  and no TAA.
  - The scene renders into a 4× MSAA RGBA16F target with a depth texture.
  - **DoF** is a gather pass at half resolution: prefilter with a Karis-weighted
    downsample and signed CoC, then a fixed 72-tap golden-angle spiral gathered
    scatter-as-gather style, then a full-resolution composite by CoC.
  - **Bloom** is a deterministic mip chain: 13-tap downsamples and tent upsamples.
    Accumulation starts at the level nearest 360 px tall, so the glow radius is the same
    fraction of the frame at 720p, 4K or 6K.
  - The **final pass** applies exposure, ACES, saturation, vignette, sRGB, grain and
    ±1/255 triangular dither. Grain and dither are a PCG hash of (pixel, `frame % 600`).
  - All sizes (CoC, line widths, point sizes) are fractions of the frame height.
- `src/lib/loop.ts` provides `phase()`, `wave()` and `cwave()`. Every motion is a whole
  number of cycles over 600 frames.
- `src/lib/random.ts` is a seeded mulberry32. Every layout (PCB routing, hologram parts,
  filler code, RAM SMD layout, die floorplans, pulse schedules) is seeded and built once.
- Fonts are OFL files in `public/fonts`, with their licences next to them:
  - Blinker ExtraBold, for the "AI" label;
  - JetBrains Mono, for the filler code and binary.

  They load through `FontFace` behind `delayRender`.

### Looks

1. **CPU Cube** (`looks/cpuCube.ts`, `looks/pcb.ts`).
   - **Board.** Grid-routed PCB traces with 45° bends: a radial fan from the cube's
     footprint plus bus-bundled routing everywhere. It is drawn once in Canvas 2D into two
     planes: a wide 32-unit board and a detailed 6.4-unit centre. Each plane has a base,
     bump and emissive map.
   - **Pulses.** 3,000 instanced additive streaks run outward along the trace polylines.
     Each makes 1–3 whole trips per loop, and 6% use the accent colour.
   - **Cube.** Die faces with a pin grid, a gold-bronze die and a silver core, plus
     emissive edges and a gull-wing pin fringe.
   - **Camera.** A closed orbit: yaw ±35°, pitch 50°↔25°, and a slight push.
2. **AI Hologram Chip** (`looks/aiChip.ts`).
   - **Linework.** All geometry is additive `LineSegments2` (about 2 px at 4K, dimmed
     rather than thinned below 1 px), plus faint additive fills.
   - **Chip.** A bevelled package with 40 gull-wing pins per side, die traces, and the
     "AI" label (Blinker ExtraBold with a canvas halo).
   - **Board.** About 60 component outlines (boxes, stacked-circle capacitors, SMD pad
     rows, a finned connector strip, heat-sink fins) and traces from the pins.
   - **Arrow markers.** 20 cone markers bobbing in whole cycles.
   - **Data streaks.** 80 screen-vertical streaks rising in whole trips.
   - **Code layer.** Two planes of invented filler code and binary columns, scrolling by
     whole texture periods.
   - **Depth.** An invisible board-plane depth proxy, so the gather DoF has depth to work
     with.
3. **RAM Macro** (`looks/ramMacro.ts`). World units are millimetres.
   - **Modules.** Six 133×31 mm modules on 9 mm slot pitch, in black slot housings.
     - Each module has 8 satin-black chips per side with no markings except a pin-1 dot,
       and gull-wing pins on their long edges.
     - The board carries gold edge fingers with a key notch, latch notches, an SPD
       EEPROM, and decoupling caps and termination resistors (all instanced).
   - **Lighting.** Two coloured `RectAreaLight`s plus a broad glow light, all drifting in
     whole cycles. A height-based occlusion term keeps the gaps between modules dark.
   - **Loop.** Everything visible is periodic along the module with the chip pitch P. The
     module group slides exactly P per loop (`P · phase`), so frame 600 equals frame 0
     exactly.
   - **Camera.** It looks down across the bank. The rack focus is a 2-cycle sine between
     the chips of neighbouring modules.
4. **Silicon Wafer** (`looks/wafer.ts`).
   - **Die bake.** A seeded floorplan is baked into four 4096² die tiles:
     - albedo;
     - grating: line direction as a doubled angle (so mipmaps average orientations
       correctly) plus pitch, 0.5–2 µm;
     - mask: height, grating strength and metal;
     - normal.
   - **Diffraction.** The shader computes S = V + L. The along-line lobe is exp(−(S·ℓ)²/w²).
     For orders m = 1…4, λₘ = d·|S·g|/m maps through a smooth spectral fit (Zucconi), and a
     faint zeroth-order sheen fills the specular zone.
   - **4A, Silver Prism.**
     - Grating directions vary per block, and each die gets a random 90° rotation or mirror.
     - A second, broad source makes the specular flare.
     - The camera travels exactly (3, 2) die tiles per loop, applied to the texture domain.
   - **4B, Violet Grating.**
     - The grating is aligned across the wafer with one pitch, and a close, low light makes
       the broad diagonal bands.
     - The wafer is a disc. The camera runs a closed, eased path outside the rim, looking
       in, so the curved edge shows at times.
   - **Light.** It orbits once per loop.

## Measured render times

<!-- TIMINGS -->

## Checks (completion checklist)

<!-- CHECKS -->

## Banding check

<!-- BANDING -->

## Adding a colourway

Every version is one row in `src/versions.ts`:

```ts
v<CpuCubeParams>("CPUCube-Green", cpuCube, { edge: "#5AFFB0", trace: "#2AE88A", accent: "#FF6A5A", die: "#B8803A", core: "#E8ECF0" }),
```

1. Add the row. The id becomes the composition id, and `tools/render-previews.sh` maps
   the first `-` to `_` for the file name.
2. Add the id to `tools/all.txt` if the scripts should include it.
3. Run `bash tools/loopcheck.sh <id>`. Frame 600 must be IDENTICAL to frame 0.

Each look's parameters are typed: `CpuCubeParams`, `AiChipParams`, `RamParams`,
`WaferParams`. Colours are sRGB hex. Wafer rows also set the die count across the frame,
the grating mode, whether the edge shows, the lens and the scribe-line brightness.

## Tools

- `tools/stills.mjs <id> <outDir> <scale> <frames> [--loopcheck]` renders chosen frames
  with one bundle and one browser.
- `tools/loopcheck.sh <ids…>` uses 601-frame compositions with unwrapped time
  (`REMOTION_NO_WRAP=1`: neither the frame nor `phase()` is wrapped) and compares frame 600
  with frame 0 pixel by pixel.
- `tools/compare.py a.png b.png` reports IDENTICAL or the max difference and the number
  of differing pixels.
