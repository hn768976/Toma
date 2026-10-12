# Plexus Shells · LED Cube Wall · Glass Cube Field · Fibre Layers · Chip Cloud

Five 3D looks as eight 20-second seamless loops (600 frames at 30fps), defined at
3840×2160. Everything is built in code with **three.js on WebGL2**
(`@remotion/three`). There are no image assets, no text and no logos.

| Composition id | Output file | Look |
|---|---|---|
| `PlexusShells-TealOrange` | `PlexusShells_TealOrange.mp4` | network sphere with an inner sphere turning the other way |
| `LEDCubeWall-Blue` | `LEDCubeWall_Blue.mp4` | stepped wall of blocks with blinking LEDs |
| `LEDCubeWall-GraphiteAmber` | `LEDCubeWall_GraphiteAmber.mp4` | same look, graphite and amber |
| `GlassCubeField-Blue` | `GlassCubeField_Blue.mp4` | low glide over a field of glass blocks |
| `GlassCubeField-Emerald` | `GlassCubeField_Emerald.mp4` | same look, emerald |
| `FibreLayers-Cyan` | `FibreLayers_Cyan.mp4` | looking up under stacked circuit plates and fibre bundles |
| `FibreLayers-Violet` | `FibreLayers_Violet.mp4` | same look, violet |
| `ChipCloud-Blue` | `ChipCloud_Blue.mp4` | glide through a lattice of chip plates joined by fibres |

`Dev-FibreModelCheck` is a development composition: one plate with two fibre
bundles, used for the model check. It is not a deliverable.

## Setup

```console
npm install
npx remotion studio
```

Versions are pinned in `package.json` (Remotion 4.0.515, three 0.178.0,
@react-three/fiber 9.3.0, React 19.2.3).

### Chromium GL flag

These scenes need WebGL2. `remotion.config.ts` sets

```ts
Config.setChromiumOpenGlRenderer("angle");
```

which is the same as passing `--gl=angle` on the command line. Keep it for
every render. On a machine with a GPU, ANGLE uses it. Without one, Chromium
falls back to SwiftShader (software), which works but is slow; the timings
below were measured that way.

## Render commands (4K)

```console
npx remotion render src/index.ts PlexusShells-TealOrange   out/PlexusShells_TealOrange.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts LEDCubeWall-Blue          out/LEDCubeWall_Blue.mp4          --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts LEDCubeWall-GraphiteAmber out/LEDCubeWall_GraphiteAmber.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts GlassCubeField-Blue       out/GlassCubeField_Blue.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts GlassCubeField-Emerald    out/GlassCubeField_Emerald.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts FibreLayers-Cyan          out/FibreLayers_Cyan.mp4          --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts FibreLayers-Violet        out/FibreLayers_Violet.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts ChipCloud-Blue            out/ChipCloud_Blue.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

A 720p preview is the same command with `--scale=0.3333333333333333`, which
gives exactly 1280×720. The scenes render at the real output size because
the canvas `dpr` follows Remotion's scale, and every line width, sprite size,
DoF radius and grain cell is set in units of the output height.

## Still command (6000×3375)

```console
npx remotion still src/index.ts PlexusShells-TealOrange out/PlexusShells_TealOrange_6K.png --frame=300 --scale=1.5625 --gl=angle
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. Swap in any composition id.

## Measured render times

These were measured in a cloud container with **no GPU**, so Chromium ran
WebGL2 on SwiftShader (software) through ANGLE. On 4 CPU cores, each
composition rendered 60 frames (270–329) in one page at concurrency 1. The
times include page setup, spread over the 60 frames.

| Composition | 720p ms/frame |
|---|---|
| PlexusShells-TealOrange | 947 |
| LEDCubeWall-Blue | 828 |
| LEDCubeWall-GraphiteAmber | 843 |
| GlassCubeField-Blue | 1358 |
| GlassCubeField-Emerald | 1353 |
| FibreLayers-Cyan | 1410 |
| FibreLayers-Violet | 1381 |
| ChipCloud-Blue | 5125 |

**Timed 4K frames (3840×2160, frame 300, software GL):**

| Composition | single cold still | 4-frame sequence, per frame |
|---|---|---|
| GlassCubeField-Blue (3A) | 20.5 s | 12.1 s |
| FibreLayers-Cyan (4A) | 20.6 s | 10.6 s |

The cold still includes browser start, page load and scene build. The
sequence figure is closer to the steady-state cost during a video render.

**4K estimates (software GL, concurrency 1, 600 frames).** 4K is 9× the
pixels of 720p, and the timed frames came out at 7.5–9× the 720p cost:

| Composition | est. s/frame | est. per 20 s loop |
|---|---|---|
| PlexusShells | ~8 | ~80 min |
| LEDCubeWall (each) | ~7 | ~70 min |
| GlassCubeField (each) | ~12 | ~2 h |
| FibreLayers (each) | ~10.5 | ~1 h 45 min |
| ChipCloud | ~35 (geometry-bound, least certain) | ~6 h |

With a GPU these numbers should fall a long way, because the scenes are
fill-rate and vertex bound, which software rendering handles worst. I did
not measure GPU timings. Raising `--concurrency` helps only when there are
spare cores or GPU capacity.

## Determinism

Every value on screen is computed from `useCurrentFrame()` alone:

- Layouts (node positions, groups, LED sets, plates, bundles, circuit
  layouts) come from `mulberry32` seeded at module level.
- Block moves, LED blinks, twinkles, pulses and bead positions come from
  schedules whose periods divide 600, evaluated at `frame % 600`.
- There is no `Math.random()`, no `Date.now()`, no R3F clock, no `useFrame`
  timing, no state carried between frames, no TAA and no
  `AccumulativeShadows`. LED-wall shadows and seam occlusion are analytic
  (computed in the shader from neighbouring block depths).
- `useFrame(…, 1)` is used only to take over the draw call. It reads the
  frame number that `useCurrentFrame()` set during render.
- Circuit textures are drawn once in Canvas 2D. The canvas mounts only after
  they exist, behind `delayRender` / `continueRender`.

Grain and dither use a PCG hash of (pixel x, pixel y, `frame % 600`).

## Verification

`scripts/check.mjs` bundles once and reuses one browser:

```console
node scripts/check.mjs stills      out/stills 0.3333333333333333 0,300   # PNG stills
node scripts/check.mjs loop        out/loop   0.3333333333333333         # frame 0 vs 600 (601-frame comps)
node scripts/check.mjs determinism out/det    0.3333333333333333         # frame 300 cold vs in a sequence
node scripts/check.mjs timing      out/timing 0.3333333333333333 60      # ms/frame over 60 frames
```

The loop check passes `--props='{"loopCheck":true}'`, which makes a
composition 601 frames long through `calculateMetadata`.

Results on the final code (720p, `--gl=angle`):

| Check | Result |
|---|---|
| Loop: frame 0 vs frame 600 (601-frame comps) | identical, all 8 |
| Determinism: frame 300 cold vs frame 300 in a 290–300 sequence | byte-identical PNGs, all 8 |
| Contact sheets (frames 0, 120, 240, 360, 480) | expected content in all 8 |
| Motion: 60 frames around frame 300 | frame-to-frame mean difference stays within ±9% of its average (no pops); seams and edges stable on consecutive frames |

## Banding

Final pass: ±1/255 shader dither, plus about 1.5% grain from a PCG hash of
(x, y, `frame % 600`). In Plexus Shells, grain fades to zero below about 3%
luminance and dither below about 1%, so the black stays clean.

Checked on **encoded H.264** (CRF 16, yuv420p): 60 frames around frame 300
of each composition were encoded, and frame 300 was decoded back to PNG.
- In smooth areas (fog, glass falloff, LED-wall light falloff, blue haze),
  runs of identical pixel values along a row have a median length of 2 px
  and a 99th percentile of 4–6 px in all 8. There are no plateaus or steps.
- Plexus Shells: the left 250 px of the frame decodes to exactly 0 in every
  channel, and the glow rises smoothly from 0 to 1 near the sphere.

## Completion checklist

- [x] 8 compositions, 3840×2160, 30fps, 600 frames, one data row each
- [x] three.js on WebGL2 via `@remotion/three`, `--gl=angle`; no PixiJS, no WebGPU
- [x] No text, logos or brands; circuit patterns are abstract
- [x] Seamless 20 s loops (loop check passes on all 8)
- [x] Deterministic (frame 300 cold equals frame 300 in a sequence, byte for byte)
- [x] No `Math.random()`, `Date.now()`, R3F clock, TAA or `AccumulativeShadows`
- [x] Circuit textures built once behind `delayRender`
- [x] Dither and grain from a fixed formula of pixel position and `frame % 600`; Plexus black stays clean
- [x] Banding checked on encoded H.264
- [x] Fibre kit model check (3 rounds with a fresh sub-agent)
- [x] Visual comparison against the references (3 rounds per look with fresh sub-agents)
- [x] 720p render time per frame measured for every composition; one 4K frame timed for 3A and 4A
- [x] One 720p PNG still of each composition
- [ ] 720p mp4 previews: not rendered (dropped from the request mid-task)
- [ ] 4K renders: not done here (render with the commands above)

## Adding a colourway (one data row)

Every version is one row in `src/catalog.ts`. To add one, copy a row, give
it a new `id` and change the colours:

```ts
row<LedCubeWallParams>({
  id: "LEDCubeWall-Red",
  factory: createLedCubeWall,
  params: { block: "#5A0A12", led: "#FF6A4A", seam: "#200406", key: 1.1, spec: 0.08 },
}),
```

The fibre looks take a `FibrePalette` object. Spread an existing palette and
override the colours (`fibre`, `pulse`, `fog`, `plate`, `bgTop`,
`bgBottom`); `FIBRE_VIOLET` is an example. The new composition appears in the
studio and can be rendered by its id.

## Deviations from the brief

These changes depart from the written brief, mostly to match the
reference clips more closely after the visual comparisons:

- **LED Cube Wall:** about 27×15 blocks in view rather than 56×32, so block
  size matches the reference. Block faces are 97.5% of the cell rather than
  94%, because the reference shows almost no seams. About 35–40% of blocks
  carry an LED (brief: 30%; the reference shows about 40%), clustered in
  patches and runs, with varied brightness. The Blue block colour is
  `#0458C4` rather than `#1A5AC8`, removing the red so the hue matches the
  reference.
- **Glass Cube Field:** the camera is about 34° down and a little higher
  than the brief's 25°, to match the reference framing. Top faces use a
  premultiplied "over" blend (alpha 0.72), with far blocks drawn first, so
  they read as solid lit glass. Side and back faces stay additive, as the
  brief specified. Blue uses fill `#0844D0`, edge `#4AA0FF` and glow
  `#1A5AFF` rather than `#0A2AB0`, `#5A8AFF` and `#1A4AFF`, to match the
  reference's azure. Emerald uses the brief's colours.
- **Plexus Shells:** 16 dotted rings plus 22 small upright loops (brief: 10
  rings), because the reference is full of upright dotted loops. A bluer
  cyan `#22D8F0` is mixed in with the teal. About 35% of nodes get one
  longer link on top of their 3 nearest. The far-side fade, twinkle,
  rotations and colours otherwise follow the brief.
- **Fibre Layers:** the layout is a dim upper board, a tilted middle band
  and a far lower band. Bundles rise from the middle band into the board
  and hang down into the haze, fanning out. Each bundle has 20–26 fibres.
  Bead dots travel along the fibres as sprites, positions computed from the
  frame, alongside the shader pulses. The background is a gradient from
  black to blue.
- **Chip Cloud:** the camera is about 17° down (brief: 30°), to match the
  reference's low view. Fog is `#0E3260` (brief: `#1A5AA8`), the darker navy
  of the reference. Each level is offset by 0.32 units, so the regular
  column gaps never line up end-on. Bundles land straight below on the next
  plate's top face, so they hang near-vertically as in the reference. The
  top-face circuit texture is dimmed, because the reference plates are
  nearly plain.
