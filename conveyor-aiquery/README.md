# AI Query Network (Remotion + three.js)

Two compositions, 3840×2160 @ 30 fps, built entirely in code (three.js on
WebGL2 via `@remotion/three`, no MCP servers, no external assets except the
Inter font).

| Composition id | Length | What it is |
|---|---|---|
| `AIQuery-Story` | 450 frames (15 s) | A search bar types **"Ask Me Anything"**, a chip lights and extrudes into a glowing cube, ~3,000 fibre strands burst out and branch three levels deep into clusters of data cubes, a violet path traces the route and the camera follows it to the answer cube, which flares and holds. |
| `AIQuery-FibreLoop` | 600 frames (20 s) | The finished network, seamless loop: the camera drifts on a closed path beside a mid-network hub, beads travel along strands and cubes flicker, all in whole cycles (frame 600 = frame 0). |

> **The Parcel Conveyor look is not included.** It failed the realism gate
> (three rounds; see "Realism gate result" below) and was dropped as the brief
> required. Its code stays in git history (commit "Add conveyor + AI query
> Remotion project …"), and the gate stills are in `../rejected/` (outside
> this project and outside the zip).

## Setup

```bash
npm install
npx remotion studio          # preview
```

Node 18+ is required. Versions are pinned in `package.json` (Remotion 4.0.515,
three 0.183.2, @react-three/fiber 9.5.0, React 19.2.3).

### Chromium GL flag

Rendering needs **WebGL2 through ANGLE** — `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")` (CLI equivalent: `--gl=angle`).
WebGPU is not used. On a machine with a GPU, ANGLE uses it; without one,
Chromium falls back to SwiftShader (that is how the timings below were made).

## Render commands (4K)

```bash
npx remotion render AIQuery-Story     out/AIQuery_Story_4K.mp4     --gl=angle
npx remotion render AIQuery-FibreLoop out/AIQuery_FibreLoop_4K.mp4 --gl=angle
```

The config already sets h264, `yuv420p`, CRF 16, PNG intermediate frames and
**muted** output (no audio stream).

720p previews (what was rendered here):

```bash
npx remotion render AIQuery-Story     out/AIQuery_Story.mp4     --scale=0.3333333333333333
npx remotion render AIQuery-FibreLoop out/AIQuery_FibreLoop.mp4 --scale=0.3333333333333333
```

`--scale=1/3` gives exactly 1280×720 (checked with ffprobe), so no
downscale step is needed.

### Stills (6000×3375)

```bash
npx remotion still AIQuery-Story     out/AIQuery_Story_6K.png     --frame=440 --scale=1.5625 --gl=angle
npx remotion still AIQuery-FibreLoop out/AIQuery_FibreLoop_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375. Not rendered here.)

## How it is built

- `src/gl/GLStage.tsx` — hosts a `ThreeCanvas`; a stage object renders each
  frame from `useCurrentFrame()` only (R3F's clock is never used). The buffer
  follows Remotion's `--scale` (devicePixelRatio).
- `src/gl/post.ts` — fullscreen passes: depth-of-field gather with a fixed
  96-tap golden-angle pattern (fixed per-pixel rotation), a 6-level bloom,
  ACES filmic tone mapping, sRGB, and shared GLSL helpers.
- `src/aiquery/network.ts` — the seeded branching tree (`mulberry32` at module
  level): root fan 1,200 strands → 4 level-1 hubs → 12 sub-fans of 110 →
  48 leaf clusters (~3,050 strands, ~400 cubes), the violet route and the
  answer lattice.
- `src/aiquery/stage.ts` — strands are instanced screen-space ribbons (cubic
  Béziers evaluated in the vertex shader, 1.5 px at 4K, additive); a thin
  line's depth of field widens and dims it in the vertex shader. Cubes are an
  instanced mesh rendered with depth and blurred by the DoF gather. Dust is
  3,000 points whose size follows their circle of confusion. Final pass:
  bloom, vignette, grain, dither.
- Fonts: Inter (SIL OFL 1.1), `public/fonts/` with `OFL.txt`; the only text is
  "Ask Me Anything".

### Determinism

Every value on screen is a function of the frame number: no `Math.random()`
at render time, no `Date.now()`, no state carried between frames, no TAA.
Textures and the font are built/loaded once, behind `delayRender`. Grain uses
`frame % 600` (`% 450` in 2A) and pixel position; DoF/bloom use fixed patterns.

### Loop (2B)

The camera path is one closed lap per 600 frames; beads make 1–3 whole trips,
cubes flicker 1–3 whole cycles and dust drifts 1–2 whole cycles. The stage
uses the **raw** frame number (not `frame % 600`), the shaders take
`mod(t, 600)` per term, so the frame-0 / frame-600 test below is meaningful.

## Measurements

All numbers were measured in this build environment: 4 CPU cores, **no GPU**
(Chromium's WebGL2 runs on SwiftShader, software rasterisation), Remotion
`--concurrency=1`. Higher concurrency did not help here, because SwiftShader
already uses ~3.3 cores.

| Composition | 720p preview, full render | per frame at 720p | 4K per frame (frame 240 = 8 s) | 4K estimate, whole comp (this box) |
|---|---|---|---|---|
| `AIQuery-Story` (450 f) | 608 s | **1.35 s** | **9.1 s** (5-frame minus 1-frame render) | ≈ 68 min |
| `AIQuery-FibreLoop` (600 f) | 796 s | **1.33 s** | **8.9 s** | ≈ 89 min |

- A single cold 4K frame (bundle + browser start + scene build + render) took
  28.4 s for 2A frame 240.
- On a machine with a real GPU these drop by roughly an order of magnitude
  (the cost is pixel shading — DoF gather, bloom, ~390k ribbon triangles), so
  expect very roughly 0.5–1.5 s per 4K frame, i.e. about 5–15 min per
  composition. That is an estimate, not a measurement.
- Conveyor 1A (dropped), for the record: 3.2 s/frame at 720p after LOD
  optimisation (8.4 s before); one cold 4K still took ~75 s.

## Verification

Run before delivery (results for the final renders):

1. **File checks (ffprobe)** — both: h264, 1280×720, 30/1, yuv420p, **video
   stream only** (Remotion added a silent AAC track on the first render; fixed
   with `Config.setMuted(true)`). Durations 15.000000 s (450 frames) and
   20.000000 s (600 frames). ✅
2. **Loop (2B)** — composition temporarily set to 601 frames; frames 0 and
   600 rendered as PNG: **byte-identical**. ✅
3. **Determinism** — frame 300 of each composition rendered alone from a
   cold start vs. frame 300 from a sequence render (frames 280–300, same tab):
   **byte-identical** for both. ✅
4. **Banding** (pixel values read from frames of the encoded mp4s, 10–12 px
   box means):
   - 2A frame 30 (navy gradient + glow), blue channel down the frame
     `60.2 60.9 60.8 58.0 54.8 53.7 49.4 49.0 48.1 47.8 46.8 45.8 44.2 42.3 39.3 36.9 35.3`;
     largest step between neighbouring pixels after 9-px smoothing 0.89/255.
   - 2B frame 150 (background void), blue channel
     `27.6 26.3 27.2 29.1 28.7 29.7 31.3 31.9 32.3 32.7 32.7 32.5 32.9 34.4`.
   - Smooth gradients with no plateaus or steps; grain survives encoding
     (σ ≈ 1.3–1.9 code values in flat patches). Grain is 1.5 %, dither ±1/255,
     both from pixel position and `frame % 600` (`% 450` in 2A). ✅
5. **Content (contact sheets)** — 2A: the bar types "Ask Me Anything" with a
   cursor, the chip lights and becomes the cube, the strand burst, branching
   fans with cube clusters, the violet path, and the final cube flaring and
   holding. 2B: fly-past of the finished network with pulses and flicker. No
   logos, brands or real codes. ✅
6. **Motion** — mean frame-to-frame difference (320×180 luma) over 2B frames
   285–345: 1.10–1.51, changing by ≤ 0.06 per frame (steady). 2A 3–7 s:
   rises and falls smoothly (ease into the push-in key at frame 122, then
   the swing); no single-frame spikes. Strands are 1.5 px at 4K
   (coverage-scaled to ≥1 px at 720p) and don't crawl. ✅
7. **Self-comparison with the reference** — done between rounds (see 8).
8. **Separate-agent comparison, 3 rounds each** — see "Step 8 results" in the
   section below. **Significant differences remain after the third round
   for both 2A and 2B**, listed there; they were not all fixed.

### Completion checklist

- [x] 2A Query Story 15 s, 2B Fibre Loop 20 s, 3840×2160 @ 30 fps compositions
- [x] three.js on WebGL2 via `@remotion/three`, `--gl=angle`, no WebGPU, no PixiJS
- [x] ~3,000 instanced strand ribbons, ~400 instanced cubes, 3,000 dust points
- [x] DoF gather with a fixed pattern; bloom; vignette; dither + grain last
- [x] Only text: "Ask Me Anything" (Inter, OFL, licence included)
- [x] Deterministic (seeded at module level, frame-driven); 2B loops exactly
- [x] 720p previews + stills; this project zip without node_modules/refs/renders
- [ ] Step 8: reference comparison not passed after three rounds (see report)
- [ ] Conveyor look: dropped (realism gate failed)

## Realism gate result (Parcel Conveyor) — FAILED, look dropped

Composition 1A (Side View) was built first, as the brief required. The
gate frame was frame 300 at 720p.

**Model check** — each round, a fresh sub-agent saw only the still and the
question "Is this a photograph or computer graphics? …".

| Round | Verdict | Main issues it listed | What I changed before the next round |
|---|---|---|---|
| 1 | "computer graphics (a 3D render) … a fairly convincing one" | Boxes "perfectly clean and geometric"; no flap seams; truncated tape with no sheen; "uniform, fine, noise-like" cardboard texture; detail-less rollers and rails; "soft, even and directionless" lighting; synthetic blur with no bokeh highlights; heavy vignette | More bulge, dents and stains; glue joint; less fine grain; tape clearcoat; glossier labels; brighter rails and nuts; harder key light plus overhead point lights; bokeh light sources; gentler vignette; lens chromatic aberration |
| 2 | "fairly confident this is computer graphics … close to photoreal at first glance" | Still "far too clean"; decal-like tape and labels; "no clear contact shadow … slightly pasted on"; light still uniform; "perfect, smooth" synthetic bokeh; repetitive background | Raking key light; baked contact occlusion; brighter satin rollers; curled label corners; bokeh onion-ring and cat-eye; more varied rack stock; creases |
| 3 | "computer graphics (a 3D render) … fairly convincing" | Large box "a nearly perfect, clean block"; "almost no contact shadow onto the conveyor, so it looks pasted in or floating"; "Shadows are weak or missing"; "uniform, soft studio-style key lighting"; "boxes seem to hover just on the rollers" | — (third round used) |

All three described the scene as cardboard boxes on a roller conveyor in a
warehouse, but the last one still lists **major** fakeness issues (floating
or pasted-in boxes, missing shadows, studio lighting). The pass condition
was not met. Per the brief the conveyor look was dropped: 1B–1D were never
built, and its compositions and code were removed from this project. The
reference comparison half of the gate was not run, because passing needs
both halves. Stills from every round: `../rejected/gate_round{1,2,3}_frame300.png`.

## Step 8 results (separate-agent comparison with the reference)

Each round used a fresh sub-agent that saw only one reference frame, one
preview frame and the brief's instruction. The reference was `1491463133`
at 12.5 s for 2A (hold) and 7.6 s, mid-network, for 2B.

**2A (hold frame 440).**

- Round 1 flagged:
  - outlined, white "wireframe" cubes, too small and too many;
  - a missing fibre fan on the right;
  - a white-hot answer cube;
  - a dense straight-line mesh;
  - a straight, thin beam;
  - a too-dark background.
- Fixed after round 1: solid shaded cubes, now fewer and bigger; a right-hand fibre fan; curved links between cubes; a glassy answer cube; a curved, thicker beam; a lifted navy background.
- Round 2 flagged:
  - the fan read as a "starburst" with a hot knot;
  - spark-like beads;
  - pale cubes with no column layout;
  - a steep diagonal beam;
  - a too-bright background.
- Fixed after round 2: a soft, defocused fibre bundle; dimmed beads in 2A; saturated cubes in columns and layers; an answer cube that faces the camera; a hold camera that looks across the beam; a darker background.
- **Round 3 (last) still lists:**
  - depth of field too uniform (the reference is sharp on the left and blurred on the right);
  - a right-hand bundle that reads as "sticks" rather than a silky converging fan;
  - more cubes and hairlines than the reference;
  - a background darker than the reference;
  - a smaller, less saturated answer cube and beam.
- **Not fixed:** the three rounds were used up.

**2B (frame 300).**

- Round 1 flagged:
  - no central focal burst;
  - a lopsided, foggy layout;
  - a too-bright background;
  - a hooked pink beam;
  - cream "rice-grain" particles.
- Fixed after round 1: a new camera loop around the violet route's hub; crisper strands; a darker background; cyan beads.
- Round 2 flagged:
  - a weak burst;
  - the beam crossing the whole frame;
  - dense, hazy strands;
  - no dark voids;
  - one rigid column of squares.
- Fixed after round 2: tighter convergence at the hubs; the violet route ends at the hub, with a blue-white continuation to a glowing dot; darker voids; square dust motes.
- **Round 3 (last) still lists:**
  - two stacked hub bursts instead of one curved, feather-like fan;
  - a steeper, pinker beam;
  - denser, more uniform strands with less depth layering;
  - a column of large squares instead of dotted arcs of tiny squares;
  - a free-floating end dot.
- **Not fixed:** the three rounds were used up.

**Deliberately not reproduced:**

- The reference's small "Data" labels, because the brief allows only "Ask Me Anything" as text.
- Its red and green chromatic edge strands.
- The stock-agency watermark.
