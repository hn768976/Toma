# Nerve Fibres · Bokeh Burst · Cosmic Whirl · Smoke Orb · Glass Knot

Eight seamless 20 s loops (600 frames, 30 fps, 3840×2160) in one Remotion project.
Everything is built in code: no footage, photos, text, logos or brands.

| # | Composition id | Output file | Look | Engine |
|---|----------------|-------------|------|--------|
| 1 | `NerveFibres-Red` | `NerveFibres_Red.mp4` | 3D fibre web, glossy hero fibres, ring-sheathed bead chains, glowing tips | three.js (`@remotion/three`) |
| 2 | `NerveFibres-Blue` | `NerveFibres_Blue.mp4` | same, blue | three.js |
| 3 | `BokehBurst-Blue` | `BokehBurst_Blue.mp4` | bokeh cluster, 3 000 radiating streaks, haze | PixiJS 8 |
| 4 | `CosmicWhirl-Blue` | `CosmicWhirl_Blue.mp4` | full-frame spiral shader | fragment shader on a three.js plane |
| 5 | `SmokeOrb-PinkGold` | `SmokeOrb_PinkGold.mp4` | glowing sphere, 150 000 smoke particles | PixiJS 8, 3D projected in a vertex shader |
| 6 | `SmokeOrb-CyanBlue` | `SmokeOrb_CyanBlue.mp4` | same, cyan / blue | PixiJS 8 |
| 7 | `GlassKnot-Galaxy` | `GlassKnot_Galaxy.mp4` | glass trefoil filled with stars, galaxy behind | three.js |
| 8 | `GlassKnot-Nebula` | `GlassKnot_Nebula.mp4` | same, nebula behind | three.js |

> Remotion composition ids may only contain `a-z A-Z 0-9 -`, so the version
> `NerveFibres_Red` is registered as `NerveFibres-Red`. Output files keep the underscore.

The nerve-fibre look is a generic illustration (strands with segmented sheaths and glowing
ends). It makes no claim about any specific nerve, tissue or disease.

## Setup

```bash
npm install
npx remotion studio          # preview (the Studio renders the GL canvases at 1920x1080 for speed)
```

Node 18+ (tested with Node 22). All dependency versions are pinned in `package.json`.

## Chromium GL flag

All looks need **WebGL2**. `remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("angle")`,
which is the same as passing **`--gl=angle`** on the command line. Keep it for every render;
other GL backends are not reliable in headless Chromium. WebGPU is not used.

On a machine with a GPU, ANGLE uses it. Without one, ANGLE falls back to SwiftShader
(CPU), which works but is slow (see the timings below).

## 4K render commands (3840×2160, H.264, yuv420p, CRF 16, 30 fps)

`remotion.config.ts` already sets PNG intermediate frames, H.264, `yuv420p` and CRF 16.

```bash
npx remotion render NerveFibres-Red   out/NerveFibres_Red.mp4   --gl=angle
npx remotion render NerveFibres-Blue  out/NerveFibres_Blue.mp4  --gl=angle
npx remotion render BokehBurst-Blue   out/BokehBurst_Blue.mp4   --gl=angle
npx remotion render CosmicWhirl-Blue  out/CosmicWhirl_Blue.mp4  --gl=angle
npx remotion render SmokeOrb-PinkGold out/SmokeOrb_PinkGold.mp4 --gl=angle
npx remotion render SmokeOrb-CyanBlue out/SmokeOrb_CyanBlue.mp4 --gl=angle
npx remotion render GlassKnot-Galaxy  out/GlassKnot_Galaxy.mp4  --gl=angle
npx remotion render GlassKnot-Nebula  out/GlassKnot_Nebula.mp4  --gl=angle
```

Add `--concurrency=N` to taste. On a CPU-only machine, use 1–2: SwiftShader already uses every core.

### 720p previews (as delivered)

```bash
npx remotion render <id> out/<file>.mp4 --gl=angle --scale=0.3333333333333333
```

`--scale=0.3333333333333333` gives exactly 1280×720 (checked with ffprobe).

The delivered previews were rendered as Remotion PNG sequences at that scale (all 600 frames)
and encoded with
`ffmpeg -framerate 30 -i element-%03d.png -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -an`.
Keeping the PNGs is what made the byte-for-byte frame-300 check possible. The output settings
match what the `remotion render` command above produces.

### 6K stills (6000×3375)

```bash
npx remotion still <id> out/<file>_6K.png --gl=angle --frame=300 --scale=1.5625
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. Every size in the scenes is relative to the frame
height, so a 6K still is the same picture at higher resolution, not a crop.

## How to add a colourway (one data row)

Every version is one row in `src/variants.ts`. `src/Root.tsx` registers a composition for every
row automatically. To add, say, a green Nerve Fibres:

```ts
// src/variants.ts -> NERVE_VARIANTS
{
  id: "NerveFibres_Green",          // becomes composition "NerveFibres-Green"
  fibre: "#1AA84A", fibreSheen: "#8AF0A8", web: "#4A7A5A", haze: "#7AA08A",
  hazeGlow: "#D0F0D8", tip: "#E0FFE8", bead: "#A8F0C0", speck: "#E0ECE4",
},
```

The same applies to `BOKEH_VARIANTS`, `WHIRL_VARIANTS`, `SMOKEORB_VARIANTS` and `GLASSKNOT_VARIANTS`
(Glass Knot rows also choose `background: "galaxy" | "nebula"`).

## How the loops and determinism work

- Every animated value is a function of `loopPhase(frame) = (frame % 600) / 600` and nothing else.
  Motions use whole numbers of cycles per loop:
  - Nerve camera: travels exactly one repeat of its z-periodic fibre slab per loop, on a closed lateral path.
  - Bokeh: each streak makes a whole number of wraps per 600 frames.
  - Whirl: turns exactly one arm spacing (120° for 3 arms) per loop; noise is sampled on a time circle.
  - Smoke Orb: each particle slides along a precomputed curl-noise streamline as a periodic function
    of t, with a time-circle displacement field.
  - Glass Knot: turns exactly a third of a turn about its 3-fold symmetry axis; all contents are
    3-fold symmetric.
- All random layouts come from a seeded `mulberry32`. There is no `Math.random()`, no `Date.now()`,
  no clocks and no state carried between frames.
- three.js: `@remotion/three` advances the canvas once per Remotion frame. A priority-1 `useFrame`
  callback is used only as the render hook; it never reads R3F's clock or delta.
  PixiJS: there is no ticker; the stage is drawn manually once per Remotion frame.
- Textures and particle layouts are built once, behind `delayRender` / `continueRender`.
- No TAA and no accumulation buffers.
- `--props='{"loopCheck":true}'` makes any composition 601 frames long, for the frame 0 = frame 600 check.

## Banding countermeasures

- Scenes render into half-float (RGBA16F) targets. In PixiJS this needs a `BufferImageSource`-backed
  render texture: a plain `TextureSource` silently allocates RGBA8.
- The final pass adds ±1/255 triangular dither and ~1.5 % grain, both fixed hashes of (pixel, `frame % 600`).
- Smoke Orb fades the grain to zero below 3 % luminance and keeps true black at exactly 0.
- PNG (not JPEG) intermediate frames.

## Measured render times

Measured in this project's build environment: 4 vCPU, **no GPU**, so ANGLE ran on SwiftShader (CPU).
Expect a large speed-up on any machine with a real GPU.

### 720p (1280×720), full 600-frame renders

These are wall time ÷ 600 for the delivered previews, with `--concurrency=2`. SwiftShader already
saturates all cores, so a higher concurrency does not help on this box.

| Composition | ms / frame (720p) | 600 frames |
|---|---|---|
| NerveFibres-Red | 3 895 | 39 min |
| NerveFibres-Blue | 3 968 | 40 min |
| BokehBurst-Blue | 432 | 4.3 min |
| CosmicWhirl-Blue | 707 | 7.1 min |
| SmokeOrb-PinkGold | 330 | 3.3 min |
| SmokeOrb-CyanBlue | 340 | 3.4 min |
| GlassKnot-Galaxy | 2 902 | 29 min |
| GlassKnot-Nebula | 2 838 | 28 min |

### Real 4K frames (3840×2160), timed

The per-frame time is (N-frame job − 1-frame job) ÷ (N − 1), so browser start-up, shader compile and
scene setup are excluded.

| Composition | 4K s / frame | Measured as |
|---|---|---|
| 5 · SmokeOrb-PinkGold | **≈ 2.8 s** (2.5–3.1 over two runs) | 7-frame vs 1-frame job, concurrency 1 |
| 7 · GlassKnot-Galaxy | **≈ 16.8 s** | 4-frame vs 1-frame job, concurrency 1 (one-time setup ≈ 40 s) |

### 4K estimates for all compositions (this CPU-only machine)

The two timed frames are about 5.7× their 720p cost (pixel count is 9×; per-frame fixed costs do not scale).
The pixel-bound whirl shader is estimated at the full 9×.

| Composition | est. 4K s / frame | est. 600 frames |
|---|---|---|
| NerveFibres (each) | ≈ 22–30 s | ≈ 4–5 h |
| BokehBurst-Blue | ≈ 3–4 s | ≈ 35 min |
| CosmicWhirl-Blue | ≈ 6–9 s | ≈ 1–1.5 h |
| SmokeOrb (each) | ≈ 2.8 s (measured) | ≈ 30 min |
| GlassKnot (each) | ≈ 17 s (measured) | ≈ 2.8 h |

On a desktop GPU, expect these to drop by one to two orders of magnitude.

## Verification results (720p previews)

| Check | Result |
|---|---|
| 1 · ffprobe | all 8: h264, 1280×720, 30/1, yuv420p, 600 frames, 20.000 s, no audio stream |
| 2 · loop (601-frame comp, frame 600 vs 0) | all 8 pixel-identical. Also checked the seam step: the mean change 599→0 equals the normal 0→1 step (e.g. Whirl 5.04 vs 5.02, Nerve Red 4.43 vs 4.40) |
| 3 · cold frame 300 vs full render | all 8 byte-for-byte identical PNGs |
| 4 · banding (frame from the encoded mp4) | smooth everywhere: dithered 8-bit runs average 1.3–1.5 px with no flat bands; the orb halo falls to exact black in sub-level steps |
| 5 · contact sheets | each shows the required elements |
| 6 · motion (2 s around frame 300) | frame-to-frame change is steady, with no single-frame spikes; no fibre or streak shimmer, no texture boil, glints slide, stars don't pop |

Cosmic Whirl failed the seam check on its first render: the sparkle hash was not 3-fold symmetric like
the 120° loop rotation. It was fixed and passed on the second render. Everything else passed first time.

## Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] three.js (WebGL2) for Nerve Fibres, Cosmic Whirl and Glass Knot; PixiJS 8 (WebGL2) for Bokeh Burst and Smoke Orb
- [x] one data row per version (`src/variants.ts`)
- [x] seeded layouts, frame-pure rendering, no `Math.random()`, `Date.now()` or clocks; no TAA or accumulation
- [x] half-float targets, ±1/255 dither, 1.5 % grain from `frame % 600`, grain fade below 3 % luminance on Smoke Orb
- [x] 720p previews + PNG stills of all 8 (frame 300)
- [x] render times measured, two 4K frames timed, 4K estimates
- [x] no text, logos or brands; procedural galaxy and nebula; generic nerve illustration
