# Brain Pack — six brain looks (Remotion, 30 fps)

Eight compositions built on **one shared brain model**, all real 3D in three.js
on WebGL2 (`@remotion/three`, `--gl=angle`). Compositions are defined at
**3840×2160**; previews are rendered at 1280×720 with `--scale=1/3`.

| # | Composition id (file name) | Look | Length |
|---|---|---|---|
| 1 | `BrainMembrane-Violet` (`BrainMembrane_Violet.mp4`) | dotted translucent membranes, magenta/white sparkles, dive-through camera | 20 s loop |
| 2 | `BrainFibre-LightReveal` (`BrainFibre_LightReveal.mp4`) | inside the fibre tangle → pull back → turn, light grey | 10 s |
| 3 | `BrainFibre-LightLoop` (`BrainFibre_LightLoop.mp4`) | fibre brain turning 360°, yellow signals, light grey | 20 s loop |
| 4 | `BrainSolid-Black` (`BrainSolid_Black.mp4`) | realistic tissue, electric arcs, on (0,0,0) | 20 s loop |
| 5 | `BrainSolid-Green` (`BrainSolid_Green.mp4`) | same on #00FF00 | 20 s loop |
| 6 | `BrainGlass-Thoughts` (`BrainGlass_Thoughts.mp4`) | violet glass brain, thought-lines → web → sparkles → empty | 24 s |
| 7 | `BrainParticles-Assemble` (`BrainParticles_Assemble.mp4`) | burst → swirl → particles flow onto the brain → turn | 20 s |
| 8 | `BrainOrbit-DeepBlue` (`BrainOrbit_DeepBlue.mp4`) | luminous blue veins, deep-blue space, dust and embers | 20 s loop |

Remotion composition ids cannot contain `_`, so the ids use `-`; the render
script writes the delivery file names with `_`.

## Render

```console
npm ci
# all eight 4K masters (CPU WebGL — see timings below)
SCALE=1 scripts/render-previews.sh
# one clip at 4K
npx remotion render src/index.ts BrainSolid-Green out/BrainSolid_Green.mp4 \
  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
# 720p previews (what was delivered)
scripts/render-previews.sh
```

Always render with `--image-format=png` (the project config defaults video
frames to JPEG, which would soften the keyable backgrounds and the dither) and
`--gl=angle`. Loops are exact 600-frame cycles: frame 600 equals frame 0, so
loop them back-to-back with no crossfade. To check a seam, render the 601-frame
variant: `--props='{"extraFrame":true}'`.

### Timings (this machine: 4 vCPU, no GPU — ANGLE/SwiftShader)

Measured per frame, warm, one render tab:

| Clip | 720p | 4K |
|---|---|---|
| 1 Membrane | see report | 2.8 s |
| 4 Solid | see report | 5.2 s |
| 7 Assemble | see report | 2.7 s |

On a machine with a GPU, ANGLE uses it and these drop by an order of magnitude.

## Using the clips

- **Keying clip 5:** the background is exactly `#00FF00` (no bloom, glow or
  shadow reaches it; the brain contains no green). Use any chroma keyer with
  key colour `#00FF00`; e.g. ffmpeg `chromakey=0x00FF00:0.12:0.05`, or in
  Premiere/AE Ultra Key / Keylight with default settings. The arcs survive the
  key (they are blue-white, inside the silhouette).
- **Blend modes:** clip 6 (glass thoughts) is light on pure black — composite it
  with **Screen** (or Add). Clip 4 also works with Screen/Lighten over dark
  footage; for anything else use clip 5 and key it.
- Backgrounds in 1, 2, 3, 8 are smooth gradients rendered in float with a
  ±1/255 blue-noise dither; don't re-grade them with heavy contrast before
  encoding, or banding can return.

## Changing colours

Each look keeps its colours in **one data row** at the top of its file
(hex sRGB). Edit, then re-render:

| Look | File | Row |
|---|---|---|
| 1 | `src/brain/looks/membrane.ts` | `MEMBRANE_COLORS` (membrane, dim side, sparkles A/B/C, background, light streak, floor line) |
| 2–3 | `src/brain/looks/fibreLight.ts` | `FIBRE_COLORS` (fibre dark/light, beads, bokeh, signal, background centre/corner, close-up haze) |
| 4–5 | `src/brain/looks/solid.ts` | `SOLID_COLORS` (tissue, warm subsurface, key, rim, arc core, arc glow) |
| 6 | `src/brain/looks/glass.ts` | `GLASS_COLORS` (fresnel edge, inner body, lines, sparkles) |
| 7 | `src/brain/looks/assemble.ts` | `ASSEMBLE_COLORS` (cyan, violet, clusters, background, haze) |
| 8 | `src/brain/looks/orbit.ts` | `ORBIT_COLORS` (veins, crests, body, background top/bottom, embers, dust) |

The black and green backgrounds of 4–6 are fixed by design (keyable).

## Timings inside the clips

- **1 Membrane (600 f):** 0–150 approach to the side view · 150–300 dive through the membranes · 300–450 reverse out · 450–600 back to the start view (camera keyframes in `KEYS`).
- **2 Fibre reveal (300 f):** 0–80 inside the tangle with big signals and bokeh · 80–215 pull back through the surface · 195–300 slow turn.
- **3 Fibre loop (600 f):** one 360° turn; ~8 signals at once, 8–20 frames each, on a 600-frame schedule.
- **4/5 Solid (600 f):** one 360° turn; a discharge every 30–60 frames lasting 6–15 frames.
- **6 Glass (720 f):** 0–90 empty · 90–240 first lines · 240–420 the web grows · 420–510 bloom into sparkles · 510–630 fade to haze · 630–720 empty hold (`T` in `glass.ts`).
- **7 Assemble (600 f):** 0–120 burst/swirl · 120–270 particles fly to the surface, fibres draw on · 270–330 complete plexus · 330–600 ~90° turn with pulses.
- **8 Orbit (600 f):** one 360° turn; dust, embers and the particle stream all move whole box-lengths per 600 frames.

## The brain model

- **Source:** `assets/brain.glb` (the file supplied with the brief). 6,539,328 bytes,
  glTF 2.0 exported by *Khronos glTF Blender I/O v4.3.47*. One mesh (`output`),
  one primitive: 130,017 vertices, 198,145 triangles, POSITION/NORMAL/TEXCOORD_0,
  **no materials or textures**, no inner structures. Oriented +Y up, +Z front.
  It is a single welded surface containing both hemispheres, the cerebellum and
  the brainstem.
- **Licence / source:** _PLACEHOLDER — the GLB carries no licence or author
  metadata. Fill in the source URL and licence here._
- **Bake:** `python3 scripts/bake/bake.py` (numpy, scipy, trimesh, scikit-image)
  writes everything in `public/brain/` deterministically:
  - cleaning: 30,950 duplicate (UV-seam) vertices merged → 99,065 vertices;
    2 stray faces removed; one 13-edge hole closed; 37 folded triangles,
    525 needle pits and 554 single-vertex spikes relaxed; mild smoothing of
    a noisy patch at the occipital pole (90 vertices);
  - normalised: rotated so front = +X and top = +Y, centred, longest side = 2.0;
  - brainstem (after the model check, see below): bent forward so it runs down
    and slightly forward in front of the cerebellum, 12 % thicker, small pons
    bulge; medial walls of the longitudinal fissure drawn 0.012 together;
  - per-vertex curvature, sulcal depth and baked AO; part labels
    (cerebrum / cerebellum / brainstem) fitted geometrically;
  - inner structures added (the GLB has none): lateral ventricles (C-shaped,
    frontal/occipital/temporal horns), corpus callosum, thalami, hippocampi —
    smooth SDF tubes meshed with marching cubes, placed by mid-sagittal
    proportions;
  - 640k cortex points (denser on gyral crests) + 160k inner points;
    6,000 fibres (4,600 surface-following along the folds, 1,400 interior
    tracts: commissural through the callosum, association arcs, projection
    fibres to the brainstem); 420 thought-line polylines inside the brain;
    96 forked surface discharge paths; a 64×64 blue-noise dither mask
    (`scripts/bake/bluenoise.py`).

## How it is built (determinism, banding)

- `src/brain/engine/Stage.tsx` hands `useCurrentFrame()` to an imperative
  three.js renderer through a ref; the R3F render callback (priority 1) only
  calls `look.render(frame)`. No clocks, deltas, `useState`, TAA or
  accumulation drive any visual; every random value comes from module-level
  `mulberry32` seeds or baked data. Assets load behind `delayRender` (React
  `use()` inside the ThreeCanvas Suspense boundary).
- `src/brain/engine/post.ts`: half-float scene target (MSAA where meshes need
  it) → half-float bloom mip chain → composite with the background computed in
  float, ±1/255 blue-noise dither, masked off pure black and `#00FF00`.
- Particles are `Points`, fibres native `LineSegments` (width carried as
  brightness — 17× cheaper than quads on CPU WebGL); only short, thick strokes
  (signals, arcs, thought-lines, close-up hero fibres) use screen-space quads.

## Verification

`python3 scripts/verify.py` runs the checks used for delivery: ffprobe
(size, fps, codec, pixel format, frame count, no audio), loop seams, background
levels, the clip-5 key test and banding crops. See the delivery report for the
results.
