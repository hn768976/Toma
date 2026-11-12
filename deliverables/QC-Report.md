# Quality-Control Report — Data Cube Assembly & Topographic Network Pins

## Deliverables

| # | File | Description |
|---|---|---|
| 1 | `Version-1_Data-Cube-Assembly_1080p.mp4` | Composition 1, V1: matches reference A (glowing voxel data core on a circuit city) |
| 2 | `Version-2_Data-Cube-Assembly_Low-Orbit-Crane_1080p.mp4` | Composition 1, V2: alternative **camera angle and movement** (low hero-angle orbit, then crane up to a near top-down orbit) |
| 3 | `Version-1_Topographic-Network-Pins_1080p.mp4` | Composition 2, V1: matches reference B (neon contour map, avatar pins rising) |
| 4 | `Version-2_Topographic-Network-Pins_Aurora-Palette_1080p.mp4` | Composition 2, V2: alternative **colour palette** (teal contours, magenta pins, deep-navy night) |
| 5 | `Data-Cube-Assembly_Remotion-4K-Project.zip` | Remotion project with both 4K compositions for #1 and #2 |
| 5 | `Topographic-Network-Pins_Remotion-4K-Project.zip` | Remotion project with both 4K compositions for #3 and #4 |

**How the alternatives were chosen**
- **Composition 1 (camera):** the reference's look is defined by its blue/orange contrast. Its story, though, is the docking and the reveal, so changing the camera gives a clearly different read without losing the look.
- **Composition 2 (palette):** the reference is a single steady forward glide, and its identity is the colour pairing. Swapping the palette changes the feel most while keeping the choreography intact.

**Technology:** Remotion 4.0.543 (projects scaffolded with `npx create-video --blank`) and Three.js r180 on WebGL 2, with custom GLSL shaders:
- **Composition 1:** depth-of-field gather pass, bloom and ACES grade.
- **Composition 2:** analytic contour-line shader and analytically blurred bokeh billboards.

All assets (textures, avatars, environment) are generated procedurally at runtime, and every frame is deterministic.

## Technical checks (automated: `qc/qc_videos.py`, raw output in `qc/qc_results.json`)

| Check | V1 Data Cube | V2 Data Cube | V1 Topo Pins | V2 Topo Pins |
|---|---|---|---|---|
| Codec / container | H.264 High, MP4 | H.264 High, MP4 | H.264 High, MP4 | H.264 High, MP4 |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames (expected) | 141 (141) | 141 (141) | 480 (480) | 480 (480) |
| Duration vs reference | 4.700 s = 4.700 s | 4.700 s = 4.700 s | 16.000 s = 16.000 s | 16.000 s = 16.000 s |
| Full decode, errors | none | none | none | none |
| Black segments | 0 | 0 | 0 | 0 |
| Frozen segments > 0.5 s | 0 | 0 | 0 | 0 |
| Flicker events | 0 | 0 | 0 | 0 |
| Max frame-to-frame luma jump | 14.2 (the intended cut at frame 40) | 7.8 | 1.5 | 1.6 |
| Audio | none (reference has none) | none | none | none |
| **Result** | **PASS** | **PASS** | **PASS** | **PASS** |

## Project ZIP checks

- **Integrity:** `unzip -t` reports no errors on either ZIP. Each contains `src/` (compositions, scene code, shaders), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, an ESLint config and a README with commands. `node_modules` is excluded; it is reinstalled with `npm ci`.
- **Clean-room test:** both ZIPs were extracted to an empty folder, then:
  - `npm ci`: OK
  - `tsc`: OK
  - `npx remotion compositions` lists all four compositions at **3840×2160, 30 fps, 141 / 480 frames**.
  - `npx remotion render <id> out/test.mp4 --frames=…` rendered native **3840×2160 H.264** frames for all four compositions, with exit code 0.
- **Deliverables:** produced with the documented command, `npx remotion render <id> <out>.mp4 --scale=0.5`. This renders the 4K composition and downsamples it to 1080p.

## Visual verification (independent reviewer agent)

A separate agent compared each render against its reference at matched timestamps, using side-by-side pairs, frame strips and luma curves. It ran several rounds, and each round's findings were fixed before the final render.

- **Composition 1, V1:** "Mostly matches; acceptable as a final."
  - The cut lands frame-exact at frame 40.
  - Close-up brightness is 84 vs 85 in the reference; the wide-shot grade settles at 48 vs 51.
- **Composition 1, V2:** "Deliverable, yes."
  - It is clearly distinct (low orbit, then crane to top-down) and keeps the docking, ignition and light-spread concept.
- **Composition 2, V1:** "Mostly matches; acceptable as a final."
  - The horizon height, the maroon/violet palette, near-pin bokeh, forward speed and pin heights all match.
- **Composition 2, V2:** "Confirmed, deliverable."
  - It is clearly a different palette, with the same choreography, and stays legible: the floor is near-black and the pins pop.

### Defects found during QC and fixed

- **Data Cube V2, black squares (frames 9–16):** an invalid (NaN) pixel was being smeared by the bloom pass. A NaN/Inf guard now sits in the post pipeline. All 141 frames re-verified clean.
- **Data Cube V2, stray blue orb (frames 70–108):** a key-light specular glint in the crane view. Removed.
- **Data Cube V1:**
  - The top core now glows while the module docks.
  - The cut moved to frame 40.
  - The oversized bloom halo and the flat orange tiles are gone.
  - The flare spot is gone.
- **Topo Pins:**
  - Square-edged bokeh on near avatars and stems is fixed.
  - The pin timeline is about 4 s earlier.
  - Depth of field is stronger and the dolly faster.
  - Stem bars no longer appear in the sky.
  - V2's lifted blacks are fixed.

### Known minor differences (accepted)

- **Data Cube V1:**
  - The cube's shell voxels are more regular than the reference's rough voxels.
  - The close-up ground is blue-grey rather than strongly cyan.
  - There are fewer dot-matrix particles.
- **Topo Pins V1:**
  - At 2 s the first pins are faint horizon dots; the reference shows stems about 1 s sooner.
  - The badge fill is cream rather than orange-tinted.
  - The far pin field reads as a dense glowing band.
- **Data Cube V2:** the top-down floor has a slightly warm-brown cast from the core's spill light.
- **Pixel format:** the MP4s are full-range 4:2:0 (`yuvj420p`), Remotion's output for this pipeline. They play correctly in standard players.
- **Native 4K:** out-of-focus areas show a fine stochastic depth-of-field grain. It averages out in the 1080p deliverables.

## Render notes

The renders use Chromium with SwiftShader (software WebGL), so they need no GPU. On this 4-core machine, each run took about 23–26 minutes (141 frames at 4K for a Data Cube video, 480 for a Topo Pins video). On a machine with a GPU, add `--gl=angle` for much faster renders.
