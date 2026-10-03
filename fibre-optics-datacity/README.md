# Fibre Optic Macro · Data Block City · Growing Fibre Strands

One Remotion project, five compositions, everything generated in code: no
footage, no images, no logos, no text, no MCP servers.

| Composition id            | Look                  | Engine                      | Length          | Loop |
|---------------------------|-----------------------|-----------------------------|-----------------|------|
| `FibreOptic-Blue`         | Fibre Optic Macro, 1A | PixiJS 8 (WebGL2)           | 600 f / 20 s    | yes  |
| `FibreOptic-Multicolour`  | Fibre Optic Macro, 1B | PixiJS 8 (WebGL2)           | 600 f / 20 s    | yes  |
| `DataBlockCity`           | Data Block City       | three.js via `@remotion/three` | 600 f / 20 s | yes  |
| `GrowingFibres-BluePink`  | Growing Fibres, 3A    | three.js via `@remotion/three` | 450 f / 15 s | no   |
| `GrowingFibres-GreenGold` | Growing Fibres, 3B    | three.js via `@remotion/three` | 450 f / 15 s | no   |

Every composition is defined at **3840×2160, 30 fps**.

**Growing Fibre Strands is an overlay.** It renders on pure black (0,0,0), with
no grain and no dither on the black areas. Put it over other footage with a
**Screen** or **Add** blend mode.

## Setup

```bash
npm install          # versions are pinned in package.json / package-lock.json
npx remotion studio  # preview
```

The Studio preview renders the canvases at half resolution or less so it stays
interactive. Final renders use the full output resolution.

### Chromium GL flag

All looks use **WebGL2**, not WebGPU. Headless Chromium must use ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("angle")`,
so the flag is only needed if you call the renderer some other way. ANGLE uses
the GPU when there is one. Without a GPU, Chromium falls back to SwiftShader on
the CPU, which is what the timings below were measured on.

## 4K render commands

```bash
npx remotion render FibreOptic-Blue         out/FibreOptic_Blue_4K.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render FibreOptic-Multicolour  out/FibreOptic_Multicolour_4K.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render DataBlockCity           out/DataBlockCity_4K.mp4           --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render GrowingFibres-BluePink  out/GrowingFibres_BluePink_4K.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render GrowingFibres-GreenGold out/GrowingFibres_GreenGold_4K.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

For an editing master, add `--codec=prores --prores-profile=4444` and drop
`--crf` / `--pixel-format`. For an alpha-free overlay, Screen/Add on black works
just as well.

720p previews, as delivered:

```bash
npx remotion render <id> out/<name>.mp4 --scale=0.3333333333333333 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

`--scale=0.3333333333333333` produces exactly 1280×720; this was checked with ffprobe.

## Stills (6000×3375)

```bash
npx remotion still FibreOptic-Blue out/FibreOptic_Blue_6K.png --frame=200 --scale=1.5625 --gl=angle
```

Swap in any composition id and frame. 3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375.
The canvases render natively at the scaled size; it is not an upscale. These
6K stills were not rendered here.

## How each look is built

### 1. Fibre Optic Macro (PixiJS 8)

- **Fibres.** There are 2,500 fibres. Each is a 3D quadratic curve rising from
  a bundle below frame, and the data is built once at module level in
  `Float32Array`s (`src/fibre/data.ts`).
- **Projection.** Every frame, the tips and three segments of each strand are
  projected from 3D in JS. The bundle has a slight lean, so the tip edge climbs
  towards the top-right, as in the reference.
- **Tips.** Each tip is a `Particle` in a `ParticleContainer`. Its texture is
  one of 8 pre-computed bokeh discs, from a near-sharp point to a wide
  flat disc. The disc is chosen by its circle of confusion, which comes from
  the distance to a shallow focus plane, plus a tilted-focus term so that the
  lower part of frame (nearer the lens) is more blurred. As discs grow, their
  alpha drops roughly in proportion to their area.
- **Strands.** Strands are long, soft, stretched sprites in a second
  `ParticleContainer`. Their width also follows the circle of confusion.
- **Float pipeline.**
  - The scene renders additively into an `rgba16float` render texture.
  - A custom `Filter` (`src/fibre/postFilter.ts`) reads that texture directly,
    not the 8-bit copy Pixi would normally make.
  - The filter adds the navy-to-black background and a faint glow from the
    bundle, all in float.
  - It then tone-maps per channel, so the hottest overlaps roll from the
    palette colour to white.
  - Finally it adds grain and dither driven by a `uFrame` uniform.
- **Tip brightness precision.** Each particle's brightness is encoded across
  both its 8-bit tint and its 8-bit alpha, which gives about 16-bit precision.
  The twinkle on dim discs therefore doesn't step.
- **Pixi setup.**
  - `preference: 'webgl'`, `autoStart: false`, `preserveDrawingBuffer: true`.
  - The ticker is stopped.
  - Init and texture creation run inside `delayRender` / `continueRender`.
  - There is exactly one `app.render()` (to the screen) per Remotion frame, in a
    layout effect.
- **Pixi shader gotcha.** A custom Pixi v8 shader must contain `#version 300 es`.
  Otherwise Pixi compiles it as GLSL ES 1.00, and integer hashes silently fail
  to compile.

### 2. Data Block City (three.js)

- **City layout.** One city tile is generated at module level and repeated on
  a skewed lattice (`src/city/data.ts`). Over the 600 frames the camera travels
  exactly one lattice vector: 26 cells forward and 10 cells sideways. Frame 600
  therefore sees exactly the same city as frame 0.
- **Geometry.** The scene uses a dark floor (so the trenches read as deep,
  near-black gaps) and four instanced meshes:
  - blocks, with panel seams and side ribs drawn in the shader;
  - emissive glow tiles, some of them blinking;
  - soft vertical light beams, camera-facing, that rise **only from lit
    tiles**. Each beam starts at its tile's centre, takes the tile's colour
    and blinks with it. Beams are brightest at the base, fade smoothly to
    nothing, and some carry a slow soft pulse;
  - pinpoint sparkles.

  The camera is about 27° above the board, yawed 30° to the grid with a slight
  roll, so blocks run diagonally across frame.
- **Render chain.** Rendering is manual (`useFrame` with priority 1, reading
  only the Remotion frame):
  - a sky pass, then the scene into a 4×MSAA half-float target, with HDR colour
    in RGB and view distance in alpha;
  - a gather depth-of-field pass driven by circle of confusion;
  - bloom (13-tap downsample chain and tent upsample);
  - tone-mapping, then about 2% grain and ±1/255 dither.

### 3. Growing Fibre Strands (three.js)

- **Strands.** There are 284 root strands in ten overlapping, outward-splaying
  clumps across the full width. Another 104 branches split off near the top,
  for 388 in total.
- **Per-frame shape.** Every frame, each strand's visible polyline is evaluated
  in closed form (`src/strands/data.ts`):
  - growth = an eased function of `(frame − start) / duration`, seeded per strand;
  - sway = slow sines of the frame.

  The polyline is then written into a single ribbon mesh.
- **Heads.** Heads are instanced sprites at the growth fronts. They twinkle
  once the field is grown.
- **Post.** The post chain is bloom plus a wide blue haze that is masked to
  the lower part of frame. The final pass adds no grain. Dither is applied only
  where there is visible signal, and anything below half a code value is
  clamped to black.
- **Timeline.**

  | Frames  | What happens                                                        |
  |---------|---------------------------------------------------------------------|
  | 0–30    | Black                                                               |
  | 20–300  | Strands grow in from below frame, bundle by bundle                  |
  | 300–450 | Fully grown, swaying, heads twinkling; the top quarter of frame stays exactly black |

## Determinism

- **Seeded data.** Every random value comes from `mulberry32`, seeded at module
  level. `Math.random()` is never used.
- **No hidden state.** There is no `Date.now()`, no R3F clock or delta, no
  `useState` driving visuals, no stepped simulation, and no TAA or history
  buffers. React state is used only for Pixi's "ready" flag.
- **Loop phases.** All periodic terms have whole-number cycles per 600 frames.
  The loop phase is reduced modulo 600 in float64 before it reaches the GPU,
  which also covers the grain seed.
- **Diagnostic prop.** `noWrap: true` turns that reduction off, so you can test
  that the cycles themselves are whole. See the checks below.

## Adding a colourway

1. Add a row to the right table in `src/palettes.ts`
   (`FIBRE_OPTIC_PALETTES`, `DATA_CITY_PALETTES` or `GROWING_FIBRES_PALETTES`).
   One row holds all the colours and gains for one version.
2. Add a `<Composition>` in `src/Root.tsx` that passes the new row's key as
   `palette`. Copy the existing entry for that look.

For example, a red fibre-optic version needs a row such as
`Red: { mode: "mono", tip: "#FF4F5A", strand: "#B81C2A", ... }` plus a
`FibreOptic-Red` composition.

## Measured render times and 4K estimate

Measured in this sandbox: 4 vCPU, **no GPU** (ANGLE → SwiftShader software
WebGL2), one render worker (`--concurrency=1`). Per-frame time is
`(time for N frames − time for 1 frame) / (N − 1)`, which removes browser
start-up and bundling.

| Composition                   | 720p (measured)  | 4K (measured)            |
|-------------------------------|------------------|--------------------------|
| Fibre Optic (PixiJS)          | **0.86 s/frame** | **4.1 s/frame**          |
| Data Block City (three.js)    | **3.5 s/frame**  | 12.6 s/frame (extra measurement) |
| Growing Fibres (three.js)     | **0.52 s/frame** | 3.7 s/frame (extra measurement)  |

Wall-clock times for the full 720p previews, with three workers on the same
4 cores (shared with other jobs at times): Fibre Blue 7.6 min, Fibre
Multicolour 8.9 min, City 34.7 min, Growing Fibres 3.0–4.5 min each.

**4K estimate, all five compositions:**

| Composition            | Calculation               | Time     |
|------------------------|---------------------------|----------|
| Fibre Optic, ×2        | 4.1 s × 600 × 2           | ≈ 82 min |
| Data Block City        | 12.6 s × 600              | ≈ 126 min |
| Growing Fibres, ×2     | 3.7 s × 450 × 2           | ≈ 55 min |
| **Total, one worker**  |                           | **≈ 4.4 h** |

- **This machine type:** expect roughly **3–3.5 h** with `--concurrency=3`.
  SwiftShader already uses several threads, so extra workers scale poorly.
- **Machine with a real GPU:** the scenes are fill-rate bound and run on the
  GPU there, so expect roughly **10–20× faster**: well under an hour for all
  five at 4K. This part is an estimate, not a measurement.

## Banding check

Grain and dither are a fixed integer hash (PCG) of pixel position and frame
(`src/lib/glsl.ts`); `Math.random()` is never used.

- **Dither:** ±1/255 TPDF, applied after tone mapping in every look. In
  Look 3 it is applied only where there is signal; black stays exactly 0.
- **Grain:** about 2% in Looks 1 and 2, none in Look 3.

**Checked on decoded frames of the encoded mp4s, not on the PNG renders:**

- **Fibre Optic 1A / 1B** (navy background and bokeh glow, frame 200) and
  **City** (distant haze band, frame 150): rows of pixel values across the
  glows and gradients were read and contrast-stretched (×8–10).
- **Result:** smooth, with grain texture and no contour steps. The longest
  plateaus in the haze are 4–9 px.

**An encoder problem found and fixed along the way:**

- **Symptom:** at default x264 settings (CRF 16), the deep-navy gradient in
  Look 1 came out with 1-level contour bands. The PNGs were smooth; the bands
  appeared only after encoding.
- **Cause:** in saturated dark blues most of the gradient lives in the 4:2:0
  chroma planes. x264's coarse chroma quantiser and deadzones threw away the
  small chroma variation.
- **Fixes, both in this project:**
  1. Grain has a per-channel part generated on 2×2 blocks, so it survives
     chroma subsampling.
  2. `remotion.config.ts` passes
     `-x264-params deadzone-inter=0:deadzone-intra=0:no-dct-decimate=1:chroma-qp-offset=-6:aq-mode=3`
     to every H.264 encode. CRF is still 16.
- **Side effect:** the files are about twice the size.
- **ProRes/4444 masters** are not affected by this problem.

## Completion checklist

**Step 1: file checks (ffprobe).** All five previews pass: 1280×720, 30/1,
h264, yuv420p, no audio stream. Durations: 20.0 s (Looks 1–2), 15.0 s
(Look 3).

**Step 2: loop check (601-frame version, frames 0 vs 600).** Passes.

| Composition  | As delivered        | Phase reduction off (`noWrap`)                    |
|--------------|---------------------|---------------------------------------------------|
| 1A, 1B       | Identical           | Also identical                                    |
| City         | Identical           | 52 isolated pixels differ by >2 levels (float sub-pixel jitter); no missing geometry |

So the camera's travel really is one lattice period.

**Step 3: black check (decoded mp4).** Passes for 3A and 3B.
- Frames 0–28 are exactly 0,0,0; the first light is at frame 29.
- The top 25% of frame is 0,0,0 in all 450 frames.
- No lift from encoding.

**Step 4: same result every time.** Passes for all five. Frame 200 rendered
alone from a cold start is byte-identical to frame 200 from a multi-threaded,
out-of-order sequence render (24–60 frames around it).

**Step 4: banding.** Passes for 1A, 1B and City; see above.

**Step 5: content.** Passes; five evenly spaced frames per preview were
reviewed.
- **Fibre Optic:** a fan of fibres with mostly soft bokeh tips and sharp tips
  along the top edge; sway, twinkle and focus breathing. 1B shows multicoloured,
  hue-drifting tips.
- **City:** a diagonal grid of blocks with square glow tiles, beams and
  sparkle dust; a gliding camera; blur and haze in the distance.
- **Growing Fibres:** strands grow up from the bottom with glowing heads, then
  sway and twinkle. 3B is green-gold.

**Steps 6–7: visual match.** Three rounds per look, each with fresh comparison
agents; Look 3 was compared at mid-growth and fully grown. The final round used
frames from the encoded previews.

**Delivery checks.**
- **Pinned versions:** `package.json` pins exact versions, and
  `package-lock.json` is included.
- **Clean copy:** `npm install && npx remotion studio` was run from a copy
  without `node_modules`. The Studio builds and serves, and all five
  compositions are listed at 3840×2160, 30 fps.

**Spec items not followed:** none. Two reference features were deliberately
**not** copied because the spec overrides them, for Growing Fibres:
1. The reference's navy background: the spec requires pure black.
2. Strands reaching the top of frame: the spec says the lower two-thirds, with
   the top area black.
