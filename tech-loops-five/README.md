# Tech Loops — five looks, ten compositions (Remotion)

Five tech motion pieces, two versions each, in one Remotion project.
All compositions are defined at **3840×2160, 30 fps, 600 frames (20 s)**.

| # | Look | Composition ids | 2D / 3D | Loop |
|---|------|-----------------|---------|------|
| 1 | Binary Word | `BinaryWord-BinaryCode`, `BinaryWord-DataStream` | 2D canvas | 20 s loop |
| 2 | Soft Spinner | `SoftSpinner-Amber`, `SoftSpinner-IceBlue` | 2D SVG | 20 s loop |
| 3 | Security Dashboard | `SecurityDashboard-Teal`, `SecurityDashboard-IceViolet` | 2.5D (HTML/SVG + CSS 3D tilt) | 20 s loop |
| 4 | Model Training UI | `ModelTraining-LLM`, `ModelTraining-FineTuning` | 2D | 20 s, not a loop |
| 5 | AI Core Tunnel | `AICoreTunnel-Cyan`, `AICoreTunnel-Violet` | 3D (`@remotion/three`, WebGL2) | 20 s loop |

No MCP servers, no icon libraries, no network at render time. Fonts
(Inter, JetBrains Mono, Montserrat — OFL) ship in `public/fonts`, the world
map is built from Natural Earth (public domain) in `src/data`.

---

## Quick start

```bash
npm install
npx remotion studio        # or: npm run studio
```

Requires Node 18+ (tested with Node 22). `remotion.config.ts` sets the render
defaults used below (PNG frames, H.264, CRF 16, yuv420p, `--gl=angle`).

---

## 4K render commands (one per composition)

The config already sets codec/CRF/pixel format/GL, the flags are repeated so
the commands also work with a different config:

```bash
FLAGS="--codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --gl=angle"
npx remotion render BinaryWord-BinaryCode        out/BinaryWord_BinaryCode.mp4        $FLAGS
npx remotion render BinaryWord-DataStream        out/BinaryWord_DataStream.mp4        $FLAGS
npx remotion render SoftSpinner-Amber            out/SoftSpinner_Amber.mp4            $FLAGS
npx remotion render SoftSpinner-IceBlue          out/SoftSpinner_IceBlue.mp4          $FLAGS
npx remotion render SecurityDashboard-Teal       out/SecurityDashboard_Teal.mp4       $FLAGS
npx remotion render SecurityDashboard-IceViolet  out/SecurityDashboard_IceViolet.mp4  $FLAGS
npx remotion render ModelTraining-LLM            out/ModelTraining_LLM.mp4            $FLAGS
npx remotion render ModelTraining-FineTuning     out/ModelTraining_FineTuning.mp4     $FLAGS
npx remotion render AICoreTunnel-Cyan            out/AICoreTunnel_Cyan.mp4            $FLAGS
npx remotion render AICoreTunnel-Violet          out/AICoreTunnel_Violet.mp4          $FLAGS
```

1080p preview of the same composition: add `--scale=0.5`.
Optionally add `--concurrency=N` (default: half the CPU cores).

### Chromium GL flag (look 5)

Look 5 needs **WebGL2**. Headless Chromium only exposes it with the ANGLE
backend: **`--gl=angle`** (set project-wide via
`Config.setChromiumOpenGlRenderer("angle")` in `remotion.config.ts`). On a
machine with a GPU, ANGLE uses it; on a GPU-less server ANGLE falls back to
SwiftShader (CPU) — that is what the timings below were measured with.
WebGPU is not used.

### Stills (6000×3375 PNG)

`--scale=1.5625` turns the 3840×2160 composition into 6000×3375:

```bash
npx remotion still BinaryWord-BinaryCode out/stills/BinaryWord_BinaryCode_f090.png --frame=90  --scale=1.5625 --image-format=png
npx remotion still BinaryWord-BinaryCode out/stills/BinaryWord_BinaryCode_f390.png --frame=390 --scale=1.5625 --image-format=png
# … same for every looping composition (frames 90 and 390)
npx remotion still ModelTraining-LLM out/stills/ModelTraining_LLM_f280.png --frame=280 --scale=1.5625 --image-format=png   # mid-typing
npx remotion still ModelTraining-LLM out/stills/ModelTraining_LLM_f560.png --frame=560 --scale=1.5625 --image-format=png   # near the end
```

or all twenty at once: `node scripts/render.mjs stills`.

### Scripted renders / verification

```bash
node scripts/render.mjs previews [ids…]   # 1080p PNG sequence → ffmpeg H.264 CRF16 yuv420p, records out/timings.json
node scripts/render.mjs stills   [ids…]   # 2 × 6000×3375 PNG per composition
node scripts/render.mjs loopcheck [ids…]  # frames 0 and 600 of the 601-frame variant
python3 scripts/verify.py probe|loop|determinism|banding|sheets
```

`SCALE=1 node scripts/render.mjs previews` renders 4K the same way
(`KEEP_FRAMES=1` keeps the PNG sequence; by default only frame 300 is kept).

---

## Render time (measured)

Measured on the build machine: **4 vCPU, no GPU** (Chromium headless shell,
ANGLE → SwiftShader), `concurrency 2`, one render process, nothing else
running (`node scripts/render.mjs bench`). Times include browser start-up
amortised over the range (≈ +0.2 s/frame on the 10-frame 4K runs).

| Look | 1080p (`--scale=0.5`), ms/frame — 60 frames | 4K (`--scale=1`), ms/frame — 10 frames, measured | 4K, 600 frames — estimate | 1080p full preview render* |
|------|------:|------:|------:|------:|
| 1 Binary Word | 415 | 1 973 | ≈ 20 min | 685 / 714 ms/frame |
| 2 Soft Spinner | 315 | 1 579 | ≈ 16 min | 603 / 510 ms/frame |
| 3 Security Dashboard | 371 | 1 636 | ≈ 16 min | 1 004 / 617 ms/frame |
| 4 Model Training UI | 227 | 1 015 | ≈ 10 min | 418 / 443 ms/frame |
| 5 AI Core Tunnel | 1 826 | 7 295 | ≈ 73 min on CPU (SwiftShader) | 2 454 / 2 453 ms/frame |

\* the previews were rendered as 3–4 render processes in parallel on the same
4 vCPUs, so those wall-clock numbers (A / B version) are higher than the
isolated benchmark. 4K costs ≈ 4.2–4.8× 1080p (4× the pixels, plus the
canvas grain and PNG encoding that scale with pixel count). On a machine with
a GPU, look 5 should be several times faster than the SwiftShader figure;
looks 1–4 scale with CPU cores (run several compositions in parallel rather
than raising `--concurrency` — one Chromium instance is bound by its
compositor process).

---

## Loops

Looks 1, 2, 3 and 5 are exactly 600 frames and every moving thing completes a
whole number of cycles:

- **Binary Word** — a cell's state is `hash(cell, floor((frame+offset)/k) mod (600/k))`
  with every `k` dividing 600 (4…60); the scan band passes 4 times.
- **Soft Spinner** — 2 whole turns, 8 whole chase laps.
- **Security Dashboard** — the camera runs one lap of a closed ellipse with a
  2-cycle push in/out; rings 1/2/5 turns, pulses 12, blinks 10–20, the analytics
  chart scrolls exactly one period of an integer-frequency series, the event
  log scrolls exactly one block of 12 lines, gauges use integer-cycle sines.
- **AI Core Tunnel** — streaks, panels and tokens are generated in one block of
  length **L = 360** units; the camera travels exactly **N·L with N = 1** per
  loop (implemented as a modulo-L wrap of each instance's camera-relative
  depth, identical to an infinitely tiled field). Pulse 5 cycles, burst layers
  ±1 turn, token wobble 1–3 cycles.
- **Grain / dither** use `frame % 600`.

Check: `node scripts/render.mjs loopcheck` passes `{"loopCheck": true}`, which
makes each looping composition 601 frames (via `calculateMetadata`), then
`python3 scripts/verify.py loop` compares frame 0 with frame 600 pixel by pixel.

## Determinism

Every on-screen value is a function of `useCurrentFrame()` only:
no `Math.random()` at render time (`mulberry32` is seeded at module level),
no CSS animations/transitions, no `Date.now()`, no `useFrame` clock (R3F's
`useFrame` is only used as the hook that *issues* the render; it reads the
Remotion frame), no state carried between frames (typing = `charsAt(frame)`
from a module-level schedule; logs are a precomputed list filtered by frame),
no TAA. Fonts and canvas textures are behind `delayRender`/`continueRender`.

**Chromium raster history.** A frame rendered deep inside a sequence can
rasterise slightly differently (±1–6 code values on a few hundred pixels) from
the same frame rendered cold, because Chrome reuses compositing layers and
raster tiles between frames of one tab (seen here on the spinner's SVG blur and
on the dashboard's animated SVG). Looks 2, 3 and 4 therefore put
`key={frame}` on their root element: every frame is painted from fresh DOM
and fresh layers, exactly like a cold render. (Look 1 draws on canvases and
look 5 on WebGL, which are redrawn completely every frame anyway.)

Check: render frame 300 cold (`npx remotion still <id> --frame=300 --scale=0.5`)
and compare with frame 300 of the full multi-threaded render
(`python3 scripts/verify.py determinism`).

## Banding

Dark backgrounds with soft glows band in H.264. Mitigation:

- 2D looks: full-frame **grain canvas**, triangular noise of amplitude
  1.5–2.5 % (spinner 2.5 %, binary 1.8 %, dashboard/training 1.5 %), computed as an
  integer hash of `(x, y, frame % 600)` at output resolution — never `Math.random()`.
- Look 5: **shader dither ±1/255** (triangular) after bloom and tone mapping.

**How to check:** extract a frame **from the encoded mp4** (not the preview):

```bash
ffmpeg -i out/previews/SoftSpinner_Amber.mp4 -vf "select=eq(n\,300)" -frames:v 1 f300.png
python3 scripts/verify.py banding   # does this for 2A, 2B, 5A, 5B
```

and read luminance along a ray through a glow falloff: the averaged profile
must fall smoothly (no plateaus with 1-level steps). Results:

| Preview (frame 300 of the encoded mp4) | Where | Plateaus in falloff | Longest run of identical raw values in the gradient | Result |
|---|---|---:|---:|---|
| SoftSpinner_Amber | ray y=540, x=1230→1800 (petal tip → background 13.6), falloff 113.6 → 15.6 over 70 px | 0 | 5 px | PASS |
| SoftSpinner_IceBlue | same ray, falloff 110.1 → 14.2 over 64 px | 0 | 4 px | PASS |
| AICoreTunnel_Cyan | radial median r=120→520 px around the emblem, 174.6 → 25.6 (falloff 329 px) | 0 | 5 px | PASS |
| AICoreTunnel_Violet | radial median r=120→520 px, 109.3 → 12.7 (falloff 278 px) | 0 | 6 px | PASS |

Full profiles: `out/banding/banding_report.json` after running the check.
The grain survives encoding (spinner background σ 1.45 in the PNG frame,
1.22 in the mp4). x264 may flatten a few-pixel patch of perfectly flat
background, which cannot band (no gradient), so the run-length test only
looks where the profile is above background + 1.

---

## How to add a version (one data row)

All versions live in **`src/versions.ts`**; `src/Root.tsx` maps every row to
a `<Composition>`. Add a row to the relevant array:

```ts
// Look 1 — new word / colours
BINARY_VERSIONS.push({
  id: "BinaryWord-NeuralNet", file: "BinaryWord_NeuralNet", word: "NEURAL NET",
  wordColor: "#B9FF8A", glowColor: "#7AD84A", bgDim: "#1E3320", bgBright: "#3E5E3A",
  circuitColor: "#142014", background: "#000000", seed: 31,
});
```

- Look 2 row: `petal`, `center`, `halo`, `background`.
- Look 3 row: `accent`, `secondary`, `panel`, `background`, `cameraPhase` (start point on the camera ellipse, 0–1).
- Look 4 row: `title`, `orb` (3 colours), `accent`, `centerCode` / `rightCode`
  (keys of `src/looks/training/code.ts` — add a new entry there for new code),
  `modelName`, `logs` (`"llm"` | `"finetune"`).
- Look 5 row: `accent`, `highlight`, `background`, `seed`.

Then render it with the 4K command above using the new `id`.

---

## Completion checklist

Verified on the delivered 1080p previews (see `scripts/verify.py`):

- [x] 10 compositions, 3840×2160, 30 fps, 600 frames; one data row per version (`src/versions.ts`).
- [x] **Step 1 — file checks**: all 10 mp4s are h264, 1920×1080, 30/1, 20.000 s (600 frames), yuv420p, no audio stream.
- [x] **Step 2 — loop check** (looks 1, 2, 3, 5): frame 0 and frame 600 of the 601-frame variant are identical pixel for pixel (identical PNG bytes) for all 8 looping compositions.
- [x] **Step 3 — determinism**: frame 300 rendered cold on its own equals frame 300 of the full multi-threaded render byte for byte, all 10 compositions.
- [x] **Step 4 — banding**: smooth falloff, no plateaus, in 2A, 2B, 5A, 5B (table above), read from the encoded mp4.
- [x] **Step 5 — content**: word readable and made of digits with flicker and scan band (1A/1B); eight blurred teardrop petals, rotation and chase (2A/2B); perspective tilt, different panels centred, rings/charts/gauges moving, crisp centre, no real brands/IPs/names (3A/3B); code further along in each frame, logs scrolling, loss falling, orb shifting, ends on "Epoch 3/3 complete" (4A/4B); readable glowing "AI", streaks and tokens rushing outward at several depths (5A/5B); each pair differs only by word/colour/content.
- [x] Fonts shipped (OFL) and loaded with `delayRender`/`continueRender`; icons self-drawn; Natural Earth map (PD).
- [x] No CSS `@keyframes`/transitions, no `Math.random()` at render time, no `Date.now()`, no state carried between frames, no TAA.
- [x] Grain 1.5–2.5 % from a fixed formula of pixel position and `frame % 600` (2D); ±1/255 shader dither after bloom (look 5).
- [x] 2 stills per composition at 6000×3375 (PNG); one 1080p PNG still per composition.
- [x] `npm install && npx remotion studio` works from a clean copy of the zip.

---

## Look notes

- **Look 1** draws ~8 000 digits per frame with `fillText` on one canvas; the
  word is drawn once to an offscreen canvas and sampled per cell. Inside the
  word the digits sit on a half-row sub-grid (denser, overlapping into
  vertical streaks like the reference) — that doubles the vertical resolution
  of the mask so the word stays readable at 1080p.
- **Look 2** blur: petal bodies use σ = 0.75 % of frame width (≈ 1.5 % blur
  diameter); the halo is one SVG filter with three stacked Gaussian blurs at
  1 : 4 : 12.
- **Look 3** board is 9600 × 4320 px (2.5 × 2 frames) of HTML/SVG, tilted with
  `perspective` + `rotateX(25°) rotateY(−12°)`; depth of field is a masked
  `backdrop-filter` blur on the far and near edges.
- **Look 5** bloom (three.js `UnrealBloomPass`) always runs on a 1920×1080 mip
  chain and is upsampled into the frame, so 1080p previews, 4K renders and
  6000-px stills bloom identically. The crisp "AI" letters are composited
  after bloom (only their blurred accent copy blooms), so they stay readable
  at the pulse peak.

## Content notes

- All text, widgets, code and layouts are original. No real brands, products,
  company names, logos or people. The Python uses a **fictional** framework
  name (`tensorweave`), fake model names (`LM Model 1A`), fake datasets and
  only `localhost` URLs. The dashboard uses only reserved documentation IPs
  (`192.0.2.x`, `198.51.100.x`, `203.0.113.x`). The biometric checklist says
  "Face scan" rather than a product name.
- All icons (padlock, warning triangle, shield, globe, skull, fingerprint,
  bug, envelope, gear, …) are self-drawn SVG paths.

## Project layout

```
remotion.config.ts        render defaults (PNG frames, H.264, CRF 16, yuv420p, gl=angle)
src/Root.tsx              one <Composition> per version row
src/versions.ts           ← the data rows
src/lib/                  fonts (delayRender), seeded RNG/hash, loop maths, Grain, canvas hook
src/looks/binary/         Look 1 (canvas + offscreen word mask)
src/looks/spinner/        Look 2 (SVG petals, stacked 1:4:12 halo blur)
src/looks/dashboard/      Look 3 (board, widgets, self-drawn icons, Natural Earth dot map)
src/looks/training/       Look 4 (UI, original code, typing schedule, highlighter, logs)
src/looks/tunnel/         Look 5 (instanced shaders, canvas textures, bloom + dither)
src/data/                 Natural Earth 1:110m land (public domain) + note
public/fonts/             Inter, JetBrains Mono, Montserrat (TTF, OFL)
public/licenses/          OFL texts + Natural Earth terms
scripts/                  render.mjs (previews/stills/loopcheck), verify.py, package.sh
```

## Licences

- Inter, JetBrains Mono, Montserrat — SIL Open Font License 1.1
  (`public/licenses/OFL-*.txt`).
- Natural Earth — public domain (`public/licenses/NATURAL_EARTH.md`).
- Remotion itself has its own licence terms (a company licence may be required
  for some entities): https://remotion.dev/license
