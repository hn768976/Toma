# Binary Towers

Tall curtains of falling `0`/`1` characters standing like towers in a dark space,
over a reflective grid floor, with the camera travelling between them on a closed
loop. Two colour variants, one composition each.

Built with [Remotion](https://remotion.dev) + `@remotion/three` (react-three-fiber
/ three.js). Compositions are authored at **3840×2160, 30 fps, 360 frames (12 s)**
and loop seamlessly.

| Composition id           | Variant                       | Output name                 |
| ------------------------ | ----------------------------- | --------------------------- |
| `V1-BinaryTowersBlue`    | Deep blue (reference match)   | `V1_BinaryTowersBlue.mp4`   |
| `V2-BinaryTowersMono`    | White / silver monochrome     | `V2_BinaryTowersMono.mp4`   |

## Quick start

```console
npm install
npx remotion studio
```

## Render

**4K (the compositions are authored at this size):**

```console
npx remotion render V1-BinaryTowersBlue out/V1_BinaryTowersBlue.mp4 --scale=1 --crf=16
npx remotion render V2-BinaryTowersMono out/V2_BinaryTowersMono.mp4 --scale=1 --crf=16
```

**1080p preview** — same frame, half the pixels:

```console
npx remotion render V1-BinaryTowersBlue out/V1_BinaryTowersBlue.mp4 --scale=0.5 --crf=16
npx remotion render V2-BinaryTowersMono out/V2_BinaryTowersMono.mp4 --scale=0.5 --crf=16
```

**Stills:**

```console
npx remotion still V1-BinaryTowersBlue out/V1_BinaryTowersBlue_still.png --frame=128 --scale=0.5
npx remotion still V2-BinaryTowersMono out/V2_BinaryTowersMono_still.png --frame=128 --scale=0.5
```

`remotion.config.ts` already pins `h264` / `yuv420p` / PNG intermediate frames and
disables the silent audio track, so the commands above need no extra flags.

### Chromium GL flag

The scene is WebGL, so headless Chromium needs a real GL backend. The config sets

```ts
Config.setChromiumOpenGlRenderer("angle");
```

which is equivalent to launching Chromium with `--gl=angle`. On a machine with a
GPU, ANGLE uses it. With no GPU, Chromium falls back to SwiftShader (CPU), which
renders correctly but is what every timing below was measured on. You can select
either explicitly per render with `--gl=angle` / `--gl=swiftshader`.

## Measured render time

Measured on this project, single-threaded (`--concurrency=1`), no GPU — Chromium
fell back to SwiftShader — on a 4 vCPU Intel Xeon @ 2.10 GHz. Timings are the
marginal cost per frame (a 20-frame run minus a 5-frame run, so bundling and
browser startup are excluded):

| Resolution           | Per frame | 360-frame clip |
| -------------------- | --------- | -------------- |
| 1920×1080 (`--scale=0.5`) | **1.27 s** | ~7.5 min       |
| 3840×2160 (`--scale=1`)   | **1.87 s** | ~11 min        |

4K is only ~1.5× the cost of 1080p because the frame is dominated by CPU work
(drawing the 20 character-grid canvases), not by fill rate. On this box raising
`--concurrency` did not help — 4 concurrent tabs measured 1.93 s/frame at 1080p,
worse than one — because SwiftShader is already using every core. On a machine with
a real GPU, raise concurrency and expect a large speedup.

## How it is built

```
src/
  constants.ts            composition size, cell metrics, loop periods
  Root.tsx                the two compositions
  BinaryTowers.tsx        top level: canvas, camera rig, grain
  Grain.tsx               grain + vignette overlays (DOM, not WebGL)
  lib/random.ts           mulberry32 + a stateless 4-input hash
  lib/font.ts             embedded monospace loader
  scene/palette.ts        V1 / V2 colour definitions
  scene/layout.ts         seeded tower placement
  scene/cameraPath.ts     the closed camera curve
  scene/towerTexture.ts   character grid -> offscreen canvas
  scene/towerMaterial.ts  UV scroll, per-tower depth of field, fog
  scene/Towers.tsx        tower planes, reflections, contact glow
  scene/Floor.tsx         reflective grid floor
  scene/Debris.tsx        floating streaks and character fragments
  scene/Backdrop.tsx      background gradient
  scene/sprites.ts        shared glow sprite + debris atlas
```

**No mesh per character.** Each tower is one or two vertical planes. Its whole
character grid is drawn to an offscreen canvas once per *content step* (every 2
frames) and mapped to the plane; falling is a UV scroll, not moving geometry.
Sixteen towers make twenty planes in total: four of them get a second plane
crossing the first, which is what stops an edge-on tower from disappearing.

**Everything is a pure function of `useCurrentFrame()`.** No `useFrame` clock, no
delta accumulation, no state carried between frames — Remotion renders frames out
of order across threads. Tower placement, sizes and character content come from a
seeded mulberry32 PRNG and a stateless `hash4(tower, row, col, epoch)`.

**The loop is exact by construction:**

- Each tower scrolls its texture by an integer number of full texture cycles over
  the 360 frames, and the texture is `TEX_ROWS` cells tall — so the fall distance
  is an exact integer multiple of the character cell height.
- Character flips are driven by `hash4(planeId, row, col, epoch)` where every
  per-cell flip period divides the 180 content steps in the loop.
- The camera curve is closed and arc-length parameterised (`getPointAt`), so
  frame 360 is frame 0's pose and the speed is constant.
- Debris drift uses integer harmonics of the loop period.

Verified: rendering frame 0 and frame 360 of a temporarily-extended composition
gave a maximum difference of 1/255 on 0.005 % of bytes — floating-point rounding
only.

**Depth of field** is per tower, not global. `dofRadius()` in
`scene/towerMaterial.ts` maps each tower's distance to a blur radius across five
zones — heavy foreground defocus (< 2.5), near transition (2.5-8), a sharp band
(8-19) where the digits must read, far transition (19-42), and a capped far
dissolve. The blur is a 13-tap disc in the fragment shader, so it varies
continuously and never pops between buckets.

**Bloom** is baked into the character canvas: a soft sprite composited additively
behind the hottest leading-edge characters only, plus a small contact glow where
each tower meets the floor. Nothing else glows — heavy bloom turns the towers into
slabs and the digits stop reading.

**Reflections** are the same tower planes mirrored below the floor, sampled with
their UVs flipped, blurred harder, tinted cooler and faded out with depth below
the floor line. The floor plane is drawn *over* them and is translucent, so the
floor's own dark base is what dims the reflection.

**Grain** is a seeded 256×256 noise tile, re-offset every frame, at ~2 % opacity in
`overlay` blend mode. It is there to dither the background gradient: without it the
gradient bands in H.264. Check the encoded file, not the studio preview.

**Colour is pass-through, not linear.** The `<ThreeCanvas>` is in react-three-fiber's
`legacy` mode, which turns three's colour management off. Every colour here is an
authored sRGB hex and the towers are hand-drawn canvases, so there is nothing for a
linear workflow to be more correct about — and with management on, a raw
`ShaderMaterial` writes linear values into an sRGB framebuffer without the matching
encode, which lands the backdrop about six times darker than the palette says.

**The font is embedded** (`public/fonts/JetBrainsMono-*.woff2`, latin subset) and
loaded through `delayRender`, so nothing is drawn until the real face is ready. A
substituted font would change the glyph metrics inside the character cell.

## Notes on the brief

- The V2 swatches in the brief (`#0d1013`, `#3a4048`, `#c8d0d8`, `#2a3038`) are each
  a shade cool. They are used here as their equal-luminance neutrals so that the
  encoded output measures neutral, which is the checkable requirement. Measured on
  a rendered V2 frame: mean R = G = B = 4.388, maximum per-pixel channel spread 0.
- No watermark, no logo.
