# Data Grid Space · Particle Orb · Cell Cluster · Pillar Field · Graphene Lattice

One Remotion project, **8 compositions**, all **3840×2160, 30 fps, 600 frames (20 s), seamless loops**.

| Composition id | Output file | Engine |
|---|---|---|
| `DataGridSpace-Blue` | `DataGridSpace_Blue.mp4` | three.js (`@remotion/three`) |
| `ParticleOrb-VioletBlue` | `ParticleOrb_VioletBlue.mp4` | PixiJS 8 (120k points, 3D in a custom vertex shader) |
| `ParticleOrb-TealGold` | `ParticleOrb_TealGold.mp4` | PixiJS 8 |
| `CellCluster-MicroscopeBlue` | `CellCluster_MicroscopeBlue.mp4` | three.js |
| `PillarField-BlueViolet` | `PillarField_BlueViolet.mp4` | three.js |
| `PillarField-CopperGold` | `PillarField_CopperGold.mp4` | three.js |
| `GrapheneLattice-TealGold` | `GrapheneLattice_TealGold.mp4` | three.js (`MeshPhysicalMaterial`, transmission 0.3, clearcoat) |
| `GrapheneLattice-BlueSilver` | `GrapheneLattice_BlueSilver.mp4` | three.js |

Everything is built in code: no image or video assets, no text, no logos.

## Setup

```bash
npm install
npx remotion studio          # preview (Studio renders the canvases at half resolution for speed)
```

Node 18+ (tested with Node 22). Versions are pinned in `package.json`
(remotion 4.0.515, three 0.181.2, @react-three/fiber 9.4.2, pixi.js 8.14.3).

### Chromium GL flag

All looks use **WebGL2**. Headless Chromium needs ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("angle")`, so the commands below
need no extra flag. If you call the Node APIs instead of the CLI, pass
`chromiumOptions: { gl: "angle" }`. On a machine with a GPU, ANGLE uses it; without one it falls back to
SwiftShader (CPU), which is what the timings below were measured on.

## Render commands (4K)

`remotion.config.ts` sets H.264, `yuv420p`, CRF 16, PNG intermediate frames and the ANGLE renderer.

```bash
npx remotion render src/index.ts DataGridSpace-Blue          out/DataGridSpace_Blue.mp4
npx remotion render src/index.ts ParticleOrb-VioletBlue      out/ParticleOrb_VioletBlue.mp4
npx remotion render src/index.ts ParticleOrb-TealGold        out/ParticleOrb_TealGold.mp4
npx remotion render src/index.ts CellCluster-MicroscopeBlue  out/CellCluster_MicroscopeBlue.mp4
npx remotion render src/index.ts PillarField-BlueViolet      out/PillarField_BlueViolet.mp4
npx remotion render src/index.ts PillarField-CopperGold      out/PillarField_CopperGold.mp4
npx remotion render src/index.ts GrapheneLattice-TealGold    out/GrapheneLattice_TealGold.mp4
npx remotion render src/index.ts GrapheneLattice-BlueSilver  out/GrapheneLattice_BlueSilver.mp4
```

On a CPU-only box, use `--concurrency=1`. SwiftShader already uses every core, and more tabs only add
contention (measured: 2.92 s/frame at concurrency 1, 2.97 s at 2, 3.57 s at 4 for Graphene at 720p).
On a GPU machine, raise concurrency.

720p previews (what was delivered): `--scale=0.3333333333333333` gives an exact 1280×720 drawing
buffer. `scripts/render_previews.sh` renders PNG sequences at that scale and encodes them with
`ffmpeg -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30` (it expects a bundle in `out/bundle`:
`npx remotion bundle src/index.ts --out-dir=out/bundle`).

### Stills (6000×3375)

Not rendered here. 6000 / 3840 = 1.5625:

```bash
npx remotion still src/index.ts GrapheneLattice-TealGold out/GrapheneLattice_TealGold_6K.png --frame=300 --scale=1.5625
```

(Swap the id for any composition. `--scale=1.5625` on the 3840×2160 composition gives exactly 6000×3375.)

## Adding a colourway (one data row)

All versions are rows in `src/versions.ts`. Copy a row of the same `look`, give it a new `id`
(letters, digits and `-` only) and `file`, and change the palette:

```ts
{ look: "pillars", id: "PillarField-Emerald", file: "PillarField_Emerald",
  palette: { top: "#8AFFC8", sideA: "#1A8A5A", sideB: "#0A4A3A", trim: "#C8A84A", bg: "#04140C" } },
```

It appears in Studio and can be rendered by id. No other code changes are needed.

## Determinism

- Every value on screen is a function of `useCurrentFrame()` alone. Layouts are generated once at module
  level from `mulberry32` seeds. There is no `Math.random()`, `Date.now()`, `useFrame` clock, `useState`
  driving visuals, TAA or accumulation buffers.
- three.js: `@remotion/three` renders once per frame with `frameloop="never"`. A post-processing
  component (`src/three/PostFX.tsx`) takes over that render (scene → half-float MSAA target with depth →
  bloom → DoF/grain/dither → screen). Its callback reads only values derived from the frame.
- PixiJS: the `Application` is created with `autoStart: false` and no ticker. The stage is rendered
  manually once per Remotion frame inside a layout effect. Initialisation is wrapped in
  `delayRender` / `continueRender`.
- Textures (the graphene PMREM environment) are generated synchronously in code before the first
  frame, so nothing is loaded asynchronously.
- Loops: motion uses the loop phase `(frame % 600) / 600` through periodic functions. Examples: the
  depth wrap moves exactly one period, the orb turns 360°, the lattice drifts exactly one hexagon, and
  noise is sampled on a circle in time. `--props='{"loopCheck":true}'` makes every composition 601
  frames so frame 600 can be rendered and compared with frame 0.

## Banding

- Final pass: triangular ±1/255 dither plus 1.5% grain, from a PCG hash of `(pixel x, pixel y, frame % 600)`.
- All three.js looks render into **half-float** targets.
- Particle Orb (PixiJS) accumulates its 120k additive points in an `rgba16float` render texture. Its grain
  and dither fade to zero below about 3% luminance, so the black stays clean.

## Measured render times and 4K estimates

Measured in this build environment: 4 vCPU, **no GPU** (Chromium ANGLE → SwiftShader, i.e. WebGL2 on
the CPU), `--concurrency=1`. 720p figures are the wall time of the full 600-frame render ÷ 600. 4K
figures are (6-frame job − 1-frame job) ÷ 5, so startup is excluded.

| Composition | 720p s/frame (measured) | 4K s/frame | 4K, 600 frames (CPU) |
|---|---|---|---|
| DataGridSpace-Blue | 0.93 | ≈ 5.6 (est.) | ≈ 56 min |
| ParticleOrb-VioletBlue (2A) | 0.52 | **3.11 (measured)** | ≈ 31 min |
| ParticleOrb-TealGold | 0.54 | ≈ 3.2 (est.) | ≈ 32 min |
| CellCluster-MicroscopeBlue | 2.42 | ≈ 14.5 (est.) | ≈ 2.4 h |
| PillarField-BlueViolet | 1.26 | ≈ 7.6 (est.) | ≈ 76 min |
| PillarField-CopperGold | 1.22 | ≈ 7.3 (est.) | ≈ 73 min |
| GrapheneLattice-TealGold (5A) | 2.60 | **15.3 (measured)** | ≈ 2.6 h |
| GrapheneLattice-BlueSilver | 2.69 | ≈ 16.1 (est.) | ≈ 2.7 h |

The two measured 4K frames cost 6.0× (2A) and 5.9× (5A) their 720p frame. The other estimates use
6×, which fits a pixel-bound workload: 9× the pixels, with some fixed per-frame cost. All eight at 4K
come to about **12.6 hours on this CPU-only box**. A machine with a real GPU behind ANGLE should be
much faster, but that was not measured here. Graphene is the most expensive look because three.js
renders an extra transmission pass for the `MeshPhysicalMaterial` atoms.

## Verification (completion checklist)

All checks were run on the delivered previews (`scripts/` holds the helpers).

| Check | Result |
|---|---|
| 1. ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, 20.0 s | **Pass, all 8** |
| 2. Loop: 601-frame variant, frame 600 vs frame 0 | **Pass, all 8**: 0 pixels differ, byte-identical PNGs |
| 2b. Seam smoothness: mean change 599→0 vs ordinary frame-to-frame change | **Pass, all 8**, e.g. Graphene 2.33 vs 2.32, Cells 3.49 vs 3.51 |
| 3. Determinism: cold-start frame 300 vs frame 300 of the full render | **Pass, all 8**: byte-identical |
| 4. Banding, read from frames decoded **from the encoded mp4** | **Pass**: Cells background steps ≤ 1.6/255 (smoothed); Graphene teal/blue ≤ 3.8/255 with monotonic ramps; Data Grid background profile (per-row median) ≤ 1/255 per row after removing line spikes; Orb black is exactly 0 everywhere outside the orb (grain/dither faded) |
| 5. Contact sheets (5 evenly spaced frames) | Content as specified for all 8 (`out/checks/*_contact.png` when re-run) |
| 6. Motion: per-frame change over 2 s around frame 300 and pillars 2–7 s | No pops: the largest frame-to-frame jump in change is ≤ 0.33 (≤ 1.34 during the eased pillar rise); lines and edges are antialiased (screen-space ribbons, 4× MSAA) |

Banding measures used: dither ±1/255 in the final pass, half-float targets, 1.5% grain from a fixed hash
of `(x, y, frame % 600)`, and grain fading to zero below about 3% luminance in the orb.

Re-run the checks:

```bash
npx remotion bundle src/index.ts --out-dir=out/bundle
scripts/render_previews.sh                                   # 720p PNG sequences + mp4s
scripts/check_preview.sh DataGridSpace_Blue                  # step 1, seam, contact sheet, mp4 frame
scripts/loop_and_determinism.sh DataGridSpace-Blue DataGridSpace_Blue   # steps 2 and 3
python3 scripts/banding.py out/checks/CellCluster_MicroscopeBlue_mp4_f300.png 20 20 500 20
```

## Look decisions worth knowing

- **Data Grid:** two horizon lines at 25% and 75% of the height, as specified. The reference has a
  single line at mid-height.
- **Data Grid:** the vanishing point is shifted to about 35% of the width, matching the reference's
  off-centre corridor while staying near the centre.
- **Particle Orb:** the radial displacement stays within the specified ±8%. Fold depth is sold with an
  exaggerated shading normal and a band mask: particles that land in a gap are reflected into the
  nearest band, so the gaps are black and the bands dense.
- **Pillar Field:** the spec asks for about 50° from above; the reference is lower and long-lens. The
  camera sits at about 19° elevation with a 5.4° lens, so the 24×24 grid fills the frame through
  the whole orbit and the pillars read tall. The look-at height follows the rise and fall, which gives
  the gentle push.
- **Graphene:** the topology is generated and checked at load: every bond has the same length and
  every interior atom has exactly 3 bonds (`src/looks/GrapheneLattice.tsx` throws otherwise). The sheet
  is periodic in x, so a one-hexagon drift loops exactly. The wrap seam and sheet edges stay off-screen.
- **Cells:** each cell has one dark nucleus. Four are dividing (a peanut-shaped membrane with two
  nuclei).

## Project layout

```
src/index.ts, src/Root.tsx      compositions (one per row of src/versions.ts)
src/versions.ts                 the 8 data rows (palettes)
src/looks/*.tsx                 the five looks
src/three/PostFX.tsx            half-float pipeline: bloom, tile-max DoF, chromatic aberration, grain, dither
src/three/ThreeStage.tsx        ThreeCanvas wrapper (dpr = render scale, camera rig)
src/lib/random.ts, glsl.ts      seeded PRNG, hashes, simplex noise, grain/dither GLSL
scripts/                        preview rendering and the verification helpers used for the checks
```
