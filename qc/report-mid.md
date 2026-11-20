{{REF_LOOK}}
Units: brightness values are sRGB luma 0..1; `glow_r*` is the distance from the brightest element at
which brightness falls to 50 / 25 / 10 %, in % of frame width; hues in degrees; `grain` is the
high-pass standard deviation in flat areas; `detail_lapvar` is Laplacian variance x 1e4;
`vignette_ratio` is corner / centre brightness. All images are normalised to 600 px wide before
measuring (the references are 596 / 600 px previews), and B is centre-cropped to 1.899:1.

---

## 2. What was built

- **One Remotion 4.0.545 project per reference**, scaffolded with `npx create-video@latest --blank`,
  skills installed with `npx remotion skills add` and `npx skills add CloudAI-X/threejs-skills`.
  All package versions are pinned exactly (`three` 0.187.0, `react` 19.3.1).
- **Compositions** 3840x2160, 30 fps: `V1-` / `V2-circuit-chip-beam` (440 frames),
  `V1-` / `V2-golden-hourglass` (509 frames), plus a 3-frame `LookDev` in each project.
- **V1 and V2 share everything** except the one change: `PALETTE_V1` / `PALETTE_V2` for A,
  `CAMERA_V1` / `CAMERA_V2` for B. Colours, counts, timings are in `src/config.ts`; every look
  setting is in `src/look.ts`.
- **Deviation from the brief's technology table:** I used three.js directly (a plain WebGL 2
  canvas) instead of `@remotion/three` + React Three Fiber, and a hand-written post chain instead of
  pmndrs `postprocessing`. Reason: the determinism rules forbid `useFrame`, and a custom multi-pass
  chain inside R3F needs it; drawing synchronously from `useCurrentFrame()` behind `delayRender()`
  keeps every pixel a function of the frame number only. No MCP servers, no WebGPU, no self-clocked
  animation libraries, no stock or AI-generated imagery; there are no external assets at all.
- **Rules for clean renders:** no `Math.random()` (seeded `mulberry32`), no `requestAnimationFrame` /
  `useFrame` / `Date.now()` / `useState`, half-float render targets, +-1/255 dither skipped on pure
  black and white, no audio. Neither reference loops, so the loop rules do not apply. Neither
  reference sits on a keyable pure black / green / white background (A fades to near-black with a
  vignette, B's backdrop is a lifted matte `#242422`), so the backdrops were matched, not forced to a key value.

---

## 3. Look table

Targets: each measure within +-10 % of the reference (hue within +-10 degrees). **x** marks a
measure outside target. Near-zero values also pass on a small absolute tolerance (listed in
`scripts/measure-look.py`), so a large percentage on a tiny number is not always a failure.

### 3.1 Look-dev stills (final look settings)

Side-by-side images (reference | ours | difference x2), in each project and in its ZIP:

- `circuit-chip-beam/lookdev/compare-start.png`, `compare-peak.png`, `compare-late.png` (0.5 s, 5.0 s, 13.5 s)
- `golden-hourglass/lookdev/compare-start.png`, `compare-peak.png`, `compare-late.png` (0.5 s, 9.0 s, 13.0 s)

{{LOOKDEV_A}}
{{LOOKDEV_B}}
### 3.2 Look over time: 5 frames of each final video against the same moments of its reference

{{LOOK_01}}
{{LOOK_02}}
{{LOOK_03}}
{{LOOK_04}}
**Reading these tables honestly:** the +-10 % target is not met across the board. Out of 29
measures per frame, the number outside target is:

| Video | 5 frames, measures outside target | Outside target in at least 3 of the 5 frames |
|---|---|---|
| 01 V1 chip | 9, 12, 7, 13, 13 | `mean_mid` (5/5), `detail_lapvar` (5/5), `glow_cx`, `contrast_bottom` (4/5), `lum_p50`, `pct_below_5`, `glow_r50`, `contrast_far`, `grain`, `mean_lum` (3/5) |
| 02 V2 chip (hue, saturation skipped) | 13, 10, 9, 13, 14 | `lum_p50`, `glow_r10`, `mean_mid` (5/5), `glow_cx`, `contrast_far`, `mean_lum` (4/5), `lum_p95`, `glow_r50`, `contrast_top`, `contrast_near`, `detail_lapvar` (3/5) |
| 03 V1 hourglass | 13, 12, 11, 9, 10 | `lum_p95`, `hue_midtones`, `contrast_top`, `contrast_far`, `detail_lapvar`, `vignette_ratio` (5/5), `lum_p99`, `glow_r25` (4/5), `lum_p50`, `contrast_bottom`, `contrast_near` (3/5) |
| 04 V2 hourglass (framing-dependent measures skipped) | 3, 2, 3, 5, 4 | `hue_midtones` (5/5), `lum_p95` (3/5) |

- *A:* the middle of the frame is darker than the reference (less blue haze pooled around the
  chip), the median is a little low, and fine detail and grain are below the reference's gritty texture.
- *B:* the real sand's glitter is far denser (`detail_lapvar`), my upper bulb and highlights are
  brighter than the reference's (`lum_p95`, `lum_p99`, `contrast_top`), the corners differ
  (`vignette_ratio`), and the backdrop midtones sit about 10 degrees more olive.
- *Stable over time:* the misses are the same kind from frame to frame, and the frame scan (4.A.4)
  found no flicker or jumps in light, haze or grain.

---

## 4. Step 8 checks

### 4.A Technical

| # | Check | 01 V1 chip | 02 V2 chip | 03 V1 hourglass | 04 V2 hourglass | Result |
|---|---|---|---|---|---|---|
| 1 | Resolution | 1920x1080 | 1920x1080 | 1920x1080 | 1920x1080 | PASS |
| 1 | Codec / pixel format | h264 / yuv420p | h264 / yuv420p | h264 / yuv420p | h264 / yuv420p | PASS |
| 1 | Frame rate | 30/1 | 30/1 | 30/1 | 30/1 | PASS |
| 1 | Frame count (counted by decoding) | 440 | 440 | 509 | 509 | PASS |
| 1 | Audio streams | 0 | 0 | 0 | 0 | PASS |
| 2 | Duration vs reference | 14.6667 s vs 14.6800 s (13.3 ms) | same | 16.9667 s vs 16.9503 s (16.4 ms) | same | PASS (under 33.3 ms) |
| 3 | Full decode `ffmpeg -v error ... -f null -` | 0 errors | 0 errors | 0 errors | 0 errors | PASS |
| 4 | Black frames (mean < 0.01) | 0 | 0 | 0 | 0 | PASS |
| 4 | Frozen / duplicated frame pairs | 0 | 0 | 0 | 0 | PASS |
| 4 | Brightness jumps (> 0.04 between frames) | 0 (max step 0.0095) | 0 (max 0.0107) | 0 (max 0.0013) | 0 (max 0.0013) | PASS |
| 4 | Flicker (alternating brightness steps) | 0 | 0 | 0 | 0 | PASS |
| 4 | Contact sheet, one frame per second, viewed | ok | ok | ok | ok | PASS |
| 5 | Loop | n/a | n/a | n/a | n/a | references do not loop |
| 6 | Determinism: cold-start frame vs same frame of a running render (PNG, byte compare) | identical (frame 220) | identical (frame 220) | identical (frame 254) | identical (frame 254) | PASS |
| 7 | Look over time | see 3.2 | see 3.2 | see 3.2 | see 3.2 | **PARTIAL**: stable, but not all measures within target |
| 8 | Banding / artefacts at levels x4 | none | none | none (faint H.264 block texture in the flat backdrop at x4) | same | PASS |
| 9 | ZIP test | see section 6 | | see section 6 | | PASS |
| - | File size | 77.3 MB | 75.5 MB | 13.3 MB | 15.5 MB | |

Notes on method:

- Check 4 is `scripts/scan-frames.py` (every frame decoded at 320x180).
- Check 6 compares lossless PNG frames, because the delivered H.264 is lossy and cannot be
  byte-compared: frame N rendered on its own with `remotion still` against frame N at the end of a
  `--sequence` render that started 6 frames earlier. SHA-256 of the pixel data matched in all four.
- Check 8 image: `qc/banding-x4.png`.
- Film grain was reduced in the chip project (0.035 -> 0.022) after the first full render came out
  at 135 MB at CRF 16; grain is expensive to encode and the lighter grain keeps each file under
  100 MB. This is one reason `grain` reads low for A in 3.2.

### 4.B Visual match by separate agents

Each reviewer was a fresh sub-agent given only the frames and the instruction from the brief.

**Step 4A look checks (3 rounds per reference, lighting / atmosphere / texture only)**

| Round | Reviewer's main points | What I changed |
|---|---|---|
| A-1 | Board too bright, saturated royal blue; beam azure not teal, too opaque; traces and white cubes too bright, orange accents and bokeh dots not in the reference; rim glow too thin; no depth of field; visible grain | Neutral board fill, parts flattened, accents recoloured teal, dust cut, frame widened and made bluer, bloom widened, depth of field and vignette up, grain down |
| A-2 | Still too blue and lifted (worst late); beam pale and milky; glow should be a hot core plus a fog pool at the beam foot; too much depth-of-field blur and bokeh; wants grit | Sampled region colours against the reference instead of guessing (board blue channel was 30-60 % high), cut the late blue fill, smaller haze, less blur, fewer dots, uneven trace brightness, hotter frame core |
| A-3 | Now too grey / charcoal with a milky chip top; beam too mint; frame too thick and white; wants a wide blue wash | Restored some blue in the board light and lift, removed the pale die-top fill, beam hue towards cyan, thinner frame, wider key falloff |
| B-1 | Background lifted olive with a wide glow; glass a milky tan fill; palette pale and cool; too many, too large, too white glints; streak a thick white bar; sand smooth and matte; light flat and frontal | Backdrop glow reduced, lower-bulb film removed, warmer sand / light / glints, glints cut to 8 and shrunk, streak thinned and broken up, key light moved to the right |
| B-2 | Glass has no rim highlights or fine reflections; sand smooth; top disc looks self-lit; glints haloed and too few; wants grain and sharpness | Added a thin amber silhouette line and fine glass lines, coarser brighter glitter with edge falloff, less top light, smaller tighter glints, more small ones |
| B-3 | Glass now only hairlines with no body; highlights too dim and orange; wants bigger haloed glints, paler champagne sand, cool haze on the left, softness | Brought back a faint film and a soft wide component in the streak, bigger glints with halo and more bloom, paler sand, cooler left backdrop, slight softness |

Reviewers disagreed with each other between rounds on grain (too much / too little), depth of field
and how blue the board should be; where they conflicted I went by the measured numbers.

**Step 8.10 visual match, Version 1 (3 rounds per reference, start / middle / end frames)**

| Round | Reviewer's main points | What I changed |
|---|---|---|
| A-V1-1 | Board reads as a 3D cityscape of raised blocks; die too tall (2-3x) and never brightens; outline a thick flat band; beam a parallel-sided pillar; too many bright bundled traces; no dark die at the start | Relief blocks flattened to a few millimetres, die height halved, die top brightens late, outline thinner with a hotter core, beam fans out as it rises with 1600 finer streaks, fewer chip traces, die and pins visible from frame 0, camera start given a slight roll |
| A-V1-2 | Board too clean and blue-tiled, wants grit and clusters of small bright parts; darks too bright and blue; die pale and translucent; beam pale | Added 150 clusters of small parts, stronger surface mottling, lower tile contrast, darker solid die with striped sides, more saturated and denser beam, less bloom |
| A-V1-3 (final video) | Still too clean and sharp versus the reference's soft, grainy, hazy look and dense micro-detail; beam too green-teal, wide and milky; die too tall and ribbed, flat in frame 1, top not glowing enough; outline bloom weaker; no floating bokeh dots; few dominant bright "hero" traces missing | **Not fixed** (three rounds used). Listed in section 8 |
| B-V1-1 | Lower bulb a flat triangle with radial rays; no neck or collar; sand drains too fast and too linearly; viewed too much from above; reference drifts right while mine is locked off; streak a "light sabre"; sand too orange | Rays removed, rounder wider lower bulb, a straight neck section, sand level re-timed with keyframes (middle sinks first, rim collapses late), camera elevation 20 -> 13 degrees, added the reference's slight rightward drift, streak made wavy and thinner, paler sand |
| B-V1-2 | Upper bulb never empties to a dark hollow; glass flat and vector-like; lower bulb fill too light; glints too big, sharp and few; whole image too crisp and saturated | Back-wall film cut so the emptied bulb goes dark, wider amber bands at the glass edges, lower-bulb film and fresnel reduced, narrower lower bulb, glints shrunk and 16 tiny ones added left of the stream, coarser glitter, softness up, saturation down |
| B-V1-3 (final video) | Framing, drift and timing now match. Still: glass reads as a flat illustration without real refraction or reflections; no thick neck / collar; sand is a smooth cone with glitter rather than dense grains; stream hard-edged and uniform; sparkles too crisp | **Not fixed** (three rounds used). Listed in section 8 |

**Step 8.10 visual match, Version 2**

| Video | Change clearly visible? | Same concept and quality otherwise? | Notes |
|---|---|---|---|
| 02 V2 chip, round 1 | **Yes** ("unmistakable in every frame") | Concept, composition, camera and timing: yes. Finish: **no** | V2-specific point: the brown board was lifted and hazy compared with V1's near-black. Fixed: V2 board fill and lift lowered to match V1's luminance, then re-rendered |
| 02 V2 chip, round 2 (final video) | **Yes** | Concept, layout, camera move and timing: yes. Finish: **no** | Remaining points are the ones V1 shares (clean sharp traces, weaker frame bloom, die body, no bokeh dots, darks still judged too bright). Not fixed |
| 04 V2 hourglass (final video) | **Yes** ("strong push-in and a perspective shift, while the reference barely drifts") | Concept: yes. Quality: **no** | Remaining points are the ones V1 shares (glass realism, sand texture, neck). The first V2 camera path (32 degree arc) was too close to V1 once V1 gained the reference's drift, so I replaced it with a wider move (60 degree arc, 9.6 -> 5.2 distance, 6 -> 28 degrees elevation) and re-rendered before this review |

So for both Version 2s the first answer is yes and the second is **not** a clean yes: the reviewers
accept the concept and the change, but hold V2 to the same finish gaps as V1.

**After delivery: shape feedback.** You pointed out that the hourglass did not look like the
reference's. Enlarged crops showed why: the reference is thick glass with a wide dark waist and
collar, a flat gold shoulder where the lower bulb begins and rounded flanks, while mine was one thin
surface pinching to an "X". The glass was rebuilt as an outer shell (`OUTER_PROFILE`) around an inner
cavity and the two stand-in collar blobs were removed. A fresh reviewer then judged shape only and
measured the first rebuild against the reference: waist about twice too tall (110 px against 55 px),
no hard break under the collar, lower bulb bell-curved instead of a straight cone (33-37 degrees
from vertical), upper bulb about 95 px too wide. The outline was set to those measurements and both
hourglass videos were re-rendered and re-checked. The 03 / 04 numbers in this report are from the re-rendered files; the Version 1 and
Version 2 reviewer rounds above were run on the earlier shape.

**Step 8.11 distinctness.** `qc/v1-v2-circuit-chip-beam.png` and `qc/v1-v2-golden-hourglass.png`
show V1 over V2 at three moments. The chip pair differs in colour at a glance with identical
geometry; the hourglass pair has the same palette and object with a different viewpoint in every
frame (low and wide at the start, close and looking down into the bulb at the end).

---

## 5. Look development record

Order followed: exposure and tone mapping (ACES, sRGB output) -> light -> atmosphere -> glow and
bloom -> texture -> lens, re-measuring after each change. The chip scene took about 14 measured
iterations before the first review and about 10 after; the hourglass about 12 and 8. Final settings
are in each project's `src/look.ts`.

- **Light.** A: no white light; a soft blue key from the frame (pulled 45 % towards a neutral where it
  lands on the board), a teal top light from the beam, a navy fill. B: warm key from front-right,
  warm fill, a separate top light for the sand surface, strip highlights on the glass.
- **Atmosphere.** A: exponential distance fade, a haze sprite around the chip, drifting dust that
  blurs with distance from focus, depth-of-field blur, vignette. B: none in the reference, so only
  bloom, slight softness and a faint cool-left / warm-right backdrop.
- **Glow.** Seven-level bloom chain with per-level weights (tight core plus wide halo), fed from a
  thresholded, Karis-weighted prefilter so thin HDR lines do not sparkle.
- **Texture.** A: three scales of surface noise, flat relief blocks, clusters of parts, uneven trace
  brightness. B: clumps / grains / single flakes in the sand, fibrous streak, dust film on the glass.
- **Grain.** Hash of (1080p-sized pixel cell, frame), faded out in black, so 4K and 1080p carry the
  same grain; then a +-1/255 dither.

---

## 6. ZIP test

Both ZIPs were extracted into a fresh folder, then `npm ci` and the README's 4K still commands were run:

| ZIP | `npm ci` | 4K frame, V1 | 4K frame, V2 |
|---|---|---|---|
| `circuit-chip-beam-project.zip` | ok | 3840x2160 written (frame 150) | 3840x2160 written (frame 150) |
| `golden-hourglass-project.zip` | ok | 3840x2160 written (frame 270) | 3840x2160 written (frame 270) |

No missing files. Each ZIP holds the source with both 4K compositions, `package.json`,
`package-lock.json`, `remotion.config.ts`, the scripts, the look-dev images and numbers, the
installed skills and the README. `node_modules`, `.git`, `out/` and the reference clips are left out.
There are no fonts, models, textures or data files to ship: the scenes are fully procedural.

A 4K frame measured against the matching 1080p frame differs only in `detail_lapvar` (+22 % for A,
+38 % for B: 4K is sharper); every other measure is within target, so the look holds at 4K.

---

## 7. Render times

Machine: 4 CPU cores, no GPU (WebGL through ANGLE on software rendering).

| Video | 1080p, measured | Notes |
|---|---|---|
| 01 V1 chip | 829 s for 440 frames (1.9 s/frame) | another render was running at the same time |
| 02 V2 chip | 520 s for 440 frames (**1.2 s/frame**) | rendered alone |
| 03 V1 hourglass | about 1.9-2.0 s/frame | rendered together with 04 |
| 04 V2 hourglass | about 1.9-2.0 s/frame | rendered together with 03 |

| Project | 4K, estimated | Basis |
|---|---|---|
| circuit-chip-beam | about **4.5 s/frame**, roughly 33 min per video | 8 frames at `--scale=1` took 39.4 s, 1 frame 7.9 s, single thread |
| golden-hourglass | about **4.1 s/frame**, roughly 35 min per video | 8 frames at `--scale=1` took 36.3 s, 1 frame 7.5 s, single thread |

Full 4K videos were not rendered, as instructed. The 4K figures are single-thread; default
concurrency should be somewhat faster, and a GPU much faster.

---

## 8. What could not be matched, and why

**Reference A (chip)**

- **Grit and micro-detail.** The reference board is dense with tiny irregular marks and a cracked,
  mottled surface. Mine is cleaner and more regular. More procedural clutter would close this; I
  stopped at the round limit.
- **Soft, hazy, grainy character.** Part of this is the 596 px preview's compression softness, which I
  chose not to bake into a 4K master. The measured grain is also below target after I lowered it to
  keep the files under 100 MB.
- **Beam.** Still wider and milkier than the reference's tight curtain of hair-fine streaks, and the
  hue is slightly greener.
- **Die.** Reads taller and more ribbed than the reference's thin slab, is nearly flat at the very
  start, and its top does not glow as strongly at the end.
- **A few bold "hero" traces and floating bokeh dots** from the reference are weak or absent.
- **Blacks.** Reviewers consistently judged my darks too bright while the measured medians say they
  are at or below the reference; I followed the measurements.

**Reference B (hourglass)**

- **Real glass.** The reference is live-action macro footage. After your note that the shape did not
  look like the reference, the glass was rebuilt as a thick-walled outer shell (short collared waist,
  hard break under the collar, near-straight cones, set from measurements of the reference) around an inner cavity that pinches to a pinhole, replacing
  the single thin surface that pinched to an "X". The outline now follows the reference; what is
  still missing is true refraction through the thick glass and its layered internal reflections, so
  it remains a stylised CG hourglass rather than a photoreal one.
- **Sand.** Real glitter sand has far denser fine sparkle than my three-scale procedural texture
  (`detail_lapvar` is 55-67 % below target), and the stream is too uniform and hard-edged.
- **Collar.** The dark waist now belongs to the glass itself, with a glint and a small red reflection,
  but it lacks the reference's dense internal reflections.
- **Glints** are placed by hand to match the reference's positions and twinkle on a seeded curve; they
  do not come from real reflections.
- **Framing.** 16:9 against the reference's 1.90:1: the width matches and there is a little more
  picture above and below.

**Both**

- The look targets (+-10 %) are met for most but not all measures (section 3), and none of the four
  videos got a clean pass from the independent reviewers on finish.
- The chip videos are 75-77 MB each at CRF 16.
