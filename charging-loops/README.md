# Blade Ring · Plate Arc · Segment Torus · Charge Icon · Charge Gauge

One Remotion project, five looks, eight compositions (3840×2160, 30 fps).

| Composition id | Output name | Look | Engine | Length |
|---|---|---|---|---|
| `BladeRing-Blue` | `BladeRing_Blue` | 1A, as reference | three.js / WebGL2 | 600 f loop |
| `BladeRing-Copper` | `BladeRing_Copper` | 1B | three.js / WebGL2 | 600 f loop |
| `PlateArc-Blue` | `PlateArc_Blue` | 2, as reference | three.js / WebGL2 | 600 f loop |
| `SegmentTorus-BlueCoral` | `SegmentTorus_BlueCoral` | 3A, as reference | three.js / WebGL2 | 600 f loop |
| `SegmentTorus-TealGold` | `SegmentTorus_TealGold` | 3B | three.js / WebGL2 | 600 f loop |
| `ChargeIcon-Cyan` | `ChargeIcon_Cyan` | 4A, as reference | PixiJS 8 / WebGL2 | 600 f loop |
| `ChargeIcon-GreenFill` | `ChargeIcon_GreenFill` | 4B | PixiJS 8 / WebGL2 | 600 f loop |
| `ChargeGauge-Story` | `ChargeGauge_Story` | 5 | Canvas 2D + CSS 3D | 300 f story |

Remotion ids may not contain `_`, so the ids use `-` and the output files use `_`.

## Setup

```bash
npm install
npx remotion studio
```

Node 18+ is required (tested on Node 22). Every dependency is pinned in `package.json`.

## Chromium GL flag

The WebGL looks (1–4) need ANGLE. This is set in `remotion.config.ts`:

```ts
Config.setChromiumOpenGlRenderer("angle"); // = --gl=angle
```

When you render through the Node APIs (which ignore the config file), pass
`chromiumOptions: { gl: "angle" }`. On a machine without a GPU, ANGLE falls back to
SwiftShader. That works and is deterministic, but it is slow (see the timings below).

`remotion.config.ts` also sets PNG intermediate frames, H.264, `yuv420p` and CRF 16.

## 4K render commands

```bash
npx remotion render BladeRing-Blue          out/BladeRing_Blue.mp4
npx remotion render BladeRing-Copper        out/BladeRing_Copper.mp4
npx remotion render PlateArc-Blue           out/PlateArc_Blue.mp4
npx remotion render SegmentTorus-BlueCoral  out/SegmentTorus_BlueCoral.mp4
npx remotion render SegmentTorus-TealGold   out/SegmentTorus_TealGold.mp4
npx remotion render ChargeIcon-Cyan         out/ChargeIcon_Cyan.mp4
npx remotion render ChargeIcon-GreenFill    out/ChargeIcon_GreenFill.mp4
npx remotion render ChargeGauge-Story       out/ChargeGauge_Story.mp4
```

For a 720p preview, add `--scale=0.3333333333333333`, which gives exactly 1280×720.

## 6K still command (6000×3375)

6000 / 3840 = 1.5625 exactly, so:

```bash
npx remotion still BladeRing-Blue out/BladeRing_Blue_6K.png --frame=120 --scale=1.5625
```

Replace the id and frame for the other compositions. 6K stills were not rendered here.

## How it is built

- `src/versions.ts` has **one data row per version**. `src/Root.tsx` turns each row
  into a composition.
- **Looks 1–3** (`src/blade`, `src/plate`, `src/torus`) use `@remotion/three`'s
  `ThreeCanvas` with a custom render hook (`src/three/ThreeLook.tsx`). Each frame:
  - the scene renders into an MSAA half-float target;
  - a final pass (`src/three/post.ts`) applies a fixed-kernel gather depth of field,
    a fixed-kernel bloom, ACES tone mapping, sRGB, a vignette, grain and ±1/255 dither.
  - The R3F `useFrame` callback is used only as the hook that replaces R3F's default
    render. Its clock and delta are ignored, and the frame comes from
    `useCurrentFrame()`.
  - There is no TAA, no accumulation and no shadow accumulation.
- **Look 4** (`src/chargeicon`) is PixiJS 8, with `preference: "webgl"` and no ticker.
  The stage is rendered by hand once per Remotion frame.
  - The data field is about 14k blocks per container, in `ParticleContainer`s of 1×1
    white texture particles, plus a near layer, a blurred far layer and a blurred haze
    layer.
  - The post filter (vignette, grain, dither) is a custom GLSL filter.
- **Look 5** (`src/gauge`) is drawn with Canvas 2D on a flat 2400×1600 design plane. It
  is shown through a CSS 3D transform, with a blurred copy masked in for the focus
  falloff and a screen-blended bloom copy. The background canvas computes the radial
  lift, dither and grain per pixel from a hash.
- **Font:** Exo 2 SemiBold (`public/fonts/Exo2-SemiBold.woff2`), SIL OFL 1.1, licence
  in `public/fonts/OFL.txt`. It is loaded once through `FontFace`, gated with
  `delayRender`. Look 4 has no text. There are no logos or brand names; the battery
  pictogram and the leaf are drawn in code.

### Determinism

Every value on screen is a function of `useCurrentFrame()`:

- seeded `mulberry32` runs at module level;
- flicker, glitch frames and grain are hashes of (id, frame bucket) or (pixel, `frame % 600`);
- there is no `Math.random()`, `Date.now()`, `useState`-driven visual or carried state.

The loops are exact by construction:

- Blade Ring and Plate Arc turn by exactly 3 pitches per 600 frames. Their angles use
  integer arithmetic, `(i*600 + 3*frame) mod (600*count)`, so frame 600 is
  bit-identical to frame 0 with the instances relabelled.
- The torus gradient phase and camera path are periodic in `frame % 600`.
- Look 4's cluster depths advance by a whole number of wraps per loop.
- Look 4's HUD arcs turn 90° per loop, with a 90°-periodic pattern.

### Add a colourway

Add one row to `VERSIONS` in `src/versions.ts`, for example:

```ts
{ look: "bladeRing", id: "BladeRing-Violet", strip: "#7A4AFF", rim: "#C0A0FF", base: "#0C0618" },
```

It appears in the Studio as a new composition. Render it with
`npx remotion render BladeRing-Violet out/BladeRing_Violet.mp4`.

### Tuning hook

Every composition accepts an optional `tune` prop that overrides look parameters
(see `BLADE_PARAMS`, `PLATE_FRAMING` and `TORUS_PARAMS`). This is how the framing was
matched to the references. For example:

```bash
npx remotion still BladeRing-Blue out/t.png --frame=120 --scale=0.3333333333333333 --props='{"tune":{"elev":44}}'
```

`--props='{"loopCheck":true}'` makes a loop 601 frames long, for the frame-0 vs
frame-600 check.

## Deviations from the brief (on purpose, from the reference comparisons)

The brief's numbers were followed unless the side-by-side checks against the reference
clips showed a clear mismatch. In those cases the reference won:

- **Blade Ring:** 24 slabs (not 30) of 1 × 1.1 × 0.15, yawed 6° (not 25°) and seen
  from 40° (not 50°).
  - 30 slabs at 25° read as packed dominoes; the reference has about 24 upright slabs
    with gaps.
  - The loop still turns exactly 3 pitches: 45° per 600 frames.
- **Plate Arc:** 30 plates (not 48), 1.7 units wide on the radius-2.4 ring.
  - The reference shows about 14 plates over half a turn, each about 0.75 of the ring
    radius.
  - The loop turns 3 pitches (36°).
- **Segment Torus:** 40 segments (not 64), minor radius 1.05 (not 0.85).
  - The reference has fat slices; 64 thin ones read as a ribbed hose.
  - The warm colour gathers on the hole-facing side, as in the reference, while the
    A→B→A gradient still travels one lap per loop.
- **Charge Icon:** the battery body is about 50% of the frame height × 14.5% of the
  width (not 22% × 12%), matching the reference.
  - The HUD arc radii keep the brief's ratio to the icon.
  - They are drawn very faint, because the reference shows almost none.
- **Charge Gauge:** the tilt is `rotateZ(9°) rotateY(−46°→−40°) rotateX(14°)` at
  2600 px perspective in the 4K layout, not −28°/8° at 1600 px. The reference is
  noticeably more oblique.
  - The chevrons are kept because the brief asks for them, although the 95 % reference
    frame doesn't show them.

## Measured render times

Measured in this build container: 4 vCPU, **no GPU**, so WebGL runs on SwiftShader
through ANGLE. Per-frame cost = (4-frame sequence render − 1-frame cold still) ÷ 3,
both at `--concurrency=1`, which removes browser start-up from the figure.

| Composition | 720p s/frame | 720p 40 frames at `--concurrency=4` (wall) |
|---|---|---|
| BladeRing-Blue | 1.95 | 80 s |
| BladeRing-Copper | 1.79 | 75 s |
| PlateArc-Blue | 1.54 | 65 s |
| SegmentTorus-BlueCoral | 1.38 | 49 s |
| SegmentTorus-TealGold | 1.15 | 51 s |
| ChargeIcon-Cyan | 1.28 | 45 s |
| ChargeIcon-GreenFill | 1.39 | 47 s |
| ChargeGauge-Story | 1.30 | 43 s |

On this box, concurrency barely helps the WebGL looks, because SwiftShader already
uses every core.

**Two real 4K frames (3840×2160):**

| Composition | Cold 4K still, incl. browser start | 4K s/frame (warm) |
|---|---|---|
| BladeRing-Blue (1A) | 28.4 s | **12.3 s** |
| ChargeIcon-Cyan (4A) | 15.2 s | **9.3 s** |

**4K estimates for a full render:**
- **On this kind of CPU-only machine:** scale the 720p figure by the measured
  4K/720p ratio, 6.3× for the three.js looks and 7.3× for Pixi and Canvas.

  | Composition | Frames | Estimated time |
  |---|---|---|
  | 1A | 600 | ≈ 2.1 h |
  | 1B | 600 | ≈ 1.9 h |
  | 2 | 600 | ≈ 1.6 h |
  | 3A | 600 | ≈ 1.4 h |
  | 3B | 600 | ≈ 1.2 h |
  | 4A | 600 | ≈ 1.6 h |
  | 4B | 600 | ≈ 1.7 h |
  | 5 | 300 | ≈ 0.8 h |

- **On a machine with a real GPU** (ANGLE on hardware), expect roughly 10–30× faster
  for Looks 1–4, so about 5–15 minutes each. That is an estimate, not measured here.
  The gauge is mostly CPU: per-pixel background and grain plus CSS blur, so it gains
  less.

## Reference comparison

Looks 1A, 2, 3A, 4A and 5 were compared with their reference clips over three rounds.
Each round used a fresh, independent agent that saw only two frames and a neutral
"list every difference" instruction. The fixes were carried over to 1B, 3B and 4B.
The deviations above are the main results. Round 3 flagged details that contradicted
earlier rounds, such as lit faces vs dark faces, plump vs thin slices, and blurred vs
sharp blocks. Those were settled by judgement, not by a fourth round.

## Checks

All of these were run on the final code, at 720p (`--scale=0.3333333333333333`,
exactly 1280×720). Per the latest instructions no preview videos were rendered, so
the checks use stills and PNG sequences.

- **Loop (7 loops):** with `--props='{"loopCheck":true}'` (601 frames), frames 0 and
  600 are **pixel-identical** for every loop.
- **Determinism (all 8):** frame 300 (150 for the gauge), rendered cold with
  `remotion still`, is **byte-identical** to the same frame from a 40-frame PNG
  sequence rendered at `--concurrency=4`, with frames out of order across tabs.
- **Banding:** each still was encoded as one-frame H.264 `yuv420p` CRF 16, decoded,
  and inspected at ×8 / ×16 gain.
  - Looks 1–2: the background black is exact 0, with no grain or dither in it
    (35 % / 60 % of the pixels are exactly 0).
  - Torus shadows and the Look 4 dark space are smooth.
  - The gauge's radial lift first showed a faint tinted contour. It was a chroma step,
    because the dither was shared across R, G and B.
  - Fix: independent per-channel dither everywhere (three.js post, Pixi post, gauge
    background), and the gauge background now uses the full 1.5 % grain.
  - **Residual:** at ×16 gain, one faint 1-level chroma contour remains in the
    gauge's near-black lift. It is the H.264 encoder's chroma quantisation on
    16-px blocks, not the source PNG, and it isn't visible at normal gain.
  - If it matters at 4K, encode with a lower chroma QP (for example
    `-x264-params chroma-qp-offset=-4`) or with `-tune grain` in your own ffmpeg
    pass.
- **What each composition shows:** five-frame contact sheets were checked.
  - Blade Ring: rotation.
  - Plate Arc: plates sliding along the arc.
  - Torus: lit / dim / wide beats, with the gradient travelling.
  - Charge Icon: blocks flying and flickering, HUD arcs.
  - 4B: fill, flash and reset, twice per loop.
  - Gauge: 6 → 22 → 56 → 87 → 100 %, Power bars in step, flash at 100 %.
  - No brand names anywhere; "ECO Mode" and "Power" are spelled correctly.
- **Percentage:** it starts at 5, reaches 100 at frame 270 (9.0 s), never steps
  backwards, and moves at most 1 % per frame (checked over all 300 frames from
  `percentAt`).
- **Clean install:** a copy without `node_modules` passes `npm install && npx remotion
  studio`, and the Studio builds and serves.

### Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps; 600-frame loops and a 300-frame story
- [x] One data row per version (`src/versions.ts`)
- [x] three.js / WebGL2 for Looks 1–3; PixiJS 8 / WebGL2, no ticker, for Look 4;
  Canvas 2D for Look 5
- [x] Everything is driven by `useCurrentFrame()`, with no runtime `Math.random()`
- [x] Loops exact (frame 0 = frame 600)
- [x] Cold frame = full-render frame, byte for byte
- [x] OFL font with its licence; no logos or brand names
- [x] Dither and grain (fixed hash of pixel + `frame % 600` / `% 300`); grain fades to
  zero near black in Looks 1–2
- [x] 720p still of each composition
- [ ] 720p preview videos: not rendered, as requested
- [ ] 4K videos and 6K stills: not rendered here, as the brief asked
