# LED World Map · Neon Gears (Remotion)

Seven 20-second seamless loops (30 fps, 600 frames, 3840×2160) in one Remotion project.
Everything is built in code. There is no text, no logos and no external art.

| Composition | Look | Reference | Engine |
|---|---|---|---|
| `LEDWorldMap-GreenAmber` | 1A, flat LED panel, green→amber gradient | 101300810 | fragment shader, orthographic plane |
| `LEDWorldMap-Ember` | 1B, warm ember panel | 101300812 | fragment shader, orthographic plane |
| `LEDWorldMap-SkyBlue` | 1C, inverted: deep-blue land on a light panel | 101300815 | fragment shader, orthographic plane |
| `LEDWorldMap-PanelGlide` | 1D, the 1A panel tilted 25°, camera glides Europe → Asia → back, DoF | — | same shader on a perspective plane + DoF gather |
| `NeonGears-Fire` | 2A, orange/red neon gears, yellow-white cores | 490622658 | three.js ribbons, 6 layers, per-layer gather DoF, bloom |
| `NeonGears-CyanViolet` | 2B, cyan / teal / violet / magenta on violet-navy | 490622726 | as 2A |
| `NeonGears-Brass` | 2C, brass gold → deep amber | — | as 2A |

## Install and run

```bash
npm install
npx remotion studio        # preview (the Studio caps the canvas to half resolution to stay responsive)
```

Node 18+ is required. All dependencies are pinned exactly in `package.json`, with `package-lock.json`.

## Chromium GL flag

All looks use **WebGL2 through ANGLE**. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the same as passing **`--gl=angle`** on the
command line. Pass the flag explicitly if you render through the Node APIs, which ignore the
config file. Don't use `swiftshader`, `egl` or WebGPU.

## 4K render commands (one per composition)

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, PNG intermediate frames and the GL
renderer. These commands render the 3840×2160 masters:

```bash
npx remotion render src/index.ts LEDWorldMap-GreenAmber out/LEDWorldMap_GreenAmber_4K.mp4 --gl=angle
npx remotion render src/index.ts LEDWorldMap-Ember      out/LEDWorldMap_Ember_4K.mp4      --gl=angle
npx remotion render src/index.ts LEDWorldMap-SkyBlue    out/LEDWorldMap_SkyBlue_4K.mp4    --gl=angle
npx remotion render src/index.ts LEDWorldMap-PanelGlide out/LEDWorldMap_PanelGlide_4K.mp4 --gl=angle
npx remotion render src/index.ts NeonGears-Fire         out/NeonGears_Fire_4K.mp4         --gl=angle
npx remotion render src/index.ts NeonGears-CyanViolet   out/NeonGears_CyanViolet_4K.mp4   --gl=angle
npx remotion render src/index.ts NeonGears-Brass        out/NeonGears_Brass_4K.mp4        --gl=angle
```

For a 720p preview, add `--scale=0.3333333333333333`, which gives exactly 1280×720.

## 6K still (6000×3375)

```bash
npx remotion still src/index.ts <CompositionId> out/<CompositionId>_6K.png --frame=120 --scale=1.5625 --gl=angle
```

The shaders, line widths, DoF radii and bloom are all defined relative to the frame height, so
6K stills look like 4K frames with more detail.

## Measured render times

Everything was measured in this project's build container. That container has **no GPU**, so
Chromium's WebGL2 ran on ANGLE's software (SwiftShader) backend. On any machine with a real GPU,
expect these times to fall by one or two orders of magnitude.

The per-frame figure is the marginal cost: (time of a 60-frame sequence render − time of a cold
single still) ÷ 59. That removes browser start-up and bundling.

| Composition | 720p per frame | 4K per frame |
|---|---|---|
| LEDWorldMap-GreenAmber | 0.65 s | est. 2–3 s |
| LEDWorldMap-Ember | 0.58 s | est. 2–3 s |
| LEDWorldMap-SkyBlue | 0.59 s | est. 2–3 s |
| LEDWorldMap-PanelGlide (1D) | 4.05 s | **36.7 s (measured)** |
| NeonGears-Fire (2A) | 1.41 s | **5.3 s (measured)** |
| NeonGears-CyanViolet | 1.41 s | est. 5.3 s (same pipeline as 2A) |
| NeonGears-Brass | 1.40 s | est. 5.3 s (same pipeline as 2A) |

The two 4K frames were timed as (4-frame 4K sequence at concurrency 1 − single 4K still) ÷ 3,
at frame 300. 2A at 4K is 120 gears, 6 layer passes, per-layer gather DoF and mip-chain bloom.
1D at 4K is the tilted panel plus a 64-tap per-pixel gather at full resolution.

**4K estimates for 600 frames on the same CPU-only machine at concurrency 1:**
- flat LED maps: about 20–30 min each;
- gears: about 53 min each;
- 1D: about 6 h.

1D scales with pixel count (×9 from 720p) because its DoF gather is fill-bound. The others scale
sub-linearly (×3.8 for 2A). On a GPU workstation all seven should take minutes each.

## Verification (run before delivery)

`scripts/verify.sh <CompositionId>` and `scripts/analyze.py` reproduce these checks.

### Loop: frame 0 vs frame 600, pixel for pixel

`REMOTION_LOOP_CHECK=1` (read at bundle time) builds 601-frame compositions. Frames 0 and 600
were rendered and compared. **All 7 compositions: maximum difference 0.** This holds because:
- every time-dependent term uses whole cycles of `t = (frame % 600) / 600`;
- the camera paths and focus shift are closed;
- every gear advances exactly 120 teeth per loop (N ∈ {12, 15, 20, 24, 30, 40, 60, 120});
- the grain uses `frame % 600`.

### Determinism: cold frame 300 vs frame 300 from a multi-frame render

Frame 300 was rendered alone from a cold start and compared with frame 300 from a 60-frame,
multi-tab sequence render (frames 270–329). **All 7 compositions: maximum difference 0 (byte for
byte on the decoded pixels).** Every value comes from `useCurrentFrame()`:
- there is no `Math.random()`; layouts, tooth counts, colours and phases come from module-level
  `mulberry32` streams with fixed seeds;
- there is no clock, no `Date.now()`, no TAA and no state carried between frames;
- R3F's `useFrame` is used only as the render hook, and its clock is never read;
- the land mask is rasterised once, behind `delayRender` / `continueRender`.

### Banding

Each 60-frame sequence was encoded to H.264 (`yuv420p`, CRF 16) and frame 300 decoded back.
Profiles were then read across:
- the 1A colour gradient (a vertical strip through the Pacific);
- the 1C background between LEDs;
- the gear halos falling off into black (2A, 2C);
- the 2B haze.

The longest run of identical 8-bit values on any single profile line was 2–12 px, with no steps
on the smooth ramps. The dither (±1/255, triangular) and 1.5 % grain hold up through the encode,
so the grain didn't need raising. In 2A and 2C the grain fades out below about 3 % luminance, so
true black stays clean. 2B keeps full grain because its background isn't black.

### Moiré

The panel ended up at **120 LEDs across** (see "Changes from the brief" below). That is 10.7 px
per LED at 720p and 32 px at 4K, far from the pixel pitch, so there is no moiré at 720p.
`--scale=0.3333333333333333` already gives exactly 1280×720, so no ×0.5 render with lanczos
downscale was needed. Two safeguards remain in the shader:
- the LED shape is box-filtered by its screen-space footprint;
- it fades to the pattern's mean once an LED is under about 2 px (needed for the far edge of 1D's
  tilted panel).

`deliverables/LEDWorldMap_GreenAmber_4K_centre_crop.png` is a 1280×720 crop from the centre of a
real 4K frame, showing crisp, evenly spaced LEDs.

### Motion

60-frame sequences around frame 300 were stepped through:
- **LEDs:** frame-to-frame change is grain-level, and the 2nd-difference to 1st-difference ratio
  of 1.75 is that of independent noise, not strobing. The twinkles are slow, at 3–8 whole cycles
  per loop. Grid lines are static.
- **1D:** the glide is a cosine-eased closed path.
- **Gears:** teeth and spokes are anti-aliased in the vertex shader (lines are never thinner than
  about 0.55 px σ, with their energy conserved), so they don't shimmer while turning. Meshing
  gears use a phase-locked tooth/gap formula, and the camera roll is a single sine.

## Changes from the brief (and why)

- **LED density: 120 across, panel line every 4 LEDs (the brief said about 300 and every 6).**
  Autocorrelation of the reference frames gives an LED pitch of 10.65 px at 1280 wide
  (120 across) and a panel-line period of 43 px (every 4 LEDs). This was the largest visible
  mismatch at 300.
- **Map framing:** the land sits inside a thin dark margin, as in the references (lon −171…+187,
  lat +93…−67, with land between about +83 and −58).
- **Gear line width:** the brief's 3 px at 4K read as hairlines next to the references, so the
  lines are now about 25 px FWHM at 4K on the focus layer. The hot core is about a quarter of
  that width.
- **Gears per layer:** 7 / 16 / 17 / 22 / 28 / 30 (120 in total) instead of an even 20, which keeps
  the black gaps the references have. Layers behind the focus fade into the haze.
- **Ember (1B):** the ocean LEDs are lit, as in the reference (the whole panel glows red-orange),
  at `oceanLevel` 2.2.
- **Sky Blue (1C):** there is no additive bloom, which would wash out on a light background.
  Instead a mix toward the wide blur gives the soft, glowing panel without whitening.

## How to add a colourway

Add one row to `ROWS` in `src/versions.ts`. Root registers one composition per row.

- **LED map:** copy a row and change `id`, the gradient stops (`land`, `ocean`, `line`, `bg`,
  which are `[position 0..1 top→bottom, hex]`), `landHi`, and the levels. `mode: "glide"` gives
  the tilted, gliding camera.
- **Gears:** copy a gear row and change `id`, `lineNear` / `lineFar` (near → far colour per
  layer), `core`, `bg`, `haze`, and `grainFade` (true on black backgrounds). Set
  `perGearMix: true` to give each gear its own colour from the list.

Hex values are sRGB. Shading happens in linear light.

## Project layout

```
src/versions.ts          one data row per version
src/Root.tsx             registers the compositions
src/lib/GLStage.tsx      ThreeCanvas wrapper: renders a pure function of the frame
src/lib/post.ts          deterministic mip-chain bloom, tone shoulder, vignette, grain, dither
src/ledmap/*             land mask (world-atlas → equirectangular raster), LED shader, 1D camera + DoF
src/gears/*              seeded meshing-chain layout, gear outline ribbons, per-layer DoF renderer
scripts/verify.sh        loop / determinism / timing check
scripts/analyze.py       motion + H.264 banding check
```

## Completion checklist

- [x] 7 compositions, 3840×2160, 30 fps, 600 frames, seamless (frame 600 = frame 0, verified)
- [x] Deterministic (cold frame 300 = in-sequence frame 300, verified)
- [x] WebGL2 via ANGLE, `@remotion/three`; no PixiJS, no WebGPU, no MCP services
- [x] No text, logos or brands
- [x] Banding checked on encoded H.264; moiré checked at 720p and 4K
- [x] 720p per-frame render times for all 7; 4K frames of 2A and 1D timed
- [x] One 720p still per composition plus a 4K centre crop of 1A (`deliverables/`)
- [x] `npm install && npx remotion studio` from a clean copy
- [x] Look-matching: three rounds of blind comparison against the references (see the delivery notes)

## Map data licence

The land outlines come from **world-atlas** `land-110m.json` (© 2013–2019 Michael Bostock, ISC
licence), used via **topojson-client** (ISC). world-atlas is derived from **Natural Earth**
1:110m physical data, which is in the **public domain** (naturalearthdata.com). The ISC licence
permits use, copying, modification and distribution with or without fee, provided the copyright
notice and permission notice are kept.
