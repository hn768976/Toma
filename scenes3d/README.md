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

MEASURED_TIMES

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

VERIFICATION_RESULTS

## Banding

BANDING_RESULTS

## Completion checklist

CHECKLIST

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

DEVIATIONS
