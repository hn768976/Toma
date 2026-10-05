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

| Look | Single tab, s/frame at 720p | Single tab, s/frame at 1080p | Full 600-frame preview, `--concurrency=4` |
|---|---|---|---|
| Light Streams | 1.07 | 1.79 | Blue 710 s (1.18 s/frame) · Emerald 578 s (0.96) |
| Pixel Burst | 0.99 | 1.80 | Neon 517 s (0.86) · Gold 509 s (0.85) |
| Gravity Well | 0.56 (3B) | 1.07 (3B) | Grid 226 s (0.38) · Planet 278 s (0.46) |
| Fabric Waves | 0.89 | 1.51 | Violet-Teal 470 s (0.78) · Amber-Rose 491 s (0.82) |

Single-tab numbers are (time for 20 frames − time for 1 frame) / 19, so they
exclude browser start-up. They include the PNG screenshot. SwiftShader already
spreads one frame over all cores, so `--concurrency=4` gains little on this box.

**4K estimate.** 4K has 9× the pixels of 720p. These looks are almost entirely
fill-bound (full-screen passes, DoF and bloom all scale with pixel count), so
on the same CPU-only box expect roughly 8-9× the per-frame time. On any
discrete GPU, the same 4K frames take well under a second each; the scenes are
small (≤ 1.2 M triangles, ~10 full-screen passes).

Measured scaling from 720p to 1080p (2.25× the pixels) fits
`t = fixed + per-pixel`. Extrapolated to 4K (9× the pixels), same CPU-only box:

| Look | 4K estimate, s/frame | 600 frames |
|---|---|---|
| Light Streams | ~5.7 | ~57 min |
| Pixel Burst | ~6.2 | ~62 min |
| Gravity Well | ~3.8 | ~38 min |
| Fabric Waves | ~4.8 | ~48 min |

These are CPU (SwiftShader) figures. On a machine with a GPU, `--gl=angle` runs
the same shaders in hardware, and frame time is then dominated by the 4K
screenshot and encode (typically well under 1 s/frame).

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

Result on the delivered previews (frame 300, decoded from the mp4,
`scripts/banding.py`): on dark gradient tiles the residual noise after H.264 is
0.45-0.55 LSB in the darkest areas (luma 4-20) and 1-9 LSB elsewhere. That means
grain and dither survive encoding. I also checked crops of every look stretched
×6-8 around their mean: the throat glow, the burst falloff, the dark navy/green
fields and the fabric shadows. None shows contour steps.

## Completion checklist

Run on the delivered 720p previews. Scripts are in `scripts/`.

- [x] **1. File checks** (`check-file.sh`): all 8 are 1280×720, h264, yuv420p,
  30/1, 20.000 s, 600 frames, no audio stream.
- [x] **2. Loop** (`verify-loop.sh`): with the composition extended to 601 frames,
  frame 0 == frame 600 pixel for pixel on all 8. The seam is also continuous:
  the 599→600 step equals the 0→1 step, except on Pixel Burst, where frame 0
  is a beat flash. There the seam step equals every other beat step (49→50).
- [x] **3. Determinism** (`verify-determinism.sh`): frame 300 rendered alone
  from a cold start is byte-identical (pixel data, SHA-256) to frame 300 of the
  full multi-tab render, on all 8.
- [x] **4. Banding:** see above.
- [x] **5. Contact sheets** (`contact-sheet.sh`, frames 0/120/240/360/480) show the
  required features for each look, including the 3B moon in a different place in
  every frame.
- [x] **6. Motion and aliasing:** frames 299/300/301 inspected at 2× zoom. No
  shimmer or crawl on the thin grid lines, the light-stream ribbons, the
  fabric ribs or the dot grid. Lines use an energy-conserving filtered profile
  (≥ ~1 px), and the fabric micro texture fades out once its period drops
  below ~3 px, at 720p and at 4K alike.
- [x] **7/8. Reference match:** three rounds of side-by-side comparison per look
  by fresh sub-agents (see the report).
- [x] `npm install && npx remotion studio` works from a clean copy of this folder.

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

- **Pixel Burst grid density.** The spec asks for ~220 columns at 4K, and that
  is what is used. The reference clip's tiles are bigger (~84 columns). Every
  reviewer flagged this as the largest difference. It is one number per
  version row (`cols`).
- **Gravity Well rotation.** "Whole turns" of rotation would be 18°/s for a
  20 s loop, which is not slow. Instead the grid turns by exactly one
  radial-line step (360°/64) per loop. Because the grid is 64-fold symmetric,
  that is visually identical to a whole number of turns, and the motion is
  slow.
- **Gravity Well radial count** is 64 instead of ~72: a closer match to the
  reference's cell size.
- **Gravity Well line colour** stays at the specified `#5FA8E8`, which brightens
  toward `#BFE8FF` deeper in the funnel. The reference reads paler and whiter
  at the edges; change `line` in the row if you prefer that.
- **Pixel Burst beats:** 12 per loop (one every 50 frames). With 10, frames
  spaced 120 apart all landed on the same beat phase.
- The reference fades in from black; the loops do not, as specified.
