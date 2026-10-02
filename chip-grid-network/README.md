# Chip Grid Network — Remotion + three.js

Four 15-second (450 frames, 30 fps) 3D compositions sharing one scene: an
18 × 18 grid of chip nodes (glass-walled blocks with a circuit chip on top)
linked by three-tube glowing glass cable bundles on a glossy tiled floor.
Infection or protection spreads node to node through the cables:
**blue `#8EC8FF` = safe, red `#FF3B4E` = compromised.**

| Composition id (Remotion) | Output file | Story | Camera |
|---|---|---|---|
| `ChipGrid-ShieldSweepTop` | `ChipGrid_ShieldSweepTop.mp4` | Red network turns blue from the centre (diamond); shield marks replace the chip squares | Top-down, grid at 45°, ≤5% push-in |
| `ChipGrid-AttackPullback` | `ChipGrid_AttackPullback.mp4` | Blue network; red radiates (circle) from the centre node from frame 60 | Close and low (35°) on one node, pulls back, rises and rotates to a grid-aligned top-down view |
| `ChipGrid-AttackSpread` | `ChipGrid_AttackSpread.mp4` | Blue network; red enters from a node off the near-left corner and sweeps diagonally | ~40° oblique, grid at 45°, slow sideways track |
| `ChipGrid-ShieldRecovery` | `ChipGrid_ShieldRecovery.mp4` | Red network; blue spreads from the centre; a floating, camera-facing shield pops up over each safe node | ~35° angled, close (4–5 nodes across), pulls back |

Remotion composition ids may not contain `_`, so the ids use `-`; the output
files use the requested `_` names.

Compositions are defined at **3840 × 2160**. 3D: `@remotion/three`
(react-three-fiber) on **WebGL2**. Every model and texture is built in code.

---

## Quick start

```bash
npm install
npx remotion studio          # or: npm run studio
```

The Studio previews at reduced resolution (device pixel ratio 0.35) to stay
responsive; renders use the exact output resolution.

## Chromium GL flag

WebGL needs a real GL backend in headless Chromium. `remotion.config.ts` sets
`--gl=angle` (GPU through ANGLE). On a machine **without a GPU**, pass
`--gl=swangle` (SwiftShader through ANGLE) instead. The build environment
for this package had no GPU: there `--gl=angle` reported
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`,
i.e. CPU rendering, which is what the timings below measure.

## Render commands

### 4K (3840 × 2160) — one per composition

```bash
npx remotion render ChipGrid-ShieldSweepTop  out/ChipGrid_ShieldSweepTop.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=300000
npx remotion render ChipGrid-AttackPullback  out/ChipGrid_AttackPullback.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=300000
npx remotion render ChipGrid-AttackSpread    out/ChipGrid_AttackSpread.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=300000
npx remotion render ChipGrid-ShieldRecovery  out/ChipGrid_ShieldRecovery.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=300000
```

(`--codec`, `--crf`, `--pixel-format` and PNG frame capture are already the
defaults in `remotion.config.ts`; they are spelled out for clarity.
`--timeout=300000` gives slow machines time for the first frame: generating
the textures and compiling shaders can take over 30 s in software GL.)

### 1080p previews (what was delivered)

```bash
npm run render:previews      # = scripts/render-previews.sh
```

Renders every frame as a lossless PNG with `--scale=0.5` (1920 × 1080), then
encodes with ffmpeg: H.264 (libx264, preset slow), `yuv420p`, 30 fps, CRF 16,
no audio. Keeping the PNGs allows the byte-for-byte determinism check. A
direct one-step equivalent:

```bash
npx remotion render ChipGrid-AttackSpread out/ChipGrid_AttackSpread.mp4 --scale=0.5 --gl=angle --crf=16 --timeout=300000
```

### Stills

```bash
# 6000 x 3375 PNG (scale 1.5625 of the 3840 x 2160 composition)
npx remotion still ChipGrid-ShieldSweepTop out/ChipGrid_ShieldSweepTop_mid_6000.png --frame=150 --scale=1.5625 --gl=angle --timeout=600000
# 1080p PNG
npx remotion still ChipGrid-ShieldSweepTop out/ChipGrid_ShieldSweepTop_1080.png --frame=300 --scale=0.5 --gl=angle
```

`npm run render:stills` (= `scripts/render-stills.sh`) renders every
delivered still:

| Composition | 6000 × 3375 mid-spread | 6000 × 3375 end | 1080p |
|---|---|---|---|
| ShieldSweepTop | frame 110 | frame 440 | frame 110 |
| AttackPullback | frame 200 | frame 440 | frame 200 |
| AttackSpread | frame 180 | frame 440 | frame 180 |
| ShieldRecovery | frame 150 | frame 440 | frame 150 |

A 6000 × 3375 still took 97 s in the software-GL build environment.

### Quality knobs (optional)

`--props='{"reflectRes":1024,"shadows":true,"dof":true,"maxLum":16,"msaa":0}'`
overrides the defaults: floor-reflection render-target size (default scales
with output: 512 at 1080p, 1024 at 4K, 2048 at 6000 px), key-light shadow
map (on), depth of field (on), firefly clamp (max HDR luminance 16) and MSAA
samples (0 — anti-aliasing is FXAA; see *Why FXAA* below).

---

## Render time

MEASURED_TIMING_PLACEHOLDER

---

## How it works

### Scene (shared by all four compositions)

- **Grid:** 18 × 18 nodes, spacing 4 units, each node linked to its four
  neighbours (612 links × 3 tubes). Node (9, 9) sits at the origin.
- **Node:** chamfered (octagonal) plan. Dark gunmetal plinth with a step and a
  thin glowing foot line in the node's colour; fake-glass walls (1.6 × 1.6,
  1.16 tall) with dark corner posts; faint glowing circuit traces on an inset
  inner layer; brushed-aluminium top plate with a dark-green PCB inset and a
  dark die. 8 % of nodes (seeded) have a frosted, glowing white top instead.
  A socket bracket with three collars on each side.
- **Cables:** three parallel glass tubes per link (radius 0.08, spacing 0.18)
  with an emissive core that is brighter where it enters the sockets, a bright
  head on the moving colour front, and faint pulses running along it.
- **Floor:** slate tiles, one per grid cell with a half-cell seam and a faint
  1-unit sub-grid, bevelled via a normal map; `MeshReflectorMaterial` with blur
  and roughness, so nodes and cables reflect softly.
- **Light spill:** one additive plane over the floor looks up the nearest
  links and node in a data texture of switch times and adds a soft glow in the
  local colour, so red/blue light follows the spread front exactly (the
  "emissive floor decal" option, done for every link in one shader).
- **Shield mark:** self-drawn SVG (shield outline + check) parsed with
  `SVGLoader` into `ShapeGeometry`. Comp 1: flat on the top plate, the PCB
  darkens and the shield scales 0.9 → 1 with a fade and a white glint.
  Comp 4: floating, camera-facing billboard, scales 0.9 → 1 with a fade and
  rise, then bobs gently.
- **Lighting:** Poly Haven studio HDRI as the environment (highlights
  soft-compressed on load; the softboxes peak at ~3400 and otherwise blow out
  every glossy surface), cool overhead key with soft shadows, dim hemisphere
  fill, light haze (fog).
- **Post:** firefly clamp (caps HDR luminance at 16) → depth of field (full
  resolution) → bloom (threshold 1.35 on HDR values, so only emissive parts
  bloom) → **ACES filmic** tone mapping → FXAA → dither + grain → sRGB.
  DOF is mild in comp 1 and stronger in comps 2–4; the in-focus range is a
  fraction of the camera's focus distance, so it scales as cameras move.
- **Fake glass:** `MeshPhysicalMaterial` without transmission: low base
  opacity, alpha rising with Fresnel, and reflections/specular written
  premultiplied so rims stay bright. Front faces only.
- **Instancing:** one `InstancedMesh` per part (plinths, foot lines, posts,
  inner traces, walls, tops, PCB insets, frosted insets, dies, sockets, cores,
  tube glass, shields). Per-instance attributes carry switch times, so the
  spread is a shader parameter (`uFrame`), not new materials.

### Spread (all four compositions)

`src/lib/spread.ts` — worked out from grid distance, never stored as it happens:

1. Source node(s) per composition.
2. Distance from the source in grid steps: breadth-first (Manhattan; diamond
   front) for comps 1 and 3, straight-line (circle-ish front) for comps 2 and 4.
   Plus seeded jitter (±20 % of a step for BFS, ±15 % for radial).
3. `tNode = tStart + steps × stepFrames`, then a causality pass guarantees
   every node a neighbour that switched at least 0.45 steps earlier.
4. **Cable fill:** each link fills from the node that switches first toward
   the other, `fill = clamp((frame − tEarlier) / (tLater − tEarlier), 0, 1)`,
   so the front reaches the far node exactly when it switches. If the two ends
   switch closer together than 0.45 steps (tangential links in the radial
   comps), the cable fills from both ends at that minimum travel time and the
   fronts meet, so no cable ever flips without a visible front.
5. The receiving node switches with a 6-frame flash (and bloom pulse).

| Comp | Source | Metric | stepFrames | tStart |
|---|---|---|---|---|
| 1 | centre node (9, 9) | BFS | 30 | 24 |
| 2 | centre node (9, 9) | radial | 38 | 60 |
| 3 | node (6, 14), off the near-left corner | BFS | 16 | 20 |
| 4 | centre node (9, 9) | radial | 33 | 30 |

`stepFrames` is above the suggested 8–12 on purpose: the brief also asks for
the spread to cover the visible grid in about 8 seconds, and with the node
density of the references only 6–8 grid steps are visible from the source.
At 8–12 frames per step the visible spread would be over in 2–3 s. The values
were tuned so the visible spread takes 6–8 s (see the spread check below).

### Why FXAA, front-face glass and full-resolution DOF

The first full renders failed the one-frame flicker check (see Verification).
Under SwiftShader three things produced isolated single-frame pops:
multisampled (MSAA) HDR rendering left bright specks inside flat faces; lit
double-sided glass panes sometimes flipped their facing for one frame; and
the half-resolution DOF near field shimmered at the frame edge. The fixes:
FXAA instead of MSAA (post-process, no texture loading, so it stays
deterministic), glass and sockets render front faces only, DOF at full
resolution with the bokeh retuned to keep the look, plus rougher glass and an
HDR firefly clamp so a sub-pixel specular glint can never bloom into a blob.
On a GPU, `--props='{"msaa":4}'` brings MSAA back if wanted.

### Determinism

- No `Math.random()`, `Date.now()`, `useFrame` clock or state-driven visuals.
  Every value on screen is a function of `useCurrentFrame()`: a layout effect
  sets `uFrame` and the camera before `<ThreeCanvas>` calls `advance()`; the
  floor reflector renders in a priority-0 frame callback and the composer in a
  priority-1 callback within that same `advance()`.
- Seeded `mulberry32` (module-level seeds) for jitter, white tops, pulse
  offsets and all procedural textures.
- The post-processing composer is created synchronously, so a cold
  single-frame render already has every effect.
- Grain and dither come from an integer hash (`pcg3d`) of pixel position and
  frame.
- No TAA, temporal AO or accumulated shadows. HDRI loading is wrapped in
  `delayRender` / `continueRender`.

---

## Verification

Run in this order; every script is in `scripts/verify/`. Full results for
the delivered renders: `VERIFY.md` (copied from `renders/verify/SUMMARY.md`).

| Step | What | How |
|---|---|---|
| 1 | File checks | `ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of default=noprint_wrappers=1 <file>` |
| 2 | Determinism | `scripts/verify/determinism.sh <CompositionId> 300` — cold single-frame still vs frame 300 of the full multi-threaded render, `cmp` byte for byte |
| 3 | Spread | `npm run verify:spread` (logic: causality, front direction/speed, front shape, end state, source placement) + `scripts/verify/contact-sheets.sh <mp4>` (every 10th frame) |
| 4 | Banding | `node scripts/verify/banding-check.mjs <mp4> 300 x,y,w,h ...` on the encoded file |
| 5 | Content | `contact-sheets.sh` also writes five evenly spaced frames |
| + | One-frame pops | `node scripts/verify/flicker-check.mjs <mp4> 40` (run automatically by `render:previews`) |

### Banding check

The frame is taken **from the encoded mp4**, saved as a PNG, and the
analysis reads the frame's Y plane exactly as encoded (converting limited-range
video to full-range RGB skips about every 7th code value, which would look
like gaps). For each rectangle — dark floor areas plus a glow falloff — it
reports code coverage between the 5th and 95th percentile, the longest and
mean run of identical neighbouring values, and a 16-column averaged profile.
Pass: coverage ≥ 95 %, max run ≤ 24 px, mean run ≤ 1.6 px.

Control: the same frame with grain and dither blurred away, re-encoded the
same way, **fails** every region (max runs 20–40 px, mean runs 2.3–3.3 px),
while the delivered frames measure max runs 4–10 px and mean runs
1.12–1.26 px. Dither is ±1/255 (triangular) and grain ±2 %, both from an
integer hash of pixel position and frame, applied in sRGB after tone mapping
and bloom.

---

## Project layout

```
remotion.config.ts           CLI config (GL, PNG capture, h264/yuv420p/CRF 16)
src/index.ts, src/Root.tsx   Remotion entry + the four compositions
src/ChipGridComposition.tsx  ThreeCanvas wrapper, HDRI gate, device pixel ratio
src/compositions/defs.ts     per-composition story, spread and camera
src/lib/                     grid layout, spread timing, seeded PRNG, quality knobs
src/scene/                   scene, geometry, materials/shaders, textures, post FX
public/hdri/                 Poly Haven HDRI + licence
scripts/                     preview render, stills, bench, verification
```

## Completion checklist

CHECKLIST_PLACEHOLDER
