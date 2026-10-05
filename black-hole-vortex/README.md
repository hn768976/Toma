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

MEASURED_TIMES

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

VERIFICATION
