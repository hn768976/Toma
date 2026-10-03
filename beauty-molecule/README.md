# Beauty Molecule (Remotion + three.js)

A glossy, translucent tetrahedral molecule turns slowly in a bright pastel
scene. Blurred DNA helices or small molecules and rings float behind it. There
are four compositions, each a seamless 20 s loop at 30 fps.

| Composition id (Remotion) | Output file name | Background | Colour |
|---|---|---|---|
| `BeautyMolecule-DNA-Coral` | `BeautyMolecule_DNA_Coral.mp4` | DNA helices | Coral |
| `BeautyMolecule-Structures-Coral` | `BeautyMolecule_Structures_Coral.mp4` | molecules + rings | Coral |
| `BeautyMolecule-DNA-Aqua` | `BeautyMolecule_DNA_Aqua.mp4` | DNA helices | Aqua |
| `BeautyMolecule-Structures-Aqua` | `BeautyMolecule_Structures_Aqua.mp4` | molecules + rings | Aqua |

Remotion does not allow `_` in composition ids, so the ids use `-`. The
rendered files use the `_` names.

- **Format:** 3D, WebGL2, three.js through `@remotion/three`. Compositions are
  defined at 3840×2160, 30 fps, 600 frames.
- **Assets:** everything is built in code. The only external asset is the CC0
  studio HDRI: "Studio Small 03" from Poly Haven, in `public/hdri/` with its
  `LICENSE.txt`.

## Setup

```sh
npm install
npx remotion studio
```

Node 18+ is required (tested on Node 22). All versions in `package.json` are
pinned, and `package-lock.json` is included.

## Chromium GL flag

Headless Chromium needs ANGLE for WebGL2:

```
--gl=angle
```

`remotion.config.ts` already sets this with
`Config.setChromiumOpenGlRenderer('angle')`. The commands below pass it
explicitly anyway. Without a GPU, ANGLE falls back to SwiftShader, which is
software rendering. It is slower but still deterministic.

## 4K render commands (3840×2160, H.264, yuv420p, CRF 16)

```sh
npx remotion render BeautyMolecule-DNA-Coral        out/BeautyMolecule_DNA_Coral.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render BeautyMolecule-Structures-Coral out/BeautyMolecule_Structures_Coral.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render BeautyMolecule-DNA-Aqua         out/BeautyMolecule_DNA_Aqua.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render BeautyMolecule-Structures-Aqua  out/BeautyMolecule_Structures_Aqua.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

720p previews use the same command plus `--scale=0.3333333333333333`. That
scale gives exactly 1280×720. `scripts/render_previews.sh` renders all four
previews and a PNG still of each.

## 6K stills (6000×3375)

6000 / 3840 = 1.5625, which gives exactly 6000×3375:

```sh
npx remotion still BeautyMolecule-DNA-Coral out/BeautyMolecule_DNA_Coral_6K.png --frame=150 --scale=1.5625 --gl=angle
```

Replace the composition id and the frame (0–599) as needed.

## Render time

These times were measured in the build environment: 4 vCPU, no GPU, so
WebGL ran on ANGLE's SwiftShader software path. Remotion 4.0.515 with Playwright
Chromium headless shell 1194.

| Measurement (720p, `--scale=0.3333333333333333`) | Result |
|---|---|
| Single thread (`--concurrency=1`), 89 frames after startup | **0.66 s / frame** |
| Full 600-frame preview, default concurrency, including encode | DNA-Coral 367 s, Structures-Coral 350 s, DNA-Aqua 362 s, Structures-Aqua 354 s, so **≈ 0.6 s / frame** wall time |

More concurrency barely helps here, because SwiftShader already spreads
each frame across all cores.

**4K estimate.** 3840×2160 has 9× the pixels of 720p, and the software
renderer is fill-rate bound. On the same kind of CPU-only machine, expect
**about 5–6 s per frame, or 50–60 min per composition**.

On a machine with a real GPU, ANGLE uses the hardware path. Shading cost
becomes small, and frame capture plus H.264 encode dominate: roughly
0.5–1 s per frame at 4K, so about 5–10 min per composition. That figure is
an estimate, not a measurement.

## How it is built

- **Rendering:** `src/scene/MoleculeRenderer.ts` builds and draws each frame
  only from `useCurrentFrame()`. A priority-1 `useFrame` callback takes over
  three.js rendering. R3F's clock and delta are never read.
- **Hero molecule:** real three.js meshes (spheres and cylinders) using a
  shared fake-glass `ShaderMaterial` with no real transmission:
  - Fresnel-driven body colour: saturated at the rim, clear and light in the
    middle.
  - An inner caustic glow and crescent opposite the key light.
  - A refraction-like pattern sampled from the HDRI.
  - Fresnel-weighted HDRI reflections and sharp specular highlights.
  - Tiny air bubbles fixed in each atom's frame.

  Bonds run into the atoms and show faintly through the glass.
- **Background:** one instanced draw per layer (behind and in front of the
  hero) of camera-facing capsule impostors. A sphere is a capsule with zero
  length.
  - **Depth of field is analytic:** each capsule grows by its circle of
    confusion, `cocK × |depth − focus|`, and its edge softens by the same
    amount. Highlights blur as energy-conserving Gaussians. There is no
    post-blur and no temporal accumulation.
  - Instances are sorted back to front every frame.
- **Final pass:** scene-linear half-float MSAA target, then:
  1. Soft bloom from the target's own mip chain.
  2. Vignette.
  3. AgX tonemapping (three.js AgX plus a saturation-only AgX look of 1.6).
  4. sRGB output.
  5. ±1.5 % monochrome grain.
  6. ±1/255 triangular dither.

  Grain and dither come from an integer hash of
  `(pixel x, pixel y, frame % 600)`.
- **Exact colours:** the palette is given as display hex. `src/agx.ts`
  inverts AgX exactly, so the background gradient ends and the atom
  edge/centre colours land on the specified hex values after tonemapping.
  Plain AgX cannot reach the saturated `#2FB8C8`; the 1.6 saturation look is
  what makes all 8 palette colours round-trip exactly.
- **Loop:** the phase is `(frame % 600) / 600`. Every motion uses a whole
  number of cycles:
  - Hero: 1 turn on a tilted axis, a 2-cycle bob and a 1-cycle sway.
  - Helices: ±1 turn about their own axes, plus closed drift ellipses.
  - Molecules and rings: whole-number turns (0 or ±1), plus closed drift.
  - Particles: closed 1- or 2-cycle paths.

  Frame 600 is therefore computed from exactly the same numbers as frame 0.
- **Determinism:**
  - `mulberry32` is seeded at module level and used only to build the
    layout.
  - No `Math.random()`, `Date.now()`, `useState`-driven visuals or carried
    state.
  - No TAA or temporal effects.
  - The HDRI is loaded behind `delayRender` / `continueRender`.

## Template data and adding a colour

`src/data.ts` has one row per background (`dna`, `structures`) and one row per
colour (`coral`, `aqua`). `src/Root.tsx` registers a composition for every
background × colour combination.

To add a colourway, add one row to `COLOURS`:

```ts
{
  id: 'lavender',
  name: 'Lavender',
  atomEdge: '#8F6AD8',   // saturated rim colour
  atomCenter: '#E2D4FA', // light centre colour
  bgLight: '#F6F2FD',    // background, upper left
  bgDeep: '#DCD0F0',     // background, toward the edges
},
```

This creates `BeautyMolecule-DNA-Lavender` and
`BeautyMolecule-Structures-Lavender`. Colours are display (sRGB) hex and are
matched after AgX. If a very saturated edge colour is outside AgX's gamut,
the inverse clamps it to the nearest reachable colour. You can check this with
`agx(sceneColorForDisplayHex(hex))`.

Background rows also set:

- `heroScale`, `heroOffset`, `heroBondLength`, `heroBondRadius`
- `cocK`, the depth-of-field strength

## Verification

`scripts/verify.sh` runs the checks below. `scripts/banding_check.py` does the
banding check.

1. **File check:** ffprobe confirms 1280×720, 30/1, 20.0 s, h264, yuv420p and
   no audio stream.
2. **Loop check:** with `--props='{"loopCheck":true}'`, the composition is
   601 frames long. Frames 0 and 600 are rendered as PNGs and compared with
   `cmp`.
3. **Determinism:** frame 300 is rendered on its own as a cold-start still,
   then compared byte for byte with frame 300 of a full PNG-sequence render.
4. **Banding:** a frame is extracted from the encoded mp4 (not the preview).
   Pixel values are read along a background band. Each sample averages a tall
   column to remove grain, so a staircase would show as flat runs with
   whole-code jumps.
5. **Content check:** five evenly spaced frames are extracted from each mp4
   and inspected.

Results for the delivered 720p previews:

| Check | DNA-Coral | Structures-Coral | DNA-Aqua | Structures-Aqua |
|---|---|---|---|---|
| 1280×720, 30/1, 20.000 s, h264, yuv420p, 0 audio streams | pass | pass | pass | pass |
| Loop: frame 0 vs 600 (`cmp`) | identical | identical | identical | identical |
| Frame 300: cold still vs full sequence | byte-identical | byte-identical | byte-identical | byte-identical |
| Banding, whole-code clustering (staircase ≈ 0.75) | 0.02 / 0.04 | 0.11 / 0.08 | 0.04 | 0.06 |
| Five frames: hero turning, blurred background, correct palette | pass | pass | pass | pass |

**Banding method.** The values in the table are the top 120 rows of the
t = 10 s frame; channels that clip at 255 are skipped.

- The same test on the bottom 120 rows gives 0.01–0.05.
- On `bgOnly` renders (gradient only, same encode) it gives 0.02–0.18.
- The control, the same gradient rounded to whole codes, scores 0.74–0.76.
- A levels-stretched green channel of a DNA-Coral mp4 frame (about 5× gain)
  shows a smooth gradient with fine grain and no contour lines.

## Completion checklist

- [x] 4 compositions generated from the template data (2 backgrounds × 2 colours)
- [x] 3D with `@remotion/three` and three.js on WebGL2; no PixiJS, WebGPU, text or logos
- [x] Hero: centre atom plus 4 tetrahedral atoms, bond cylinders, fake glass with no transmission (Fresnel, inner caustic, specular, HDRI reflections, bubbles)
- [x] Hero: one full turn per 20 s on a tilted axis, whole-cycle bob
- [x] DNA background: helices of glossy spheres and rungs crossing diagonally, turning whole turns about their axes; plus small molecules, rings and particles
- [x] Structures background: molecules of 3–7 atoms and benzene-style hexagon rings at many depths; plus particles
- [x] Strong analytic depth of field: hero sharp, far objects very soft
- [x] Pastel gradient, soft vignette, AgX tonemapping, sRGB output; palette hexes matched exactly
- [x] Shader dither ±1/255 and ±1.5 % grain from `(pixel, frame % 600)`, no `Math.random()`
- [x] Deterministic: module-level `mulberry32`; no `useFrame` clock, `Date.now()` or carried state; HDRI behind `delayRender`
- [x] 600 frames, 30 fps, 16:9, defined at 3840×2160; instanced meshes for background spheres and bonds
- [x] Loop, determinism and banding checks pass on all 4 (see above)
- [x] 720p previews and a 720p PNG still of each
- [x] Render time measured at 720p; 4K estimate given
- [x] 6K still command documented (not rendered here)
- [x] `npm install && npx remotion studio` checked from a clean copy
