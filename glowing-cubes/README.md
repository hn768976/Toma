# Glowing Cubes — Remotion + three.js

Two looks, six compositions, 30 fps, 16:9, defined at **3840×2160**.

| Composition id | Look | Palette | Frames | Length | Loops? |
|---|---|---|---|---|---|
| `CubeCluster-Green`  | 1 · Cube Cluster  | Green  | 600 | 20 s | **yes** (frame 600 = frame 0) |
| `CubeCluster-Violet` | 1 · Cube Cluster  | Violet | 600 | 20 s | **yes** |
| `CubeCluster-Blue`   | 1 · Cube Cluster  | Blue   | 600 | 20 s | **yes** |
| `CubeAssembly-Blue`  | 2 · Cube Assembly | Blue   | 300 | 10 s | **NO** |
| `CubeAssembly-Violet`| 2 · Cube Assembly | Violet | 300 | 10 s | **NO** |
| `CubeAssembly-Green` | 2 · Cube Assembly | Green  | 300 | 10 s | **NO** |

> **Look 2 (Cube Assembly) does not loop.** It starts on an empty floor, the
> cubes fly in and lock into a 4×4×4 cube, and it ends on the assembled cube
> with a slow push-in. Do not set it to loop in an edit.

Within a look, all palettes share exactly the same layout, motion and timing;
only colours change.

**3D:** `@remotion/three` / react-three-fiber on **WebGL2** (not WebGPU).

---

## Quick start

```bash
npm install
npx remotion studio          # preview all six in the browser
```

Node 18+ (tested on Node 22). All dependency versions are pinned in
`package.json` / `package-lock.json`.

### Chromium GL flag

Headless Chromium needs ANGLE for WebGL2. It is set in `remotion.config.ts`
(`Config.setChromiumOpenGlRenderer("angle")`); on the command line it is:

```
--gl=angle
```

On a machine with a GPU, ANGLE uses it. Without a GPU, Chromium falls back to
SwiftShader (software) — it works and gives identical pictures, only slower
(the timings below were measured that way).

---

## Render commands

### 4K masters (3840×2160, H.264, yuv420p, CRF 16, 30 fps)

`remotion.config.ts` already sets h264 / yuv420p / CRF 16 / PNG intermediate
frames, so these are complete as written:

```bash
npx remotion render CubeCluster-Green   out/CubeCluster_Green_4K.mp4   --gl=angle
npx remotion render CubeCluster-Violet  out/CubeCluster_Violet_4K.mp4  --gl=angle
npx remotion render CubeCluster-Blue    out/CubeCluster_Blue_4K.mp4    --gl=angle
npx remotion render CubeAssembly-Blue   out/CubeAssembly_Blue_4K.mp4   --gl=angle
npx remotion render CubeAssembly-Violet out/CubeAssembly_Violet_4K.mp4 --gl=angle
npx remotion render CubeAssembly-Green  out/CubeAssembly_Green_4K.mp4  --gl=angle
```

For ProRes masters instead, add `--codec=prores --prores-profile=4444`.

### 1080p previews (what was delivered)

```bash
npx remotion render CubeCluster-Green out/CubeCluster_Green.mp4 --scale=0.5 --gl=angle
```

The delivered previews were made with `bash scripts/render-previews.sh`, which
renders the same frames as a lossless PNG sequence (`--sequence
--image-format=png --scale=0.5`) and then encodes with
`ffmpeg -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30` (BT.709
tagged, no audio). Keeping the PNG sequence is what makes the byte-for-byte
determinism check possible.

### Stills

```bash
# 6000×3375 PNG (6000 / 3840 = 1.5625)
npx remotion still CubeCluster-Blue  out/CubeCluster_Blue_f150.png  --frame=150 --scale=1.5625 --gl=angle
npx remotion still CubeAssembly-Blue out/CubeAssembly_Blue_f120.png --frame=120 --scale=1.5625 --gl=angle   # mid-assembly
npx remotion still CubeAssembly-Blue out/CubeAssembly_Blue_f250.png --frame=250 --scale=1.5625 --gl=angle   # assembled
```

`bash scripts/render-stills.sh` renders all twelve (look 1: frames 150 and
450; look 2: frames 120 and 250) plus a 1080p PNG of each composition.

---

## Measured render time

Measured in this build environment: 4 vCPU, **no GPU** (Chromium SwiftShader
through ANGLE), Remotion concurrency 3, CPU fully saturated. A GPU machine will be much faster —
treat these as an upper bound.

| | 1080p (`--scale=0.5`) measured | 4K measured | 4K full composition (this machine) |
|---|---|---|---|
| **Look 1 — Cube Cluster** | **2.5 s / frame** (Violet 2.51, Blue 2.48; Green 4.37 while the machine was shared with other jobs) | **≈ 8.5 s / frame** | 600 frames ≈ 85 min per palette |
| **Look 2 — Cube Assembly** | **≈ 4.0 s / frame** (Blue 4.36, Violet 4.00, Green 3.95) | **≈ 12.8 s / frame** | 300 frames ≈ 64 min per palette |
| 6000×3375 still | — | — | ≈ 15–25 s each (after ~10 s browser start) |

4K was measured by rendering 12 frames at `--scale=1` (first frame / browser
start excluded). 4K costs about 3.4× the 1080p frame (4× the pixels; some
passes run at fixed resolution). **Estimate on a machine with a real GPU:
roughly 5–20× faster than this.**

Where the time goes (look 2, 1080p, one tab, measured with
`scripts/bench.mjs` switching parts off): everything on 4.75 s;
without depth of field 3.12 s (DoF ≈ 1.6 s); without bloom 4.33 s;
without SMAA 4.68 s; without the floor reflection 4.46 s; with all four
off 2.03 s. 4× MSAA was tried first and cost ≈ 2.8 s/frame, so SMAA is used
instead.

---

## How it is built

```
src/
  palettes.ts            ← one row per palette (see "How to add a palette")
  rng.ts                 ← mulberry32 + the 40/30/15/15 cube-type assignment
  Root.tsx               ← registers CubeCluster-<Palette> and CubeAssembly-<Palette>
  cluster/layout.ts      ← look 1: layout + motion as pure functions of the frame
  cluster/CubeCluster.tsx
  assembly/layout.ts     ← look 2: slots, flight paths, arrival frames (pure)
  assembly/CubeAssembly.tsx
  shared/
    cubeMaterials.ts     ← glowing / frosted / clear glass / dark (fake glass)
    CubeField.tsx        ← one InstancedMesh per cube type
    Floor.tsx            ← glossy floor with blurred planar reflection; look-2 backdrop
    PostFX.tsx           ← bloom → ACES tone mapping → SMAA → vignette → grain
    GrainEffect.ts       ← grain + ±1/255 dither from (pixel, frame)
    Stage.tsx            ← HDRI loading behind delayRender; per-frame render gate
public/hdri/studio_small_03_512.exr
scripts/                 ← render + verification scripts (see below)
```

### Cube types

Every cube is a rounded box (`RoundedBoxGeometry`, radius 0.075). Mix per
look: **40 % glowing, 30 % frosted, 15 % clear glass, 15 % dark**, assigned
once from a seeded `mulberry32` (look 1: 22 / 17 / 8 / 9 of the 56 main
cubes, plus 11 tiny drifting cubes; look 2: 26 / 19 / 10 / 9 of 64).
There is **one `InstancedMesh` per cube type**; per-instance tint and glow
strength are instanced attributes. Transparent instances are sorted back to
front every frame (deterministically, from the frame's camera).

### Glass without transmission

**No real transmission is used anywhere** (no `MeshTransmissionMaterial`, no
`transmission`). Frosted and clear glass are alpha-blended
`MeshPhysicalMaterial`s with a shader patch that adds a Fresnel rim and an
edge term (computed from the cube's object-space position, so the rounded
edges light up), and raises alpha where those are bright. Clear glass also
gets clear-coat reflections of the studio HDRI. Cost of real transmission
therefore: none paid; it was not needed for the look.

### Bloom, tone mapping, grain

Scene renders to a half-float buffer in linear HDR. Bloom (mipmap blur)
threshold is **1.0**, so only emissive cube cores and bright edges bloom; the
floor and background stay below it. Then **ACES filmic** tone mapping, SMAA,
vignette, and finally grain, then sRGB output.

### Floor and reflections

`Floor.tsx` renders the scene from the camera mirrored in the floor plane
(oblique clip plane) into a half-float target every frame, Kawase-blurs it,
and adds it to the floor, fading with distance from the centre. This is the
same technique as drei's `MeshReflectorMaterial`; drei's version multiplies
the reflection into the floor albedo, which made it vanish on these dark
floors, so the project carries its own ~100-line version. Nothing is carried
between frames.

### Look 1 — Cube Cluster

56 cubes on a loose 3D lattice (pitch 1.34) chosen from a jittered ellipsoid
with 7 gaps punched inside, plus 11 tiny cubes drifting outside it. Camera
at 40° above the horizon. Over 600 frames:

* the cluster turns **exactly one full turn** about the vertical axis;
* each cube slides along its own axis toward an empty neighbour cell that no
  other cube slides into, ≤ 0.95 cube width, **1–3 whole cycles**;
* glowing cubes pulse with **1–5 whole cycles**;
* tiny cubes drift and spin with **whole cycles / whole turns**;
* the camera sways on a closed path (1 and 2 cycles);
* grain is driven by `frame % 600`.

### Look 2 — Cube Assembly (does not loop)

| Frames | What happens |
|---|---|
| 0–20 | Empty floor and haze; the first two (glowing) cubes start behind the camera and streak past right beside the lens, out of focus. |
| 34–176 | 64 cubes fly in from above, the sides and behind the camera on seeded cubic-bezier paths, at different speeds (24–48-frame flights), and snap into their slots with a ≈0.02-unit overshoot that settles in 14 frames. Bottom layer first, inner before outer. |
| 190 | Every cube is exactly still in its slot. |
| 190–300 | Hold; glowing cubes pulse gently; camera pushes in 4.5 % (ease in-out). |

No physics: a cube's position is the point on its bezier at an eased
parameter of the frame. Each flight's last leg comes straight into the slot
from an open direction (down from above, or in through an outer face). The
generator tests every candidate flight against every cube already planned
(oriented-box separating-axis test, ⅛-frame steps, 0.02 clearance) and
against the floor, and re-draws any that touch — so **nothing passes through
anything**, and the result is identical on every build.

Depth of field (focused on the cube, half-resolution) gives the soft
foreground of the reference and blurs the streaking opening cubes.

### Determinism

* Everything random comes from module-level seeded `mulberry32` streams.
* Every on-screen value is a function of `useCurrentFrame()` only — no
  `Math.random()`, no `useFrame` clock, no `Date.now()`, no state driving
  visuals, no physics, no temporal effects (no TAA / temporal AO /
  accumulative shadows).
* The HDRI loads behind `delayRender` / `continueRender`; nothing mounts
  until it is there.
* `<FrameGate>` (in `Stage.tsx`) holds a `delayRender` handle on every frame
  until the scene is ready (including the effect composer, which builds its
  passes asynchronously), then renders the WebGL frame explicitly. Without
  this, a cold single-frame render could be captured before post-processing
  existed.

### Motion blur

**Not used.** Remotion's `<CameraMotionBlur>` would multiply render time by
its sample count (×4–6). The "blurred streak" of the opening cubes comes from
depth of field instead, which costs ≈1.6 s/frame at 1080p on the CPU build
machine (see timing).

---

## Banding

The charcoal falloff (look 1) and deep blue / violet / green haze (look 2)
are smooth gradients under bloom. Two measures, both in `GrainEffect.ts`,
applied **after** bloom and tone mapping, in display (sRGB) space:

* **±1/255 dither** per channel;
* **monochrome grain at 1.75 %** (triangular noise), from an integer hash of
  pixel position and frame — never `Math.random()`. Look 1 passes
  `frame % 600`, so the grain loops with the picture.

Intermediate frames are PNG (lossless) so nothing is quantised before
H.264. The check was run on frames **decoded from the encoded mp4**; see
"Verification" for the numbers.

---

## HDRI

`public/hdri/studio_small_03_512.exr` — **"Studio Small 03" by Sergej
Majboroda, from [Poly Haven](https://polyhaven.com/a/studio_small_03),
licensed [CC0](https://creativecommons.org/publicdomain/zero/1.0/)**
(public domain, no attribution required; credited anyway). This is the
512×256 DWAB-compressed EXR conversion distributed in
[`@pmndrs/assets`](https://github.com/pmndrs/assets) (CC0), extracted to a
file and shipped in the project. To use a sharper copy, download the 1k/2k
`.hdr` from Poly Haven, load it with `RGBELoader` in `Stage.tsx`, and keep the
`delayRender` wrapping.

---

## How to add a palette

Add **one row** to `PALETTES` in `src/palettes.ts`:

```ts
{ name: "Amber", glow: ["#fff6e6", "#ffb84d", "#ff8a1f"], frosted: "#ffe2b8", glass: "#ffd9a0",
  dark: "#2a1503", accent: "#ff5a3c", floor: "#1f1004", sky: "#0b0501", haze: "#6a3a10" },
```

* `glow` — glowing cube tints: near-white core tone, mid, saturated.
* `frosted`, `glass`, `dark` — the other three cube kinds.
* `accent` — a few glowing cubes use it.
* `floor`, `sky`, `haze` — look 2 only: floor, background top, and the haze
  colour toward the horizon. (Look 1 always uses the charcoal studio floor.)
* `name` — letters/digits only; becomes the composition id suffix.

That's it: `CubeCluster-Amber` and `CubeAssembly-Amber` appear in the studio
with the same layout, motion and timing as the others.

---

## Verification

Scripts (run from the project root):

| Script | What it checks |
|---|---|
| `npx tsx scripts/verify-motion.ts` | Look 1: no two cubes ever intersect over the loop; motion closes on its own (t = 0 vs t = 1 without the `% 600`). Look 2: no intersections at 1/16-frame steps, nothing through the floor, all 64 slots filled and still by frame 190, frame 0 empty, every start point off-screen or behind the camera. |
| `bash scripts/loop-check.sh` | Step 2: each look-1 composition made 601 frames long (`loopCheck` prop); frames 0 and 600 rendered and compared pixel for pixel — once as delivered, once with the wrap disabled (`noWrap`). Pass a `toggles` object (turn / slides / pulses / tiny / camera / grain) through `PROPS_EXTRA` to bisect a mismatch. |
| `python3 scripts/verify-renders.py` | Steps 1, 3–6 on the encoded previews: ffprobe; cold frame 150 vs frame 150 of the full render (byte compare); every 15th frame (contact sheet + outlier test); banding profile from the encoded mp4; five-frame sheets; palette layout overlays. Writes `out/verify/`. |
| `node scripts/bench.mjs <id> <from> <to> [nodof,nobloom,nosmaa,norefl]` | Per-frame render time, optionally with parts switched off. |

### Results of the verify loop (all on the delivered 1080p previews)

All checks passed on the **first full render** — no composition needed a
second attempt. What was found and fixed *before* the full renders is listed
under "Changes made during the build".

| Step | Result |
|---|---|
| 1 · File checks | All six: h264, yuv420p, 1920×1080, 30/1, no audio. Look 1: 600 frames, 20.000 s. Look 2: 300 frames, 10.000 s. |
| 2 · Loop (look 1) | Green / Violet / Blue: frame 600 vs frame 0 **0 differing pixels**, both as delivered and with the `% 600` wrap disabled. Numerically: poses at t = 0 and t = 1 agree to 3e-15; the 599→600 step (0.0880) equals an ordinary step (0.0881). |
| 3 · Same result every time | All six: frame 150 rendered alone from a cold start is **byte-identical** to frame 150 of the full render. (Encoded mp4 vs source PNG: 40.1–40.3 dB PSNR.) |
| 4 · Loading | Every 15th frame of all six checked (contact sheets in `out/verify/*_every15.png`): no unlit, flat or reflection-less frames. Look-1 frame-to-frame mean luma varies ≤ 1.2 levels; look 2's larger changes follow the build-up. |
| 5 · Banding | Read from frames decoded **from the mp4**. Look 1 floor, lit centre → frame edge (luma 84 → 16): smooth ramp, longest run of one value in a row 6–7 px. Look 2 haze, floor → horizon → sky (luma 8–36): smooth, longest flat run 5–9 px, largest step in the smoothed profile 0.08–0.12 levels. No steps. Profiles: `out/verify/*_banding*.png`. |
| 6 · Content | All four cube types visible in every composition; only cube cores and edges bloom; floor reflects. Look 1: cluster turns, outline changes, tiny cubes drift. Palette overlays (`out/verify/*_overlay_*.png`, luminance of each palette in R/G/B) show every edge coinciding — only colour differs. Look 2: frame 0 empty, 4×4×4 complete and still from frame 190 (checked numerically every frame, and visually), no cube passes through another (separating-axis test at 1/16-frame steps, closest approach 0.026), same timing in all palettes, floor and background take each palette's colour. |

### Changes made during the build (and why)

* **Frames were captured before post-processing existed.** The effect
  composer builds its passes asynchronously after mount; the first test
  render was a blank background. Added the per-frame `<FrameGate>` that
  waits for readiness checks before rendering.
* **drei `MeshReflectorMaterial` showed no reflection** on the dark floors
  (it multiplies the reflection into the albedo). Replaced with the
  project's own additive planar reflector.
* **Look 2 cubes intersected in flight** (first version: 1,203 colliding
  samples). The generator now tests and re-draws flights, so the layout is
  collision-free by construction.
* **Render cost**: 4× MSAA (≈ 2.8 s/frame) → SMAA; depth of field at half
  resolution.
* **4K / 6000-px looked less glowy than 1080p**: bloom radius is
  compensated for the extra mip levels, depth of field and the reflection
  blur run at fixed resolution. Verified as a no-op at 1080p (cold frames
  still byte-identical to the delivered previews).

---

## Completion checklist

- [x] 6 compositions at 3840×2160, 30 fps; look 1 600 frames, look 2 300 frames
- [x] 3D with `@remotion/three`, WebGL2, `--gl=angle`
- [x] Four cube types, rounded edges, 40/30/15/15, seeded
- [x] One `InstancedMesh` per cube type
- [x] Fake glass (no transmission); bloom only on glowing cubes / bright edges
- [x] Glossy reflective floor; charcoal spotlight floor (look 1); deep palette floor + haze (look 2)
- [x] ACES tone mapping, sRGB output
- [x] Look 1: one full turn, whole-cycle slides / pulses / drift / camera; frame 600 = frame 0
- [x] Look 2: fly-in with overshoot, bottom-to-top, nothing passes through anything, still from frame 190, push-in 4.5 %; **does not loop**
- [x] Same layout/motion/timing across palettes; palettes are one data row each
- [x] Grain 1.75 % + ±1/255 dither after bloom, from pixel + frame (`frame % 600` in look 1)
- [x] No `Math.random()` at render time, no clocks, no physics, no temporal effects; HDRI behind `delayRender`
- [x] Cold frame 150 byte-identical to the full render (all six)
- [x] CC0 Poly Haven studio HDRI shipped and credited
- [x] 1080p previews (H.264, yuv420p, CRF 16), 1080p stills, 2 × 6000×3375 stills per composition
- [x] Render time measured at 1080p and 4K
- [x] `npm install && npx remotion studio` works from a clean copy of the zip
