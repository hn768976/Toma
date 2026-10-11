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

All times were measured in this build's container: a 4-core cloud VM with **no GPU**, so
Chromium ran WebGL2 on **SwiftShader** (CPU). A desktop GPU through ANGLE is much faster.

**720p previews.** Each is a full render of all 600 frames, as a PNG sequence with
`--scale=0.3333333333333333 --concurrency=2`. The time includes bundling, browser start and
texture builds (about 15–20 s).

| Composition | Render (600 f) | Per frame at 720p |
|---|---|---|
| CPUCube-Blue | 712 s | **1.19 s** |
| CPUCube-Amber | 672 s | **1.12 s** |
| AIHologramChip-Teal | 523 s | **0.87 s** |
| AIHologramChip-Violet | 507 s | **0.85 s** |
| RAMMacro-GreenBlue | 1965 s | **3.28 s** |
| RAMMacro-MagentaOrange | 2015 s | **3.36 s** |
| SiliconWafer-SilverPrism | 622 s | **1.04 s** |
| SiliconWafer-VioletGrating | 598 s | **1.00 s** |

The H.264 encode took 32–50 s per file.

**Two real 4K frames (3840×2160).** These are frames 298–301 rendered as a sequence, timed
between consecutive frames, so tab and texture setup is excluded:

| Composition | Per 4K frame (SwiftShader) |
|---|---|
| RAMMacro-GreenBlue (3A: three area lights, very wide DoF) | **24.4 s** (25.2 / 24.8 / 23.6) |
| SiliconWafer-VioletGrating (4B: diffraction shader and DoF) | **8.1 s** (8.0 / 7.9 / 8.3) |

The measured 4K/720p ratio is 7.4× for 3A and 8.1× for 4B; 4K has 9× the pixels.

**4K estimates for 600 frames.** The SwiftShader figures here use about 7.5–8× the 720p
time per frame:

| Composition | Here (SwiftShader, 4 cores) | Desktop GPU (estimate) |
|---|---|---|
| CPU Cube (×2) | ≈ 9 s/frame → ≈ 1.5 h each | ≈ 0.3–0.6 s/frame → 3–6 min |
| AI Hologram Chip (×2) | ≈ 6.5 s/frame → ≈ 1.1 h each | ≈ 0.2–0.4 s/frame → 2–4 min |
| RAM Macro (×2) | ≈ 24 s/frame → ≈ 4 h each | ≈ 0.6–1.2 s/frame → 6–12 min |
| Silicon Wafer (×2) | ≈ 8 s/frame → ≈ 1.35 h each | ≈ 0.3–0.5 s/frame → 3–5 min |

The GPU column is an **estimate, not a measurement**: no GPU was available here. Expect it
to be dominated by the 72-tap DoF gather and 4× MSAA at 4K, plus Chromium's screenshot
readback (about 0.1–0.2 s per 4K frame). All eight at 4K on SwiftShader would take
roughly 16–17 h. On a GPU, expect well under an hour.


## Checks (completion checklist)

Every item below was run on the delivered 720p renders.

- [x] **File checks** (ffprobe), all 8: `h264`, `1280×720`, `30/1`, `yuv420p`, duration
  `20.000000`, and one video stream with **no audio**.
- [x] **Loop**, all 8. The compositions were made 601 frames long with **unwrapped**
  time (`REMOTION_NO_WRAP=1`: neither the frame nor `phase()` is wrapped), and frame 600
  is **IDENTICAL** to frame 0 pixel for pixel.
  - The first run caught RAM and wafer 4A differing by float-rounding noise, because they
    translated by exactly one period in world space. Both now apply the travel as
    `period × phase`, which is exactly 0 at the loop point.
- [x] **Same result every time**, all 8. Frame 300 rendered alone from a cold start is
  **byte-identical** (`cmp`) to frame 300 of the full out-of-order render (2 tabs).
  - The first run failed on both hologram versions (1 code value in 4–5 pixels).
  - The cause was a near-tie in three.js's transparent depth sort (die mask vs data
    streaks), which resolved differently after a long run of frames.
  - The fix was an explicit `renderOrder` for every transparent layer, plus a uv clamp
    on the sub-pixel streak quads. Both versions were re-rendered and re-checked.
- [x] **Banding**: see below.
- [x] **Contact sheets** (frames 0, 120, 240, 360, 480), checked for every composition.
- [x] **Motion smoothness**, frames 270–330 from the full PNG sequences.
  - Frame-to-frame mean differences are even: max/mean is 1.01–1.09, with no spikes and no
    alternation, for all but 4B.
  - 4B shows a smooth V that bottoms out at frame 300, where the eased out-and-back camera
    path turns around. That is intended easing, not judder.
- [x] **RAM model check**: three rounds with a fresh sub-agent each time.
- [x] **Reference comparison by separate agents**: three rounds per reference look.
- [x] **Determinism rules.**
  - No `Math.random()` anywhere, no `Date.now()`, and no R3F clock.
  - No state carried between frames; `look.update(frame)` sets everything from the frame.
  - Seeded mulberry32 for every layout.
  - Fonts and textures are built or loaded once, behind `delayRender`.
- [x] **No logos, brands or part numbers.**
  - Chips, modules and wafers carry only pin-1 dots, pads and generic structure.
  - The only text is "AI" and invented filler code: made-up identifiers such as
    `lattice`, `qmix` and `tensor_fold`.
- [x] **Fonts are OFL only**: Blinker ExtraBold and JetBrains Mono, with their licences in
  `public/fonts/`.

## Banding check

Profiles were read from frame 300 (frame 0 for the CPU bokeh) **decoded from the
encoded mp4s**, using `tools/banding.py`. That tool averages a 9-px strip, reports
16-px block means, and reports the longest run where luma stays exactly flat.

| Area | Result |
|---|---|
| Hologram 2A background (left haze, top to bottom) | 54.6 → 37.9 in steps of about 1 code per 16 px. Longest flat run 3 px. |
| Hologram 2B background | 18.9 → 11.3, smooth. Longest flat run 3 px. |
| RAM deep-blue shadow | 155 → 117 → 97 → 83 → 72 → 64 → 58 → 53 → 50 → 48, smooth. Longest flat run 3 px. |
| Wafer 4B rainbow band and the rim falling to black | Bands vary smoothly. The black side falls 12.7 → 8.3 → 5.0 → 3.4 → 3.0 → 2.7 → 2.2 → 1.9. Longest flat run 4 px. |
| Wafer 4A flare gradient | 104 → 237, irregular from die structure. Longest flat run 2 px. |
| CPU board bokeh (blurred far board, frame 0) | Longest flat run 2–5 px. |

There are no plateau-and-step patterns anywhere, so the ±1/255 dither and the 1.5% or 2%
grain hold up through H.264 at CRF 16. The grain did not need raising.

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
