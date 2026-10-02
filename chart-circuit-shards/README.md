# Chart · Circuit · Shards — Remotion + `@remotion/three`

Five 3D looks, 8 compositions, one Remotion project. Everything is built in
code (three.js through `@remotion/three`, WebGL2); there is no text, logo or
chip branding anywhere.

| Composition id (Remotion) | Output file | Look | Frames @30fps | Loop |
|---|---|---|---|---|
| `GrowthChart3D-Up` | `GrowthChart3D_Up.mp4` | 3D Growth Chart, rising, green arrow `#5CE84A` | 360 (12 s) | no |
| `GrowthChart3D-Down` | `GrowthChart3D_Down.mp4` | 3D Growth Chart, falling, red arrow `#E8403A` | 360 (12 s) | no |
| `CircuitFlythrough-Blue` | `CircuitFlythrough_Blue.mp4` | Circuit Flythrough | 600 (20 s) | yes |
| `NeonShards-Blue` | `NeonShards_Blue.mp4` | Neon Shards, blue | 600 (20 s) | yes |
| `NeonShards-Magenta` | `NeonShards_Magenta.mp4` | Neon Shards, magenta | 600 (20 s) | yes |
| `CPUBoard-BlueSilver` | `CPUBoard_BlueSilver.mp4` | CPU Board | 600 (20 s) | yes |
| `LaserPanels-CyanPurple` | `LaserPanels_CyanPurple.mp4` | Laser Panels, cyan lasers / purple trim | 600 (20 s) | yes |
| `LaserPanels-OrangeRed` | `LaserPanels_OrangeRed.mp4` | Laser Panels, orange lasers / red trim | 600 (20 s) | yes |

Remotion composition ids cannot contain `_`, so ids use `-`; the output file
names use `_` as requested.

All compositions are defined at **3840×2160, 30 fps**.

## Setup

```bash
npm install          # exact versions are pinned in package.json / package-lock.json
npx remotion studio  # preview in the browser
```

Node 18+ (tested with Node 22). Studio previews are capped at half
resolution (`dpr ≤ 0.5`) so they stay interactive; renders always use the
full requested resolution.

### Chromium GL flag

WebGL needs ANGLE in headless Chromium. `remotion.config.ts` sets it for every
CLI command (`Config.setChromiumOpenGlRenderer('angle')`); when you call
the CLI from elsewhere, or use the Node APIs, pass it explicitly:

```
--gl=angle
```

## Render commands

### 4K (3840×2160), one per composition

```bash
npx remotion render src/index.ts GrowthChart3D-Up        out/GrowthChart3D_Up.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts GrowthChart3D-Down      out/GrowthChart3D_Down.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts CircuitFlythrough-Blue  out/CircuitFlythrough_Blue.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts NeonShards-Blue         out/NeonShards_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts NeonShards-Magenta      out/NeonShards_Magenta.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts CPUBoard-BlueSilver     out/CPUBoard_BlueSilver.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts LaserPanels-CyanPurple  out/LaserPanels_CyanPurple.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts LaserPanels-OrangeRed   out/LaserPanels_OrangeRed.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

(`codec`, `crf`, `pixel-format` and `image-format` are also the defaults in
`remotion.config.ts`; they are spelled out so the commands work on their own.
`--image-format=png` matters: JPEG intermediate frames add banding.)
For ProRes masters add `--codec=prores --prores-profile=4444` instead.

### Stills at 6000×3375

`--scale=1.5625` turns the 3840×2160 composition into 6000×3375:

```bash
npx remotion still src/index.ts GrowthChart3D-Up out/GrowthChart3D_Up_6K.png --frame=300 --scale=1.5625 --gl=angle --image-format=png
```

Swap the composition id and `--frame` for any other look (e.g.
`NeonShards-Magenta --frame=300`).

### 720p previews (what was delivered)

```bash
scripts/render-previews.sh build 4          # all 8; or append file ids to render a subset
```

It bundles once, renders each composition as a lossless PNG sequence with
`--scale=0.3333333333333333` (exactly 1280×720 — the WebGL backing store is
created at that size, the scene is not rendered at 4K and downscaled), then
encodes with ffmpeg: H.264, `yuv420p`, BT.709 tags, 30 fps, CRF 16, no audio.
The PNG frames are kept in `out/frames/<id>/` so the determinism check can
compare frame 150 of the full render with a cold single-frame render.
One-step equivalent per composition:

```bash
npx remotion render src/index.ts NeonShards-Blue out/NeonShards_Blue.mp4 --scale=0.3333333333333333 --gl=angle
```

## Render time

Measured in the build container: headless Chromium with ANGLE falling back
to **SwiftShader (software WebGL on 4 CPU cores, no GPU)**. A real GPU will
be far faster; treat these as an upper bound.

| Look (version A) | 720p, per frame (sequence, concurrency 1, steady state) | 4K, per frame (measured: warm single-frame render incl. 4K PNG write) | 4K full composition, this machine, concurrency 1 (estimate) |
|---|---|---|---|
| 3D Growth Chart | 1.24 s | ~28 s | 360 × ~26 s ≈ 2.6 h |
| Circuit Flythrough | 1.20 s | ~19.5 s | 600 × ~17 s ≈ 2.8 h |
| Neon Shards | 0.39 s | ~7.4 s | 600 × ~6 s ≈ 1 h |
| CPU Board | 2.01 s | ~17.3 s | 600 × ~15 s ≈ 2.5 h |
| Laser Panels | 1.52 s | ~26 s | 600 × ~24 s ≈ 4 h |

* 720p method: `scripts/time-per-frame.sh` renders 10 and 40 frames
  (frames 100+) and divides the difference by 30, which removes browser
  start-up and asset loading.
* 4K method: `node scripts/stills.mjs <comp> out/k4 100,101,102 1` (the 2nd
  and 3rd frames are warm; each includes writing a 3840×2160 PNG, roughly
  2–3 s, so the per-frame sequence cost is a little lower).
* The 720p previews were rendered with concurrency 4 (wall-clock per
  composition: Growth ~470 s, Circuit ~650 s, Shards ~185 s, CPU ~1170 s,
  Panels ~920 s). On SwiftShader concurrency 4 gives about 1.5–2× over
  concurrency 1, so a full 4K set of all 8 is roughly 10–12 h on a 4-core
  CPU-only box. On a desktop GPU expect well under 1 s per 4K frame (not
  measured here); use `--concurrency` equal to the number of GPU-backed
  tabs your machine handles.


## How it is built

`src/lib/` holds the shared pieces; each look is one file under `src/looks/`.

* **`ThreeStage.tsx`** — wraps `<ThreeCanvas>`. Assets (HDRI, Natural Earth
  GeoJSON) load behind `delayRender`/`continueRender`, and the handle is
  released only after the canvas has taken its own handle. The look is built
  once per tab; every frame calls `look.update(frame, …)` and then the post
  pipeline. `useFrame` is used **only as the render hook** (priority 1 =
  we own rendering): its clock and delta are never read — the Remotion frame
  is the only clock.
* **`post.ts`** — deterministic post chain written directly on three.js:
  HDR half-float scene target (MSAA ×4 + float depth texture) → CoC +
  half-res downsample → near-CoC tile max → 64-tap golden-angle DOF gather
  (separate near/far layers, mip-filtered so large bokeh stays smooth) →
  6-level bloom (Karis prefilter, 13-tap down, tent up) → composite →
  **ACES (Hill fit)** → sRGB → **grain** (PCG hash of pixel position and
  frame, ~2 %) → **TPDF dither ±1/255**, scaled to zero on pure black. All
  radii are fractions of image height, so 720p, 4K and 6K look the same.
  No TAA, no temporal AO, no accumulation; nothing is carried between frames.
* **`pcb.ts`** — seeded PCB router: bundles of parallel tracks with mitred
  45° bends, splits and peel-offs, grown until they would collide on an
  occupancy grid (toroidal for tiling boards), ending in ring pads or vias.
* **`sprites.ts`** — instanced soft light sprites with a minimum on-screen
  size whose energy is conserved, and the trace/pad material.
* **`rng.ts`** — `mulberry32`; every random value comes from a fixed seed
  at module/setup time. `Math.random()` is never used.
* **`tone.ts`** — JS mirror of the tone curve, used to choose linear scene
  values that land on given display colours (sky, floor, arrow).

### Looks

1. **3D Growth Chart** — rounded silver bars (`MeshPhysicalMaterial`, HDRI
   reflections, dark-mauve → bright-silver progression, vertical gradient)
   rise out of / sink into a floor shader that draws the Natural Earth map
   (rasterised once on a canvas, softened), a faint grid network with dots,
   analytic contact shadows from the bars' current heights and horizon haze.
   Bevelled extruded arrow revealed by arc length with the head leading; a
   small coloured light behind the head tints the bars. Camera orbits 40°
   from the left while rising; glint sweeps over the bars from frame 210.
2. **Circuit Flythrough** — 12×12 toroidal tile routed once (central spine
   bundle, periodic trunks, bundles grown to collision, square pad clusters)
   and drawn as tile copies; the camera moves exactly 2 tiles in 600 frames.
3. **Neon Shards** — 80 wireframe triangles / kites / open polylines per
   36-unit depth block, drawn as screen-space ribbons whose width grows with
   defocus while their energy is conserved (soft near lines, thin far ones),
   additive, with soft glows behind hot corners. Camera drifts exactly one
   block; every shard turns 1 or 2 whole turns.
4. **CPU Board** — layered chip (blue substrate steps, dark die, silver top,
   blue corner indicators) on a routed board that fans out from the chip in
   all directions (~5,000 routed traces), SMD parts, and ~65,000 data points
   streaming along the traces.
   Camera: closed ±25° sway orbit with a gentle push in and back.
5. **Laser Panels** — seeded subdivision of a 10×10 tile into framed /
   nested / stacked blocks, glowing trim strips, two families of lasers
   whose streaks slide by whole periods, laser light injected into the panel
   shader, moving hot-spot light, colour grade derived from the laser colour.

### Where the build departs from the written brief (to match the references)

* **Circuit Flythrough camera** is ~31° above the board, not ~15°: the
  reference shows no horizon (the board fills the frame to the top edge with
  bokeh), which a 15° camera cannot do with any usable lens. It still glides
  low and forward with sway.
* **CPU Board camera** is ~28° (±2°) rather than exactly 25°, for the same
  reason (the board reaches the top edge in the reference).
* **Neon Shards** stays on pure black as required; the reference has a faint
  navy haze, which was deliberately not reproduced.
* **Grain** is ~2 % as required; the references are clean compressed video,
  so the previews look slightly grainier than them.

### Loops (looks 2–5)

The camera's position inside one tile/block is `(N·L·t) mod L` with
`t = frame/600`; lights, data points, shard rotations and laser streaks move
by whole cycles; the grain/dither hash uses `frame mod 600`. Frame 600 is
therefore pixel-identical to frame 0 (checked, see below), and frames 599
and 1 are its symmetric neighbours.

## Adding a version (one data row)

Versions live in `src/versions.ts`; `src/Root.tsx` registers a composition
for every row. Example — a green Neon Shards:

```ts
export const SHARDS_VERSIONS: ShardsVersion[] = [
  { id: 'NeonShards_Blue', lineA: '#3F8CFF', lineB: '#9FD8FF', glow: '#4F7BFF' },
  { id: 'NeonShards_Magenta', lineA: '#FF4FD8', lineB: '#FFB0F0', glow: '#8A3BFF' },
  { id: 'NeonShards_Green', lineA: '#3FFF8C', lineB: '#B0FFD0', glow: '#3BFFA0' }, // new
];
```

The composition `NeonShards-Green` then appears in the Studio. Growth Chart
rows take `direction: 'up' | 'down'` and the arrow colour; Laser Panels rows
take the laser and trim colours; Circuit and CPU rows take their palettes.

## Verification

`scripts/verify.py` (needs Python 3, numpy, Pillow, scipy, ffmpeg):

| Step | Command |
|---|---|
| 1 ffprobe | `python3 scripts/verify.py probe` |
| 2 loop (frame 0 vs 600 of a 601-frame variant) | `node scripts/stills.mjs <comp> out/loop 0,600 --loopCheck` per looping comp, then `python3 scripts/verify.py loop out/loop` |
| 3 black | `python3 scripts/verify.py black` |
| 4 determinism (cold frame 150 vs full render) | `node scripts/stills.mjs <comp> out/cold 150` per comp, then `python3 scripts/verify.py determinism out/cold` |
| 5 banding | `python3 scripts/verify.py banding` |
| 6 content sheets | `python3 scripts/verify.py sheets` |

`--loopCheck` is an input prop that makes `calculateMetadata` add one frame,
so frame 600 exists; nothing else changes.

### Banding check

Results on the delivered previews (`out/`), exact output of the scripts:

**Step 1 — ffprobe.** All 8: `h264`, 1280×720, `30/1`, `yuv420p`, no audio
stream; Growth Chart 12.000 s (360 frames), all others 20.000 s (600 frames).

**Step 2 — loop.** Frames 0 and 600 of the 601-frame variant are identical
pixel for pixel for all six looping compositions (max diff 0).

**Step 3 — black (Neon Shards, decoded from the mp4).** The lossless render
is exactly 0,0,0 everywhere that is empty. In the decoded H.264, frames 0
and 150 are exactly 0 in all empty areas; frames 300 and 450 contain a few
pixels (≈0.005 % of empty pixels) at **2** in the blue/red channel. The
encoded YUV is at most one code value off (Y 16→17, U 128→127/129) — x264's
lossy inter-frame residue — and BT.709 → RGB turns a ±1 chroma step into 2.
Three rounds of encoder settings at CRF 16 (dead-zones, chroma QP offset,
AQ, psy/mbtree) reduced it ~30× but not to ≤1; the Shards encodes use the
best one (`psy=0:mbtree=0:no-fast-pskip=1:aq-mode=3`). Strictly, this check
does **not** pass the ≤1 tolerance.

**Step 4 — determinism.** Frame 150 rendered on its own from a cold start
(new browser, new bundle) vs frame 150 of the full multi-threaded render:
identical decoded pixels **and** identical PNG file bytes for all 8.

**Step 5 — banding.** `verify.py banding` decodes frame 300 of 1A, 2, 4
and 5A from the mp4, picks smooth gradient segments (the look 1 sky and
horizon haze; glow halos, bloom fall-off and haze in the dark looks:
segments with ≥3 levels of range and little detail), and reads 8-row
band-averaged pixel values along each. Quantisation bands show up as runs
where a whole band sits on one integer value; every sampled segment has
**0 px** of such plateaus (the values move in fractional steps, e.g. sky
`184.5, 184.9, 185.4, 186.9, …`, CPU glow `16.3, 17.3, 20.1, 20.5, …`).
One encode setting was rejected because of this check: the `psy=0`
options that help the black check also flattened the grain on CPU Board
into a 10-px plateau, so only the Shards use them; the other looks use
x264 defaults, which keep the grain/dither.


## Assets and licences

* **HDRI** — `public/hdri/studio_small_03_1k.hdr`, "Studio Small 03" by
  Sergej Majboroda, from Poly Haven, **CC0** (public domain). Downloaded from
  the pmndrs `drei-assets` mirror of the Poly Haven file because polyhaven.com
  was not reachable from the build machine. See `public/hdri/LICENSE.txt`.
* **Map** — `public/data/ne_110m_land.geojson`, Natural Earth 1:110m land,
  **public domain**. Terms in `public/data/NATURAL_EARTH_LICENSE.md`.

## Completion checklist

- [x] 5 looks, 8 compositions, one project; 3840×2160, 30 fps; look 1 = 360 frames, others 600
- [x] All 3D through `@remotion/three`, WebGL2 (`--gl=angle`); no WebGPU
- [x] Built in code; no MCP servers; no text, logos, brands or chip markings
- [x] Natural Earth map data and Poly Haven CC0 HDRI shipped, with licences
- [x] ACES (Hill fit) tonemapping, sRGB output
- [x] Shader dither ±1/255 after bloom and tonemapping in every look
- [x] Grain ~2 % from a fixed hash of pixel position and frame in looks 1, 2, 4, 5; none in look 3
- [x] No `Math.random()`, no `Date.now()`, no `useFrame` clock, no `useState` driving visuals, no TAA / temporal AO / AccumulativeShadows; `mulberry32` seeds at module level
- [x] HDRI and map data behind `delayRender` / `continueRender`
- [x] One data row per version (`src/versions.ts`)
- [x] Step 1 ffprobe — all 8 pass
- [x] Step 2 loop — all 6 looping comps pixel-identical at frame 600
- [ ] Step 3 black — lossless render exactly 0; decoded mp4 has a few pixels at 2 (see above)
- [x] Step 4 cold frame 150 = full render, byte for byte — all 8
- [x] Step 5 banding — no quantisation plateaus in sky, glows or haze
- [x] Step 6 content — checked on 5 evenly spaced frames per composition (`out/check/*_sheet.png`)
- [x] Steps 7–8 — three rounds of independent visual comparison per look (see delivery notes)
- [x] 720p previews (1280×720 exactly at `--scale=1/3`), CRF 16, plus a 720p PNG still of each
- [x] Render time per frame measured at 720p (and 4K) per look
- [x] `npm install && npx remotion studio` checked from a clean copy of the zip

