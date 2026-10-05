# Black Holes and Cosmic Vortices

Six 20 s seamless-loop compositions (30 fps, 600 frames, defined at 3840×2160)
rendered as full-screen GLSL raymarch shaders on a three.js quad through
`@remotion/three`, plus bloom / anamorphic-streak / halo / grade passes.

| Composition (Remotion ID) | Output file | Reference | Look | Shader mode |
|---|---|---|---|---|
| `BlackHole-EdgeOnPink` | `BlackHole_EdgeOnPink.mp4` | 2257559949 | Black Hole | thin disc |
| `BlackHole-GoldFlare` | `BlackHole_GoldFlare.mp4` | 1439316983 | Black Hole | thin disc + dust + flare/halo |
| `BlackHole-DiscSkim` | `BlackHole_DiscSkim.mp4` | 2257562038 | Black Hole | thin disc + cloud deck |
| `Vortex-PurpleEye` | `Vortex_PurpleEye.mp4` | 1785427766 | Cosmic Vortex | `MODE 0` flat eye |
| `Vortex-BlueFunnel` | `Vortex_BlueFunnel.mp4` | 2237510408 | Cosmic Vortex | `MODE 1` raymarched funnel |
| `Vortex-NebulaSwirl` | `Vortex_NebulaSwirl.mp4` | 1405885287 | Cosmic Vortex | `MODE 2` nebula spiral |

Remotion composition IDs may not contain `_`, so the IDs use `-`; the data
rows (`src/shots.ts`) and output files keep the `_` names.

## Setup

```bash
npm install            # versions are pinned in package.json / package-lock.json
npx remotion studio    # interactive preview (buffer capped at 1280 px wide)
```

## Rendering

WebGL2 in headless Chromium needs the ANGLE GL backend. `remotion.config.ts`
sets it (`Config.setChromiumOpenGlRenderer("angle")`); on the command line it
is `--gl=angle`. Without a GPU, ANGLE falls back to SwiftShader (correct, but
slow, see timings below).

### 4K (3840×2160) per composition

Quality is chosen automatically from the real output size (`quality: "auto"`:
`high` when the drawing buffer is ≥ 1440 px tall). To force it:
`--props='{"shotId":"BlackHole_EdgeOnPink","quality":"high","durationOverride":null}'`.

```bash
npx remotion render BlackHole-EdgeOnPink out/BlackHole_EdgeOnPink_4k.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render BlackHole-GoldFlare  out/BlackHole_GoldFlare_4k.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render BlackHole-DiscSkim   out/BlackHole_DiscSkim_4k.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render Vortex-PurpleEye     out/Vortex_PurpleEye_4k.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render Vortex-BlueFunnel    out/Vortex_BlueFunnel_4k.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render Vortex-NebulaSwirl   out/Vortex_NebulaSwirl_4k.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

On a machine with a real GPU use `--concurrency` freely; with SwiftShader keep
`--concurrency=1` (SwiftShader already uses every core per frame).

### 6K stills (6000×3375)

```bash
npx remotion still BlackHole-EdgeOnPink out/BlackHole_EdgeOnPink_6k.png --frame=300 --scale=1.5625 --gl=angle
```

(Same for the other five IDs. `3840 × 1.5625 = 6000`, `2160 × 1.5625 = 3375`.
6K uses the `high` quality row automatically.)

### 720p previews (as delivered)

```bash
scripts/render-previews.sh          # all six, or pass composition IDs
```

This runs `--scale=0.3333333333333333` (→ exactly 1280×720, verified with
ffprobe), H.264, yuv420p, CRF 16, PNG frames, muted, and writes a 720p PNG
still of frame 300 of each.

## Quality settings (`src/shots.ts`, per data row)

| Setting | Look | preview (≤1080p) | high (4K/6K) |
|---|---|---|---|
| `steps` | black hole: max geodesic steps | 160 | 360 |
| `stepScale` | black hole: step length / radius | 0.07 | 0.03 |
| `deckSteps` / `deckBisect` | black hole (shot 3): deck march / bisection | 64 / 6 | 160 / 8 |
| `octaves` | fbm octaves (both looks) | 5 | 7 |
| `layers` / `marchSteps` | funnel shells / march steps per shell | 3 / 40 | 3 / 96 |

Every noise lookup is footprint-aware: octaves finer than the pixel fade to
their mean instead of aliasing, so 4K automatically shows more detail with the
same data. No per-frame random jitter is used anywhere.

## Measured render times

Measured in this build environment: 4-core cloud container, **no GPU**, so
WebGL ran on SwiftShader (ANGLE's CPU fallback), `--concurrency=1`. A real GPU
will be many times faster; these numbers are an upper bound.

| Composition | 720p preview (s/frame, whole render incl. bundling) | 4K `high` (s/frame, steady state) | 4K estimate, 600 frames |
|---|---|---|---|
| BlackHole_EdgeOnPink | 1.55 (928 s total) | 21.2 | ≈ 3.5 h |
| BlackHole_GoldFlare | 1.59 (955 s) | 23.6 | ≈ 3.9 h |
| BlackHole_DiscSkim | 3.68 (2210 s) | 66.0 | ≈ 11.0 h |
| Vortex_PurpleEye | 0.65 (387 s) | 4.6 | ≈ 0.8 h |
| Vortex_BlueFunnel | 2.59 (1556 s) | 24.4 | ≈ 4.1 h |
| Vortex_NebulaSwirl | 0.83 (496 s) | 8.2 | ≈ 1.4 h |
| **Total** | ≈ 1.8 h | | **≈ 24.7 h** (CPU / SwiftShader) |

4K steady-state = mean over 3 consecutive frames after page load and shader
compile (`scripts/bench.mjs 1 high <ID> 3`). A single cold 4K still adds about
5–8 s of page load + compile.

## How it works

* **Black hole** (`src/shaders/blackhole.ts`): each camera ray is integrated
  through the Schwarzschild metric (r_s = 1, acceleration −1.5 h² x / r⁵,
  velocity-Verlet, step ∝ r, bounding-sphere skip). Captured rays are black
  (plus a faint volume haze glow around the hole); escaped rays sample a
  procedural star/haze sky in their bent direction. The disc is a thin
  gaussian layer evaluated at each plane crossing (column emission/opacity ∝
  1/sin(incidence)), so the lensed images over and under the shadow come out
  of the geodesics. Emission: ridged + fbm streak noise stretched along the
  orbit, white-hot inner rim, Keplerian differential rotation, Doppler beaming
  D³, gravitational dimming. Shot 2 adds dusty outer streams; shot 3 adds a
  flowing fbm cloud-deck heightfield over the outer disc (found along the
  straight camera ray, bisection-refined, lit from the inner disc, depth-faded).
* **Vortex** (`src/shaders/vortex.ts`): gas in log-polar coordinates
  (ln r, θ + twist·ln r) so arms are logarithmic spirals; three layered fbm
  fields with domain warp, a streak layer and an integer arm modulation.
  Mode 1 raymarches three funnel shells `y = −D·a/√(r²+a²)` with bisection.
* **Post** (`src/shaders/post.ts`): 6-level resolution-independent bloom
  (levels at H/2…H/64), anamorphic horizontal streak from the HDR buffer,
  one cool halo ring, hue-preserving tonemap, then grain (~2 %, hash of
  pixel and `frame % 600`) and ±1/255 triangular dither as the very last step.

### Seamless loop

* Disc and deck flow: Keplerian angular speed per radius; the noise is sampled
  at two time phases (t and t − 1 loop) and cross-faded by t with
  variance-preserving weights. At t = 0 only phase A is visible, at t → 1 only
  phase B, and B(1) = A(0).
* Vortex: every layer rotates a whole number of turns per loop; "boiling"
  translates the noise around a circle in noise space (period = loop).
* Camera drift, zoom and push-in are sin/cos of the loop phase.
* Grain and dither use `frame % 600`.

### Determinism

All values derive from `useCurrentFrame()`. The R3F `useFrame` hook is used
only as the render callback (priority 1) and its clock is never read. The
noise lattice is generated once from `mulberry32` seeded at module level;
stars/specks use an integer PCG hash. No `Math.random()`, `Date.now()`,
`useState`-driven visuals or temporal accumulation.

## Adding a colourway or camera shot

1. Copy a row in `SHOTS` (`src/shots.ts`) and give it a new `id`
   (underscores fine; the composition ID replaces the first `_` with `-`).
2. Colourway: change the colour fields (`disc.colHot/colMid/colOuter`,
   `haze.*`, `post.streakColor/haloColor` for black holes; `colBg/colGas/
   colHi/colAccent/colGlow` for vortices).
3. Camera: black hole `camera.dist/elevDeg/azDeg/rollDeg/fovDeg/shift` (shift
   = where the hole sits in frame, NDC) and `camera.drift` (loop amplitudes);
   vortex `center/zoom/tilt/drift`, funnel `funnel.*`.
4. The composition is registered automatically by `src/Root.tsx`.
5. Re-run the loop check below for the new row.

## Verification

Run in this environment on the delivered build:

| Check | How | Result |
|---|---|---|
| 1. File checks | `ffprobe` on each mp4 | all six: h264, 1280×720, 30/1, 20.000 s, 600 frames, yuv420p, no audio stream |
| 2. Loop | `durationOverride: 601`, render frames 0 and 600 as PNG, compare | all six pixel-identical |
| 3. Determinism | frame 300 rendered mid-sequence (frames 290–310 in one tab) vs. a cold-start `remotion still` of frame 300 | all six pixel-identical |
| 4. Banding | `scripts/banding.py`: luma along glow falloffs into the dark background, on frame 300 decoded **from the encoded mp4** | smooth: dither interleaves neighbouring values (e.g. 16/17/18 → 8/9 → 6/7), no staircases; max local step ≤ 10 on bright structure, < 1 in dark falloff |
| 4. 4K stepping / noise | one 4K `high` frame per composition at 100 % | no raymarch stepping bands or noise; small jag on the DiscSkim horizon at grazing angles |
| 5. Content | contact sheets of 5 evenly spaced frames | motion visible in all six (disc flow, rotation, drift) |
| 6. Smoothness | frames 299/300/301, `scripts/flicker.py` | shots 1, 2, 4 at the grain floor; shots 3, 5, 6 show fast-moving fine detail (moving deck crests, motion-blurred specks, streaks) rather than flicker |

### Banding check, how to repeat

```bash
python3 scripts/banding.py out/Vortex_PurpleEye.mp4 640 360 1270 710   # eye -> dark corner
```

### Completion checklist

- [x] six compositions, 3840×2160 definitions, 30 fps, 600 frames, seamless loop
- [x] one data row per composition (camera, colours, disc/vortex params, quality)
- [x] WebGL2 via `@remotion/three`, `--gl=angle`
- [x] deterministic (no Math.random / Date.now / temporal state)
- [x] grain (~2 %) + ±1/255 dither after tonemapping
- [x] 720p previews + PNG stills, ffprobe-verified
- [x] measured 720p and 4K timings, 4K test frames deleted
- [ ] visual match to every reference — see the delivery report for the
      differences that remain after three comparison rounds per composition;
      `1405885287` (Nebula Swirl) was not supplied, so shot 6 was built from
      the written brief only
