# Capsule Release · Particle DNA · Water Drop · Radial Burst

One Remotion project, 4 looks, 8 compositions. Everything is built in code (no
footage, no textures from disk, no text, logos or brands).

| # | Composition ID (render with this) | Output file | Engine | Length |
|---|---|---|---|---|
| 1 | `CapsuleRelease-White` | `CapsuleRelease_White.mp4` | three.js (`@remotion/three`), WebGL2 | 360 f / 12 s story |
| 2 | `CapsuleRelease-TwoTone` | `CapsuleRelease_TwoTone.mp4` | three.js, WebGL2 | 360 f / 12 s story |
| 3 | `DNAParticles-Violet` | `DNAParticles_Violet.mp4` | PixiJS 8, WebGL2 (3D projected in a vertex shader) | 600 f / 20 s loop |
| 4 | `DNAForm-Teal` | `DNAForm_Teal.mp4` | PixiJS 8, WebGL2 | 360 f / 12 s story |
| 5 | `DNAParticles-Teal` | `DNAParticles_Teal.mp4` | PixiJS 8, WebGL2 | 600 f / 20 s loop |
| 6 | `WaterDrop-Blue` | `WaterDrop_Blue.mp4` | three.js, WebGL2 | 600 f / 20 s loop |
| 7 | `RadialBurst-Navy` | `RadialBurst_Navy.mp4` | PixiJS 8, WebGL2 | 600 f / 20 s loop |
| 8 | `RadialBurst-TealGold` | `RadialBurst_TealGold.mp4` | PixiJS 8, WebGL2 | 600 f / 20 s loop |

Remotion composition IDs may not contain `_`, so the IDs use `-`; the output
files keep the `_` names.

All compositions are **3840×2160, 30 fps**.

## Setup

```bash
npm install
npx remotion studio        # preview (renders at half resolution in the Studio)
```

Node 18+ (tested with Node 22). Versions are pinned in `package.json`
(Remotion 4.0.515, three 0.180.0, @react-three/fiber 9.4.0, PixiJS 8.14.0).

## Chromium GL flag

All looks need **WebGL2**. Headless Chromium must run with ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer('angle')`,
so the CLI commands below pick it up; pass `--gl=angle` explicitly if you call
the renderer another way. On a machine with a GPU, ANGLE uses it; without one
it falls back to SwiftShader (software), which is what the timings below were
measured on. WebGPU is not used.

## 4K render commands

```bash
npx remotion render CapsuleRelease-White   out/CapsuleRelease_White.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render CapsuleRelease-TwoTone out/CapsuleRelease_TwoTone.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render DNAParticles-Violet    out/DNAParticles_Violet.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render DNAForm-Teal           out/DNAForm_Teal.mp4           --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render DNAParticles-Teal      out/DNAParticles_Teal.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render WaterDrop-Blue         out/WaterDrop_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render RadialBurst-Navy       out/RadialBurst_Navy.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render RadialBurst-TealGold   out/RadialBurst_TealGold.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

(The codec, CRF, pixel format and PNG intermediate frames are also the
defaults in `remotion.config.ts`.) For ProRes masters add
`--codec=prores --prores-profile=4444` instead of the H.264 flags.

## 6K stills (6000×3375)

The compositions are 3840 wide, so 6000×3375 is `--scale=1.5625`:

```bash
npx remotion still CapsuleRelease-White out/CapsuleRelease_White_6k.png --frame=300 --scale=1.5625 --gl=angle
# any composition / frame:
npx remotion still <CompositionId> out/<name>_6k.png --frame=<n> --scale=1.5625 --gl=angle
```

## 720p previews (how the delivered previews were made)

```bash
scripts/render-previews.sh            # all 8, or pass composition IDs
```

It renders with `--scale=0.3333333333333333`, which gives exactly 1280×720
(checked with ffprobe), H.264, yuv420p, 30 fps, CRF 16, and saves a PNG still
of the middle frame.

## Verification scripts

| Script | What it checks |
|---|---|
| `scripts/loop-check.sh` | Step 2: with `REMOTION_LOOP_TEST_EXTRA=1` every loop is 601 frames; renders frames 0 and 600 and compares them pixel for pixel. |
| `scripts/determinism-check.sh` | Step 3: renders the middle frame cold (`remotion still`) and inside a multi-threaded out-of-order sequence render, and compares the PNGs byte for byte. |
| `scripts/banding.py <dir> [t]` | Step 4: decodes a frame from each encoded mp4 and reads pixel rows/columns across the flat backgrounds. |
| `scripts/pixdiff.py a.png b.png` | Pixel comparison helper. |

## Measured render times

All times were measured in this sandbox: 4 CPU cores, **no GPU**, Chromium
headless shell with `--gl=angle` (falling back to SwiftShader, which is
software GL), and Remotion's default concurrency. Each time is the wall clock
for the whole render (including bundle-free start-up and H.264 encode),
divided by the number of frames.

| Composition | Frames | 720p (`--scale=1/3`), s/frame | Estimated 4K, s/frame | Estimated 4K full render |
|---|---|---|---|---|
| CapsuleRelease_White | 360 | 0.90 | ~3.5 | ~21 min |
| CapsuleRelease_TwoTone | 360 | 0.91 | ~3.5 | ~21 min |
| DNAParticles_Violet | 600 | 1.95 | ~6.5 | ~65 min |
| DNAForm_Teal | 360 | 1.94 | ~6.5 | ~39 min |
| DNAParticles_Teal | 600 | 1.91 | ~6.5 | ~65 min |
| WaterDrop_Blue | 600 | 0.58 | ~3.0 | ~30 min |
| RadialBurst_Navy | 600 | 1.32 | ~4.5 | ~45 min |
| RadialBurst_TealGold | 600 | 1.36 | ~4.5 | ~45 min |

**Two real 4K frames were timed.** Each is the cost per frame, single-threaded
(`--concurrency=1`), worked out as (time for 4 frames − time for 1 frame) / 3
so that browser start-up is excluded:

- `CapsuleRelease-White`, frames 150–153 (the powder burst): **6.1 s/frame**
- `WaterDrop-Blue`, frames 300–303: **5.2 s/frame**

**How the 4K estimates were made:**

- For the two timed looks, a 4K frame costs about 3.4× (Capsule) and 4.5×
  (Drop) the 720p cost per frame.
- I applied that ratio, with Remotion's default parallelism, to all 8 looks.
- The Pixi looks are fill-bound on SwiftShader, so their estimate uses the
  upper end of that ratio.
- **Total for all 8 at 4K on this 4-core CPU without a GPU: about 5.5 h.**
- On a machine with a GPU (ANGLE on real GL/Vulkan/Metal) expect it to be
  roughly 10–50× faster. On a GPU, the DNA and Burst looks are cheap (120k and
  ~70k instanced quads).

## Verification results (720p previews)

| Check | Result |
|---|---|
| 1. ffprobe | All 8: h264, yuv420p, 1280×720, 30/1, no audio. Duration 12.000 s for 1, 2 and 4; 20.000 s for the rest. Each 720p PNG still is 1280×720. |
| 2. Loop (frame 0 vs frame 600 of a 601-frame render) | All 5 loops are **pixel-identical** (max diff 0). |
| 3. Cold middle frame vs out-of-order multi-threaded render | All 8 are **byte-identical** PNGs. |
| 4. Banding, read on frames decoded from the encoded mp4 | **Capsule and Drop:** no plateaus longer than 25 px on their flat backgrounds; block-to-block steps ≤ 1.3 levels. **DNA:** smooth ramps under a 20× contrast stretch; only the intended faint vertical grid lines are visible. **Burst:** the first previews showed 1-level contour rings from a faint radial lift in the navy; I removed that and the background is now a flat colour, so there is no gradient left to band. |
| 5. Contact sheets (`scripts/contact-sheet.sh`) | **Capsule:** the split and the powder burst read correctly in white and two-tone. **DNA:** right-handed, with rungs and visible major and minor grooves (confirmed by a fresh sub-agent on the final still); the teal story goes specks → cloud → gather → hold. **Drop:** wobble, top highlight, bottom crescent and refraction all read. **Burst:** fan from one edge, coloured tips, copy space on the other side. |
| 6. Motion (`scripts/motion.py`, frame-to-frame change across each whole preview, plus consecutive frames stepped around frame 300) | No isolated spikes (pops) in any preview. The capsule split and the DNA gathering rise and fall smoothly; there is no particle flicker or shimmer. |

## Completion checklist

- [x] 8 compositions at 3840×2160, 30 fps; 360 frames for the stories, 600 for the loops; one data row per version
- [x] three.js on WebGL2 for Capsule and Drop; PixiJS 8 on WebGL2 for DNA (~120k particles) and Burst (~60k ray dots)
- [x] No text, logos or brands; plain capsules
- [x] DNA is right-handed, has 10 base pairs per turn and rungs, and shows major and minor grooves
- [x] Deterministic: seeded at module level, closed-form motion, no `Math.random`, `Date.now`, `useFrame`, ticker, TAA or accumulation
- [x] Half-float targets, ±1/255 dither, 1.5 % grain from a fixed formula, blue-noise dither on the Capsule and Drop backgrounds
- [x] Exact loops; cold-start frames identical to full-render frames
- [x] 720p previews and stills checked with ffprobe; 4K and 6K commands documented
- [x] Two 4K frames timed


## How it is built

### Determinism

Every value on screen comes from `useCurrentFrame()` only.

- All randomness comes from `mulberry32` generators seeded at **module level**:
  powder, particles, rays, specks, the blue-noise tile.
- Positions are closed-form functions of the frame. The powder uses
  `p0 + v0·(1−e^(−kτ))/k + drift·τ`; the DNA uses the helix formula with a
  phase; the rays use `fract(u0 + n·t)`. There is no physics stepping and
  nothing is carried between frames.
- There is no `Math.random()`, `Date.now()`, `useFrame`, ticker, TAA or
  accumulation.
- **PixiJS** (`src/lib/PixiCanvas.tsx`): the renderer is created once (behind
  `delayRender`), then the stage is rendered manually inside a layout effect
  for each Remotion frame.
- **three.js** (`src/lib/ThreeStage.tsx`): runs inside `<ThreeCanvas>`. The R3F
  scene is left empty and `autoClear` is off. Each look's own pipeline renders
  once per frame from a layout effect.
- Grain and dither are fixed hashes of pixel position and
  `frame mod durationInFrames`, so loop frame 600 equals frame 0.

### Banding

- Every look renders into **half-float (RGBA16F) targets**.
- The final pass adds triangular **±1/255 dither** and **1.5% grain**.
- Capsule Release and Water Drop also add a fixed **64×64 blue-noise** tile to
  their flat backgrounds. The tile is generated with void-and-cluster from a
  seed at module load.

### Looks

- **Capsule Release** (`src/capsule`)
  - Two lathe-built half shells, at 2.8 : 1 overall. The cap is 1.5 % wider and
    overlaps the body.
  - Material: `MeshPhysicalMaterial` with roughness 0.25 and clearcoat.
  - Lighting: a soft key with PCF soft shadows on the capsule's own surfaces.
  - A grainy powder fill sits inside each open end.
  - Powder: 20 000 `Points` from a closed-form burst out of the gap.
  - Background: 12 capsules rendered at half resolution, then Gaussian-blurred
    (the depth of field).
  - The split is eased with smootherstep.
- **Particle DNA** (`src/dna`)
  - 80 000 backbone, 25 000 rung and 15 000 loose particles, drawn as
    instanced quads.
  - Positions are computed and projected in the vertex shader. Depth of field
    is per particle: the circle of confusion grows the quad, and energy is
    conserved.
  - The helix is **right-handed**: `x = R·sin a, y = s·rise, z = R·cos a`, with
    x right, y up and z toward the viewer.
  - **10 base pairs per turn.**
  - The second strand is offset by 120°, so the minor groove is 1/3 of a turn
    and the major groove 2/3.
  - **Exact loop:** the helix makes a screw motion of exactly one base-pair
    step per 600 frames (36° turn plus one rise). Every base-pair segment
    carries the same particle pattern, so the particle set maps onto itself.
    A pure 36° rotation of a helix is *not* a symmetry; it looks like a shift
    along the axis. Only the screw motion loops exactly.
  - `DNAForm` gives each particle a cloud position. It eases to its helix
    position with a bottom-to-top stagger.
- **Water Drop** (`src/waterdrop`)
  - An icosphere whose radius is a sum of 8 spherical-harmonic-like modes.
    Each mode makes a whole number of cycles per 600 frames; the total stays
    within ±4 %.
  - Material: `MeshPhysicalMaterial` with transmission 1, IOR 1.33, thickness 1
    and roughness 0.
  - The studio environment is a PMREM of a procedural room. A broad overhead
    window makes the top highlight, an up-left key makes the specular
    highlight, and a low strip lights the bottom.
  - An additive crescent sits at the bottom.
  - A soft "backdrop" disc hidden behind the drop is only ever seen refracted.
    It gives the darker left-side patch inside.
- **Radial Burst** (`src/burst`)
  - 700 rays from −80° to +80°. Dots are spaced at 0.4 % of the frame width:
    about 42 000 ray dots, plus 9 000 globe-shell dots, 250 bokeh and 300
    specks (~52 000 in total; the hollow core takes the inner part of each
    ray).
  - Each ray ends in a ring or a coloured dot. One ray in nine is a "hero"
    spoke with a bright line and a ring bead on the outer arc.
  - The core is a dotted globe shell. Mid-radius dots get bokeh blur.
  - Motion: length breathing ±6 %, outward flow and a ±3° cosine sway. All of
    them make whole cycles.
  - TealGold is the same burst mirrored.

## Deviations from the brief (deliberate)

- **DNA framing.** The references show a fat, heavily defocused helix with
  only about one turn on screen. Framed like that, the major and minor
  grooves and the rungs cannot be read, which is a hard rule of the brief.
  The helix is therefore a little smaller and sharper (about 2 turns visible,
  pitch/diameter about 1.75, close to B-DNA).
- **DNA lean.** The brief says "bottom left to top centre-left", but both
  references lean the other way (top to the left). The helix follows the
  references.
- **Water Drop size.** The brief says 38 % of the frame height; the reference
  drop's *diameter* is about 74 %. I read 38 % as the radius, giving a
  diameter of about 72 %.
- **Radial Burst origin.** The origin sits on the left edge, so half of the
  dotted core is visible, as in the reference. It is not fully beyond the
  edge.
- **Radial Burst background.** It is the specified flat `#020A24` (or
  `#021A1E` for TealGold). The reference navy is a little lighter and more
  teal. A faint gradient on it banded after H.264, so it is kept flat.
- **Composition IDs** use `-` instead of `_`, because Remotion forbids
  underscores.

## Adding a colourway

Every version is one row in `src/data.ts`. Copy a row, change its `id` and
colours, and save. `Root.tsx` registers every row as a composition (the ID
becomes `<id with - for _>`). For example, a green DNA loop:

```ts
{
  id: 'DNAParticles_Green', durationInFrames: 600, mode: 'loop',
  background: '#04140C', backgroundRight: '#03100A', glow: '#0A3A1A',
  strandA: '#5AE88A', strandB: '#3AC8A0', rung: '#8AE8B0', loose: '#5AD890',
},
```
