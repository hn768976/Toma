# Generate Button · Fibre Ribbon · Cube Network · Padlock Fields

One Remotion project, four looks, eight compositions. All compositions are
defined at **3840×2160, 30 fps**.

| Composition id | Look | Engine | Length | Deliverable name |
|---|---|---|---|---|
| `GenerateButton-Circuit` | 1A, 2D story | Canvas 2D | 450 f (15 s) | `GenerateButton_Circuit.mp4` |
| `GenerateButton-Waveform` | 1B, 2D story | Canvas 2D | 450 f (15 s) | `GenerateButton_Waveform.mp4` |
| `GenerateButton-CircuitWarm` | 1C, 2D story | Canvas 2D | 450 f (15 s) | `GenerateButton_CircuitWarm.mp4` |
| `FibreRibbon-Blue` | 2A, 3D loop | three.js / WebGL2 | 600 f (20 s) | `FibreRibbon_Blue.mp4` |
| `FibreRibbon-Violet` | 2B, 3D loop | three.js / WebGL2 | 600 f (20 s) | `FibreRibbon_Violet.mp4` |
| `CubeNetwork-Blue` | 3, 3D loop | three.js / WebGL2 | 600 f (20 s) | `CubeNetwork_Blue.mp4` |
| `PadlockField-TopDownOrange` | 4A, 3D loop | three.js / WebGL2 | 600 f (20 s) | `PadlockField_TopDownOrange.mp4` |
| `PadlockField-FlyOverCyan` | 4B, 3D loop | three.js / WebGL2 | 600 f (20 s) | `PadlockField_FlyOverCyan.mp4` |

`PadlockModelCheck` is a one-frame development composition (one padlock on its
ring), used for the model check. It is not a deliverable.

## Setup

```bash
npm install
npx remotion studio        # preview
```

Versions are pinned in `package.json` (Remotion 4.0.515, three 0.180.0,
@react-three/fiber 9.3.0, React 19.2.3).

### Chromium GL flag

The three.js looks need WebGL2 in headless Chromium. Use ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets this (`Config.setChromiumOpenGlRenderer("angle")`),
plus PNG intermediate frames, H.264, `yuv420p` and CRF 16. On a machine with a GPU,
ANGLE uses it; without one it falls back to SwiftShader (slow, but identical
output logic). WebGPU is not used.

## Render at 4K

The output is 3840×2160, H.264, `yuv420p`, 30 fps, CRF 16, with no audio:

```bash
npx remotion render GenerateButton-Circuit      out/GenerateButton_Circuit.mp4      --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render GenerateButton-Waveform     out/GenerateButton_Waveform.mp4     --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render GenerateButton-CircuitWarm  out/GenerateButton_CircuitWarm.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render FibreRibbon-Blue            out/FibreRibbon_Blue.mp4            --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render FibreRibbon-Violet          out/FibreRibbon_Violet.mp4          --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render CubeNetwork-Blue            out/CubeNetwork_Blue.mp4            --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render PadlockField-TopDownOrange  out/PadlockField_TopDownOrange.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render PadlockField-FlyOverCyan    out/PadlockField_FlyOverCyan.mp4    --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
```

On a GPU machine, add `--concurrency=<n>` to taste. Every frame is a pure
function of its frame number, so any concurrency gives identical frames.

720p preview of any composition: add `--scale=0.3333333333333333`, which gives
exactly 1280×720.

## Stills (6000×3375)

`--scale=1.5625` turns 3840×2160 into exactly 6000×3375:

```bash
npx remotion still <CompositionId> out/<CompositionId>_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Frame 300 is after the reveal for the stories and mid-loop for the loops. Any
frame works.

## Measured render times

Measured on the build machine: 4 CPU cores, **no GPU**. WebGL2 ran on
SwiftShader through ANGLE. Each figure is one tab (`--concurrency=1`): the time
of an 11-frame render minus a 1-frame render, divided by 10, so start-up is
excluded. `scripts/time-render.sh` reproduces it.

| Composition | 720p, s/frame (measured) | 4K, s/frame (estimate) | 4K whole clip, 1 tab (estimate) |
|---|---|---|---|
| GenerateButton-Circuit | 0.17 | ~1.5 | ~11 min |
| GenerateButton-Waveform | 0.18 | ~1.5 | ~11 min |
| GenerateButton-CircuitWarm | 0.24 | ~1.6 | ~12 min |
| FibreRibbon-Blue | 1.92 | ~13 | ~2.2 h |
| FibreRibbon-Violet | 1.83 | ~13 | ~2.2 h |
| CubeNetwork-Blue | 1.72 | ~12 | ~2.0 h |
| PadlockField-TopDownOrange | 2.41 | ~17 | ~2.8 h |
| PadlockField-FlyOverCyan | 5.01 | **~35 (timed)** | ~5.8 h |

**Timed 4K frame, 4B** (reflection pass, fog, DoF, bloom): a 3840×2160 still of
frame 300 took 46.5 s in total, including about 11 s of bundling and browser
start-up, so roughly **35 s for the frame itself** on SwiftShader. That is about
7× the 720p frame, and I used the same factor to estimate the other three.js
looks. The Canvas 2D stories scale less than the pixel count because a fixed
share of their cost does not grow with resolution.

On a machine with a real GPU, ANGLE renders the three.js looks far faster, and
several tabs can run in parallel (`--concurrency`). These CPU-only numbers are
the worst case. On a slow CPU-only machine, add `--timeout=600000`, because
SwiftShader frames of the padlock looks can exceed Remotion's default 30 s
`delayRender` timeout when several tabs run at once.

## How it is built

- **`src/data.ts`**: one data row per version (colours, seed, button word).
  `src/Root.tsx` registers every row as a composition.
- **Look 1 (`src/generate/GenerateButton.tsx`)** is Canvas 2D, with no GPU and no
  PixiJS.
  - The bright layer (traces, bars, ticks, squares, button glow) is drawn a
    second time into a quarter-resolution canvas. It is blurred with two canvas
    filters (tight and wide) and added back with `lighter`. No per-shape
    `shadowBlur` is used.
  - Last comes a per-pixel pass. It adds a ±1/255 noise-tile dither (a fixed
    64×64 tile, offset by the frame) and about 1.5% grain from a hash of
    (x, y, frame % 450). Both are applied only where the pixel is brighter than
    about 2%, so pure black stays black.
  - The canvas backing store follows the render scale, so a 720p render does
    not draw 4K.
- **Looks 2–4** are three.js on WebGL2, inside `@remotion/three`'s
  `ThreeCanvas`, with a custom post pipeline in `src/lib/post.ts`. The scene
  renders into an HDR MSAA target with a depth texture, then:
  1. a CoC tile-max pass;
  2. a **non-temporal** DoF gather (a fixed 64-tap Vogel disk; depth fog is
     applied per tap for 4B);
  3. a mip-chain bloom;
  4. ACES tonemapping and the vignette;
  5. sRGB conversion;
  6. 1.5% grain from an integer hash of (pixel, frame % 600), and a ±1/255
     triangular dither as the very last step.

  There is no TAA and there are no history buffers.
- **Thin lines** (fibres, network lines) are camera-facing strips
  (`src/lib/strips.ts`). Their width is in world units with a minimum pixel
  width, so they stay anti-aliased at any resolution. A depth-only pre-pass
  gives the DoF their real depth while the glow is drawn additively.
- **The padlock** (`src/padlock/padlockModel.ts`) is built in code from:
  - a bevelled rounded body;
  - a front plate extruded from a shape with a keyhole hole;
  - a dark keyhole insert;
  - a raised rim (escutcheon) around the keyhole;
  - a shackle that is an exact straight-leg / half-circle / straight-leg tube.

  The material is a satin clearcoat plastic. The rings are a shader on an
  instanced quad. The floor is a Canvas 2D tiling texture with a planar
  reflection (mirrored camera, blurred) and light streaks along the grid lines.

### Determinism

Every value on screen comes from `useCurrentFrame()`:

- All seeded data comes from `mulberry32` with fixed seeds.
- There is no `Math.random()`, no `Date.now()`, and no `useState` driving
  visuals.
- R3F's clock is never read. `useFrame(…, 1)` is only the hook that replaces
  R3F's own render call.
- The cube draw order is re-sorted from scratch every frame.

### Loops

Every loop moves the camera exactly one layout period in 600 frames. Every
cyclic motion (pulses, sparkles, ring rotation, streaks, texture scroll, cube
wobble, camera sway) makes a whole number of cycles in that time and is
indexed by position mod period. Frame 600 is therefore identical to frame 0.

## Checks (scripts/)

```bash
REMOTION_LOOP_CHECK=1 …            # makes loop compositions 601 frames long
scripts/loop-check.sh <ids…>        # frame 0 vs 600, pixel for pixel
scripts/determinism-check.sh <id> <frames…>   # cold still vs multi-threaded range render
scripts/contact-sheet.sh <id> <duration>      # 5 evenly spaced frames
scripts/verify-all.sh               # all of the above for all 8
```

### Results of the last run (all at 720p)

| Check | Result |
|---|---|
| Size of `--scale=0.3333333333333333` | exactly 1280×720 (checked on every still) |
| Loop: frame 0 vs frame 600 (601-frame build) | **identical pixel for pixel** for all 5 loops |
| Cold still vs multi-tab range render, frame 300 | **byte-identical** for all 8 |
| Same, frames 45 (click) and 110 (mid-reveal), stories | **byte-identical** for all 3 |
| Contact sheets, 5 frames each (`out/sheets/`) | content as specified |
| Motion: mean frame-to-frame change, 1A frames 0–120 and 2A/4B frames 270–330 | no spikes; the only step outlier in 1A is the intended click flash at frame 42 |

### Banding check

`scripts/banding-check.py` encodes a still to H.264 `yuv420p` CRF 16, decodes
it, and reads 5×5-averaged values along a line. A smooth gradient changes by
fractional levels with no flat runs.

- **4B fog sky** (x=640, top to horizon): B goes 70→135 in steps of 0–2.6
  levels, with no plateaus.
- **Fibre Ribbon dark background**: flat at 1–3, with dither noise only.
- **Generate Button navy haze**: B falls 17.1 → 14.3 → 12.5 → … → 4.3 (row
  means) with no plateaus. Pure-black corners stay 100 % (0,0,0).
- The 3D looks dither ±1/255 (triangular) as the very last shader step, after
  DoF, bloom and tonemapping. The Canvas look dithers every non-black pixel
  from a fixed 64×64 tile offset by the frame. Grain is a fixed hash of
  (pixel, frame % loop), and `Math.random()` is never used.

### Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps; stories 450 frames, loops 600 frames
- [x] Generate Button is Canvas 2D (no GPU, no PixiJS); the rest is three.js on
      WebGL2 via `@remotion/three`, using `--gl=angle`
- [x] Poppins SemiBold (OFL) bundled and loaded with `delayRender` before the
      first frame
- [x] Only text: "Generate", plus 0/1 digits drawn as shapes; no logos; the
      cursor and sparkle are drawn in code
- [x] One data row per version (`src/data.ts`)
- [x] Seamless loops (whole-cycle motion, camera moves exactly one period)
- [x] Deterministic: there is no `Math.random`, `Date.now`, R3F clock or TAA,
      and a cold frame equals the range-render frame
- [x] Non-temporal DoF; bloom; vignette; grain about 1.5 % and dither last
- [x] Padlock model check run with fresh sub-agents (2 rounds)
- [x] 720p measured per composition; one real 4K frame of 4B timed
- [x] 720p PNG still of each composition. Previews were not rendered, as
      requested.

## Add a colourway

1. Copy a row in `src/data.ts`, for example a `FIBRE_ROWS` entry.
2. Give it a new `id`, for example `"FibreRibbon-Gold"`.
3. Change the hex colours. Keep the same `seed` to keep the same layout, or
   change it for a new one.

Root registers the row automatically. Render it with its new id.

## Change the button word

Edit `label` on the `GENERATE_ROWS` entries in `src/data.ts`, for example
`label: "Create"`. The sparkle and the word are measured and centred as a
group, so any word length works. The word is set in the bundled Poppins
SemiBold (SIL OFL 1.1, `public/fonts/`), which `delayRender` loads before the
first frame. Only Latin glyphs are bundled.

## Notes

- Reference clips are not included. During development they lived in `refs/`,
  which is git-ignored and excluded from the zip.
- The only text in any frame is the button word and the `0`/`1` digits on the
  cubes. The digits are drawn as shapes, not with a font. There are no logos
  or brand marks; the cursor and sparkle are drawn in code.
