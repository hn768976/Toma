# Light Streams · Pixel Burst · Gravity Well · Fabric Waves

Four abstract motion-graphic looks, two colourways each: **8 compositions** in one
Remotion project. Every composition is a **20 s seamless loop**: 600 frames at
30 fps, defined at **3840×2160**, built entirely in code (three.js / GLSL on
WebGL2). There are no image assets, no text and no logos.

| Composition id | Output file | Look | Engine |
|---|---|---|---|
| `LightStreams-Blue` | `LightStreams_Blue.mp4` | 1A light streams, blue | three.js, 3D ribbons + packets |
| `LightStreams-Emerald` | `LightStreams_Emerald.mp4` | 1B light streams, emerald | 〃 |
| `PixelBurst-Neon` | `PixelBurst_Neon.mp4` | 2A LED-grid burst, neon | full-screen shader |
| `PixelBurst-Gold` | `PixelBurst_Gold.mp4` | 2B LED-grid burst, gold | 〃 |
| `GravityWell-Grid` | `GravityWell_Grid.mp4` | 3A wireframe gravity well | three.js, 3D |
| `GravityWell-Planet` | `GravityWell_Planet.mp4` | 3B well + planet + moon | 〃 |
| `FabricWaves-VioletTeal` | `FabricWaves_VioletTeal.mp4` | 4A fabric surface, violet-teal | three.js, displaced surface + DoF |
| `FabricWaves-AmberRose` | `FabricWaves_AmberRose.mp4` | 4B fabric surface, amber-rose | 〃 |

Remotion doesn't allow `_` in composition ids, so the ids use `-`. The output
files keep the `_` names.

## Setup

```bash
npm install
npx remotion studio          # preview (Studio draws at <=0.5x pixel density)
```

Versions are pinned in `package.json`: Remotion 4.0.515, three 0.180.0,
@react-three/fiber 9.3.0, React 19.2.3.

## GPU / Chromium GL flag

All looks are WebGL2. `remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("angle")`.
On the command line, that is **`--gl=angle`**. On a machine with a GPU, ANGLE uses
the GPU. On a headless box with no GPU, `--gl=angle` falls back to SwiftShader on
the CPU (the previews here were rendered that way). There you can also pass
`--gl=swangle` explicitly. Do not use WebGPU.

## Render commands

### 4K (3840×2160), one per composition

```bash
npx remotion render src/index.ts LightStreams-Blue      out/LightStreams_Blue.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts LightStreams-Emerald   out/LightStreams_Emerald.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts PixelBurst-Neon        out/PixelBurst_Neon.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts PixelBurst-Gold        out/PixelBurst_Gold.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts GravityWell-Grid       out/GravityWell_Grid.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts GravityWell-Planet     out/GravityWell_Planet.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts FabricWaves-VioletTeal out/FabricWaves_VioletTeal.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts FabricWaves-AmberRose  out/FabricWaves_AmberRose.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

For a mezzanine master, use `--codec=prores --prores-profile=4444` instead.

### 6K stills (6000×3375)

6000 / 3840 = 1.5625, so `--scale=1.5625` gives exactly 6000×3375:

```bash
npx remotion still src/index.ts LightStreams-Blue out/LightStreams_Blue_6K.png --frame=150 --scale=1.5625 --gl=angle
```

Swap in any composition id and frame. All sizes in the shaders (line widths,
dot grid, blur radii, bloom) are fractions of the output height, so a 6K still
shows the same picture as the 4K video, just sharper.

### 720p previews (what was delivered)

```bash
scripts/render-preview.sh LightStreams-Blue LightStreams_Blue
# renders a PNG sequence with --scale=0.3333333333333333 (exactly 1280x720), then
# ffmpeg -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30 -an
```

The PNG sequence is kept so that frame 300 can be compared byte for byte (step 3).

## Measured render time

The previews were rendered on a 4-vCPU cloud container with **no GPU** (WebGL2 on
SwiftShader through `--gl=angle`), `--concurrency=4`:

RENDER_TIME_TABLE

**4K estimate.** 4K has 9× the pixels of 720p. These looks are almost entirely
fill-bound (full-screen passes, DoF and bloom all scale with pixel count), so
on the same CPU-only box expect roughly 8-9× the per-frame time. On any
discrete GPU, the same 4K frames take well under a second each; the scenes are
small (≤ 1.2 M triangles, ~10 full-screen passes).

FOUR_K_TABLE

## How it stays deterministic

Remotion renders frames out of order on several tabs, so:

- Every visual quantity is a function of `useCurrentFrame()` only. The time
  base is `phase = (frame % 600) / 600`, and everything animated is a
  periodic function of it with a **whole number of cycles**:
  - the flow morph and the noise fields are sampled **around a circle in time**;
  - packets do whole laps; ring beats are 12 per loop; sparkles do 1-3 flashes per loop;
  - the camera orbit and drift run on closed paths;
  - the moon makes one orbit and the planet one spin per loop.
  So frame 600 equals frame 0 and 599 → 600 is continuous.
- All random layout (lines, packets) comes from `mulberry32` with fixed seeds,
  built once at module level. There is no `Math.random()`, no `Date.now()`, no
  R3F clock, no `useState` driving visuals, and no temporal effects (TAA etc.).
  R3F's `useFrame` is used only as the draw callback; it reads Remotion's frame.
- Grain and dither are integer hashes (PCG) of pixel position and `frame % 600`.
- Every render target is fully overwritten each frame.

## Banding

- The final pass of every look adds **±1/255 triangular dither** after bloom and
  tonemapping, plus **grain** from a fixed hash of `(pixel, frame % 600)`.
  Grain is 2%, or 1% on Pixel Burst. It is luminance-weighted, so pure black stays
  near black.
- All scene and post buffers are half-float, so there is no 8-bit quantisation
  before the final pass.
- Check: decode a frame **from the encoded mp4** and read pixel values along the
  glow falloffs and dark gradients (see the checklist). The values must change in
  small irregular steps, with no plateaus.

BANDING_RESULTS

## Completion checklist

CHECKLIST

## Adding a colourway

Every version is one data row in `src/versions.ts`. Copy a row, give it a new
`id` (letters, digits and `-` only) and change the colours:

```ts
{
  id: "LightStreams-Magenta",
  create: createLightStreams({
    lineA: "#7A2AFF",
    lineB: "#FF9AF0",
    packets: ["#FFFFFF", "#FFC8F8", "#8FE8FF"],
    background: "#0C0222",
  }),
},
```

The composition appears in the Studio automatically. The colours are sRGB hex
values; the code converts them to linear light. The other parameters per look:

- **Pixel Burst:** `cols` sets the dot-grid columns. The spec value is 220. The
  reference clip measures about 84; set `cols: 84` for its chunkier tiles.
- **Gravity Well:** `k`, `eps` and `rMin` set the well profile
  `h(r) = -k / sqrt(r² + eps)`. The optional `planet` block adds 3B's planet and moon.

## Project layout

```
src/
  index.ts, Root.tsx      registers one <Composition> per row in versions.ts
  versions.ts             the 8 data rows (palettes and per-look parameters)
  rng.ts                  mulberry32 and the loop phase
  gl/Stage.tsx            <ThreeCanvas> wrapper; draws the look from the frame number
  gl/post.ts              HDR post chain: DoF (CoC, half-res gather), bloom mip chain,
                          ACES tonemap, grain, dither
  gl/glsl.ts              hash, simplex 3D/4D, filtered line profile, ribbon expansion
  looks/LightStreams.tsx  analytic S-curve flow field, 400 filtered ribbons, 3000 packets
  looks/PixelBurst.tsx    pattern pass (core, square frames, clouds) + LED dot pass
  looks/GravityWell.tsx   analytic polar grid (40×64) as filtered ribbons, planet, moon
  looks/FabricWaves.tsx   height pass (domain-warped 4D noise) → 1024×576 surface,
                          wale and stitch micro texture with pixel-footprint fade
scripts/                  preview render and verification helpers
```

## Notes and deliberate choices

NOTES
