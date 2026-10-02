# Colon Cutaway — Remotion + three.js (WebGL2)

A cut-open 3D large intestine floating on a steel-blue backdrop. One colon
model, three stories:

| Composition ID | Story | Frames @ 30 fps | Output file name |
|---|---|---|---|
| `Colon-ConstipationRelief` | dark clumps broken up and cleared by colourful molecules | 450 (15 s), not a loop | `Colon_ConstipationRelief.mp4` |
| `Colon-HealthyFlora` | friendly bacteria + molecules drift through a clear colon | 600 (20 s), **seamless loop** | `Colon_HealthyFlora.mp4` |
| `Colon-InflammationRelief` | red patches on the lining calm to healthy as cool particles flow through | 450 (15 s), not a loop | `Colon_InflammationRelief.mp4` |

Remotion composition IDs may not contain `_`, so the IDs use `-`; the rendered
files use the requested `_` names. All compositions are defined at
**3840×2160**. A `checks` folder in the Studio holds two helper compositions
(model/cut views, and comp 2 at 601 frames for the loop test) — not deliverables.

## Quick start

```bash
npm install
npx remotion studio          # preview
```

Node 18+ (built with Node 22). WebGL2 is required; in headless Chromium use
**`--gl=angle`** (already set in `remotion.config.ts`:
`Config.setChromiumOpenGlRenderer("angle")`).

## 4K render commands

```bash
npx remotion render Colon-ConstipationRelief out/Colon_ConstipationRelief.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render Colon-HealthyFlora       out/Colon_HealthyFlora.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render Colon-InflammationRelief out/Colon_InflammationRelief.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

1080p preview (what was delivered): add `--scale=0.5`. `scripts/render_previews.sh`
renders a PNG sequence with `--scale=0.5` and encodes it with ffmpeg
(H.264, yuv420p, CRF 16, 30 fps, no audio) — the PNG frames are kept for the
determinism check.

## Stills

```bash
# 6000×3375 (scale 6000/3840 = 1.5625)
npx remotion still Colon-ConstipationRelief out/stills/c1_blocked.png --frame=40  --scale=1.5625 --gl=angle
npx remotion still Colon-ConstipationRelief out/stills/c1_clear.png   --frame=440 --scale=1.5625 --gl=angle
npx remotion still Colon-HealthyFlora       out/stills/c2_a.png       --frame=60  --scale=1.5625 --gl=angle
npx remotion still Colon-HealthyFlora       out/stills/c2_b.png       --frame=360 --scale=1.5625 --gl=angle
npx remotion still Colon-InflammationRelief out/stills/c3_inflamed.png --frame=130 --scale=1.5625 --gl=angle
npx remotion still Colon-InflammationRelief out/stills/c3_healed.png  --frame=440 --scale=1.5625 --gl=angle
```

## Render time

Measured in this build environment — a 4-core cloud container with **no GPU**
(Chromium falls back to SwiftShader software WebGL), concurrency 2:

| | per frame | whole job |
|---|---|---|
| 1080p preview (`--scale=0.5`), full renders | **4.14–4.42 s** (ConstipationRelief 4.42, HealthyFlora 4.14, InflammationRelief 4.40) | 1,500 frames ≈ 1 h 50 min |
| 4K (`--scale=1`), 20-frame sample incl. start-up | **≈ 12.6 s** | 1,500 frames ≈ 5 h 15 min |
| 6000×3375 still | ≈ 60–85 s each | — |

Of the 1080p time, MSAA ×4 is about 40 % and wall shading about 35 % (measured
by switching each off). **4K estimate on a machine with a real GPU** (any
recent discrete card, `--gl=angle`): the GPU work is light (≈ 0.3–0.5 M
triangles, a handful of full-screen passes), so expect roughly **1–2 s per
frame**, dominated by Remotion's screenshot + PNG encode at 3840×2160 —
about 25–50 min for all three. Rendering at 4K here on CPU works, it is just slow.

## Which colon route was used

**Meshy.** The colon is the **Meshy GLB supplied by the project owner during the
build** (`assets-src/meshy/Meshy_AI_full_colon_tube_100k_1002130711_texture.glb`),
prepared by `scripts/prepare_precut_colon.py`. That model is already cut open
(front half removed, wall thickness modelled, closed caecum bulb, open rectal
end), so it is shaded directly: every vertex carries a baked class (lining /
cut rim / outer wall) and the shader draws the cut rim pink with a thin cream
line on its inner edge, the lining cream, the outer wall salmon.

Our own Meshy text-to-3D runs (3 rounds, 12 candidates) produced one usable
closed tube (round 2, task `01a0fc99-d6c4-…`); it was prepared with
`scripts/prepare_meshy_colon.py` and drove the closed-shell cutaway path —
inner wall = shell pushed in along smoothed normals, a clipping heightfield
through the centreline, and parity-stencil capping of the cut face (pink with
a cream inner line). That path is still in `src/three/ColonWorld.ts`
(`buildCutaway`) and is used automatically for any `colon.glb` whose
`centreline.json` lacks `"precut": true`. The procedural fallback
(`scripts/build_colon.py`) was never needed for delivery.

Clump: Meshy text-to-3D (round 2, task `01a0fc99-e124-…`), 4,600 triangles.
Full task IDs, prompts and choices: `public/models/SOURCE.md`; turntables of
all candidates: `deliverables/colon-cutaway/meshy-turntables/`.

## Meshy plan / licence — please check

The Meshy plan behind both accounts (the API key used here, and the supplied
GLB) is **not recorded** — the API does not report it. Under Meshy's terms,
free-plan assets are published under a Creative Commons Attribution licence
and may be publicly visible; **commercial / stock use needs a paid plan's
terms**. Confirm both before licensing the footage. Details in
`public/models/SOURCE.md`.

## How it works

```
src/
  Root.tsx, index.ts              compositions
  ColonComposition.tsx            ThreeCanvas; loads GLBs with delayRender
  lib/assets.ts                   GLB + centreline loader (staticFile)
  lib/random.ts                   mulberry32 (module-level seeds only)
  three/ColonModel.ts             centreline tables, per-vertex u/θ/class, cut heightfield
  three/ColonWorld.ts             scene, materials, instanced particles, render order
  three/shaders.ts                GLSL: wrap lighting, lining, cut rim, particles
  three/Post.ts                   CoC/DOF, specks, bloom, ACES, dither, grain
  three/particles.ts              molecule / bacteria / irritant geometry, InstancedGroup
  stories/*.ts                    one pure frame -> state function per composition
scripts/                          model prep (Python), checks, preview render
public/models/                    colon.glb, clump.glb, centreline.json, SOURCE.md
assets-src/meshy/                 raw Meshy downloads (inputs to the prep scripts)
```

- **Centreline** (`public/models/centreline.json`): 24 sliced stations, a
  centripetal `CatmullRomCurve3`, outer / inner-wall / safe inner radius per
  station. Everything that travels through the colon is placed at parameter
  `u` (0 caecum → 1 rectal end) with a seeded offset kept inside the safe
  radius (and shrunk where the lumen narrows).
- **Materials**: outer wall `#E8837C` with wrapped diffuse + Fresnel rim + a
  warm terminator band (fake subsurface, no transmission); lining `#E8C497`
  (a touch warmer than the brief's `#E9C9A0`, offsetting ACES' desaturation) with haustral folds, fine noise folds and
  darker sides; cut rim pink with a cream inner line; clumps `#4A3226`, rough,
  lighter on high points. One `InstancedMesh` per particle type; bacteria are
  "translucent" via Fresnel + opacity.
- **Comp 3 patches** are a mask on the lining in (u, θ) — seeded noise blobs —
  driven by a per-patch `heal` value computed from the frame (when the cool
  front reaches the patch). No geometry changes.
- **Post**: scene in half-float with MSAA ×4 (×2 for > 2160 px stills) →
  depth-of-field gather (28 taps) → background specks (occluded by scene depth)
  → bloom (threshold 1.25, so only emissive particles bloom) → ACES →
  sRGB → ±1/255 triangular dither + 2 % luma grain. The backdrop gradient
  (`#8FA6BC` centre → `#5F7891` edges) is drawn through the inverse of the ACES
  curve so it lands on those exact display values.

## Determinism

Every value on screen is computed from `useCurrentFrame()`:
seeds are `mulberry32` at module level; no `Math.random()`, `Date.now()`,
`useFrame` clock, physics, or state carried between frames; no TAA / temporal
AO / accumulation. The clump break-up and the `heal` values are functions of
the frame. Grain is a hash of pixel position and frame (`frame % 600` in comp
2). The GLBs and JSON load under `delayRender`. Meshy is only used by the prep
scripts, never at render time.

## Checks

Run `npm run render:previews`, then `npm run check` (and `npm run check:inside`).
Results for the delivered previews (`deliverables/colon-cutaway/checks/`):

| # | Check | Result |
|---|---|---|
| 1 | ffprobe: 1920×1080, 30/1, h264, yuv420p, no audio; 15.0 / 20.0 / 15.0 s | **pass** (all three) |
| 2 | model: one continuous tube; cut clean along the whole length incl. sigmoid; rim solid pink + cream line; inner surface never through the outer; centreline centred | **pass** — see `model-check/` (12 views + `12_centreline-debug.png`) |
| 3 | loop: comp 2 at 601 frames, frame 0 vs 600 | **pass** — pixel-identical (same md5) |
| 4 | frame 300 rendered alone from a cold start vs frame 300 of the full (2-tab, out-of-order) render | **pass** — byte-identical PNGs for all three |
| 5 | everything inside, no pops (all frames evaluated; containment at 1 frame in 10, 62k instance checks) | **pass** — 0 outside the measured inner wall (worst reach 97 % of wall radius); no mid-colon pops (only the intended clump break-up swaps); every-10th-frame sheets reviewed |
| 6 | banding, read from the encoded mp4 | **pass** — backdrop rows: raw run length mean 1.6 px (p99 6), 21-row profile minus smooth fit ≈ ±0.5–1 code, no staircase; lining box run length mean 1.6 px |
| 7 | five evenly spaced frames per composition | reviewed — `*_5frames.png` |

Two determinism bugs were found by check 4 and fixed (then everything was
re-rendered): three.js derived the particle groups' depth-sort key from the
instance positions of the first frame a tab happened to draw, and the pre-cut
wall shader took screen-space derivatives inside divergent branches. Both made
a frame depend on what the tab rendered before it.

## Re-preparing the models

```bash
pip install trimesh numpy scipy scikit-image networkx shapely pymeshlab pillow
python3 scripts/prepare_precut_colon.py assets-src/meshy/Meshy_AI_full_colon_tube_100k_1002130711_texture.glb
python3 scripts/prepare_meshy_clump.py  assets-src/meshy/clump_r2_6_01a0fc99-e124.glb
# closed-shell alternative (our own Meshy candidate):
# python3 scripts/prepare_meshy_colon.py assets-src/meshy/colon_candidate_r2_4_01a0fc99-d6c4.glb
```
(pymeshlab needs `libOpenGL.so.0`, e.g. `apt install libopengl0`.)
