# QC report: two references -> four videos

| # | File | Composition | What it is |
|---|---|---|---|
| 01 | `01-V1-circuit-chip-beam.mp4` | `V1-circuit-chip-beam` | Reference A, matched |
| 02 | `02-V2-circuit-chip-beam.mp4` | `V2-circuit-chip-beam` | Reference A, **palette changed** (ember orange + gold) |
| 03 | `03-V1-golden-hourglass.mp4` | `V1-golden-hourglass` | Reference B, matched |
| 04 | `04-V2-golden-hourglass.mp4` | `V2-golden-hourglass` | Reference B, **camera movement changed** (push-in on an arc) |

Videos and project ZIPs are in `deliverables/`. Projects: `circuit-chip-beam-project.zip`,
`golden-hourglass-project.zip` (4K compositions, source, config, README). Paths in this report are
relative to the repository root; the supporting images and tables are in `qc/`.

**Short names.** The Inputs block of the brief still held its placeholders, so I named the references
myself: `circuit-chip-beam` (reference A, `...1083716650-preview.mp4`) and `golden-hourglass`
(reference B, `...1067717630-preview.mp4`).

**Headline result.** All technical checks pass for all four videos (specs, duration, integrity, frame
scan, determinism, ZIP test). The look and visual-match targets are **only partly met**: after three
look-dev rounds and three visual-match rounds per reference, between 6 and 18 of the 29 look measures are still
outside the +-10% target depending on the video and frame, and the independent reviewers still list visible
differences. Reference A is a close stylistic match; reference B is live-action macro footage of real
glass and is reproduced as a stylised CG hourglass, not a photoreal one. Details are in sections 3, 5 and 8.

---

## 1. Step 2 analysis

### Reference A: circuit-chip-beam

| | |
|---|---|
| Duration | 14.680 s (ffprobe), 25 fps, 367 frames, 596x336, no audio |
| Frames at 30 fps | round(14.680 x 30) = **440 frames** = 14.667 s. Difference 13.3 ms (under one frame) |
| 2D or 3D | **3D.** The camera dollies in, orbits about 40 degrees, drops from about 37 to 18 degrees elevation and rolls about 30 degrees; the die has thickness and the beam has parallax. That needs a real perspective camera |
| Loops? | **No.** First frame is a wide high view, last is a low rolled close-up |
| What it shows | A dark circuit board seen in perspective. A chip sits inside a glowing electric-blue square frame. Thin traces with 45-degree bends, small white and cyan parts, clusters of thin cyan bars. A column of fine teal light streaks rises from the die |
| Colours (sampled) | board `#141d2d` to `#1a2a49`, corners `#04050a`, lit board near the chip `#204d78`, frame glow `#1b375b` to white-blue core, beam `#0d6c85` / `#216e94`, die top under the beam `#0e5892`, traces `#172741` up to near-white |
| Timing beats | 0-1.0 s fast push-in on a small dim chip; ~0.6-1.2 s light runs out along the traces and the board flashes blue; ~0.8 s first streaks, ~2.5 s beam fully up; 1.0-2.3 s die rises; 2.5-4 s hold; 4-14.7 s slow orbit, descent and roll; from ~11 s the far board edge and black void enter top-left |
| Light | The only sources are in the scene: the neon frame (cool blue, soft, low, spilling a pool on the board) and the beam (teal, from above). No white light. Glow falls off smoothly; the board is otherwise near-black |
| Atmosphere | Blue haze pooled around the chip, a few soft out-of-focus teal dust dots, shallow depth of field (far and near board soften), strong vignette, fade to black at distance |
| Texture | Gritty, mottled board with fine relief and many tiny parts; hair-fine beam filaments; mild grain/compression noise; overall slightly soft |
| Technology | three.js (WebGL 2) for the scene, instanced geometry for traces/parts/streaks, custom GLSL materials, hand-written post chain (half-float MSAA target, bloom mips, depth-of-field blur, ACES, grade, vignette, grain, dither). No textures or models: everything is procedural and seeded |
| Version 2 | **Palette.** The reference already has a complete camera move, so a palette swap is the single change that is obvious at a glance and leaves the design intact |

### Reference B: golden-hourglass

| | |
|---|---|
| Duration | 16.950 s (ffprobe), 29.97 fps, 508 frames, 600x316 (1.90:1), no audio |
| Frames at 30 fps | round(16.950 x 30) = **509 frames** = 16.967 s. Difference 16.4 ms (under one frame) |
| 2D or 3D | **3D.** The reference camera is nearly static, so 2D was possible, but the cone of sand, the crater, the glass highlights and above all a Version 2 with camera movement need real geometry |
| Loops? | **No.** The sand runs out at about 13.8 s and the last 3 s show an empty upper bulb |
| What it shows | Live-action macro shot of an hourglass neck, right of centre, on a dark backdrop. Gold glitter sand in the upper bulb, a thin stream through the neck, a transparent lower bulb with a bright diagonal streak and 8-point star-filter glints |
| Colours (sampled) | backdrop `#242422` (matte, lifted black), lighter patch left `#323434`, lower-left `#2c2a29`; sand surface `#c0a378`, sand behind glass `#493628` to `#60432a`, stream `#a68454`, streak `#c0b39e`, glints `#e4d3b1` to white |
| Timing beats | 0-9 s level sinks slowly while the middle dips into a crater; 9-13 s the rim collapses faster and faster; ~13.75 s sand runs out and the stream's tail drops away; 13.8-17 s empty upper bulb with grains clinging to the glass. The framing drifts right by about 4% of the width over the clip |
| Light | Small warm sources from the right and behind (rim light, glints, streak), a softer warm front fill on the sand; cool grey-green backdrop against warm brown-black near the glass |
| Atmosphere | None to speak of (no fog); soft photographic bloom around highlights, shallow depth of field, blacks lifted to about 14% |
| Texture | Fine granular glitter sand, dusty glass with fibrous streak reflections, essentially no film grain (measured 0.0003-0.0007) |
| Technology | three.js (WebGL 2): lathe geometry for glass and sand rebuilt per frame from keyframes, custom GLSL for sand, glass, glints, same post chain as A (no depth pass). No live physics: the sand level is a deterministic function of the frame |
| Version 2 | **Camera movement.** The reference camera barely moves, so a slow push-in on an arc is the clearest single change and shows the scene is genuinely 3D |

Assumptions made instead of asking: the stock watermark is ignored; the hourglass is an original CG
model (no attempt to copy the real object's maker's details); B's 1.90:1 framing is fitted to the 16:9
width, so the videos show slightly more above and below.

