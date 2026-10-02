# Acronym Cubes on Chart Paper

Wooden letter cubes tumble onto a printed stock-chart sheet and land spelling a
finance acronym, under dappled window light. Remotion + `@remotion/three`
(react-three-fiber, WebGL2), 30 fps, 300 frames (10 s), compositions defined at
3840×2160.

> **These clips do NOT loop.** Each is a one-way reveal: empty paper (frames
> 0–15), cubes drop, roll and settle (15–110), then a long still hold with a
> slow push-in and drifting light (110–299) for titles and trimming. Do not
> keyword them as loops.

## Quick start

```bash
npm install
npx remotion studio          # preview every composition
npm run check                # motion / word / framing checks (Node, no browser)
```

Node 18+ (tested on Node 22). All dependency versions are pinned in
`package.json` / `package-lock.json`.

## The 13 compositions

One template (`src/scene/AcronymCubes.tsx`), one data row each
(`src/data/acronyms.ts`). Composition ids are `Cubes-<ACRONYM>` because Remotion
does not allow `_` in ids; the render commands below still write
`Cubes_<ACRONYM>.mp4`.

| Composition | Cubes | Chart line (`shape`) | Mid-tumble still frame |
|---|---|---|---|
| `Cubes-ETF` | 3 | steady rise with small wobbles (`steadyRise`) | 53 |
| `Cubes-IPO` | 3 | flat, then a sharp listing pop (`listingPop`) | 44 |
| `Cubes-ROI` | 3 | clear rise (`clearRise`) | 54 |
| `Cubes-GDP` | 3 | rise, dip, recovery (`dipRecovery`) | 54 |
| `Cubes-CPI` | 3 | steady smooth climb (`steadyClimb`) | 56 |
| `Cubes-KPI` | 3 | rising in steps (`steppedRise`) | 45 |
| `Cubes-401K` | 4 | long, gentle compounding rise (`longGentleRise`) | 60 |
| `Cubes-IRA` | 3 | long, gentle rise, different seed (`longGentleRise`) | 56 |
| `Cubes-ESG` | 3 | gentle steady rise (`gentleRise`) | 39 |
| `Cubes-APR` | 3 | flat runs with jumps / rate changes (`rateSteps`) | 45 |
| `Cubes-VAT` | 3 | mostly flat, sideways (`flatSideways`) | 45 |
| `Cubes-GST` | 3 | mostly flat, sideways (`flatSideways`) | 55 |
| `Cubes-B2B` | 3 | rising (`rising`) | 53 |

VAT, GST (taxes) and B2B (a sales term) suit a stock-chart background least;
the paper says "stock market" before the cubes land. B2B is the weakest.

## Render commands

### Chromium GL flag

WebGL2 in headless Chromium needs ANGLE: `--gl=angle`. It is already set in
`remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), so the
commands below do not repeat it. Pass `--gl=angle` explicitly if you call the
Remotion CLI or Node APIs without this config. On a machine without a GPU,
Chromium's ANGLE backend falls back to SwiftShader (CPU), which works but is
slow (see timings below). On a GPU machine `--gl=angle` uses the GPU.

### 4K (3840×2160) — one per acronym

```bash
npx remotion render Cubes-ETF  out/Cubes_ETF_4K.mp4
npx remotion render Cubes-IPO  out/Cubes_IPO_4K.mp4
npx remotion render Cubes-ROI  out/Cubes_ROI_4K.mp4
npx remotion render Cubes-GDP  out/Cubes_GDP_4K.mp4
npx remotion render Cubes-CPI  out/Cubes_CPI_4K.mp4
npx remotion render Cubes-KPI  out/Cubes_KPI_4K.mp4
npx remotion render Cubes-401K out/Cubes_401K_4K.mp4
npx remotion render Cubes-IRA  out/Cubes_IRA_4K.mp4
npx remotion render Cubes-ESG  out/Cubes_ESG_4K.mp4
npx remotion render Cubes-APR  out/Cubes_APR_4K.mp4
npx remotion render Cubes-VAT  out/Cubes_VAT_4K.mp4
npx remotion render Cubes-GST  out/Cubes_GST_4K.mp4
npx remotion render Cubes-B2B  out/Cubes_B2B_4K.mp4
```

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, PNG frames into the
encoder (no JPEG intermediates) and `--gl=angle`. No audio track is added.

On a GPU machine use the default concurrency. **On a CPU-only machine add
`--concurrency=1`**: SwiftShader already uses every core, and extra tabs only
slow it down (measured below).

### 1080p previews (as delivered)

```bash
npx remotion render Cubes-ETF  out/Cubes_ETF.mp4  --scale=0.5
npx remotion render Cubes-401K out/Cubes_401K.mp4 --scale=0.5
```

### Stills

```bash
# 6000×3375 PNG, two per acronym: frame 200 (at rest) + the mid-tumble frame
npx tsx scripts/render-stills.ts --hires            # all 13
npx tsx scripts/render-stills.ts --hires ETF 401K   # just some

# 1080p PNG at frame 200 for all 13 (spelling / chart-line check)
npx tsx scripts/render-stills.ts --preview

# or one by one (scale 1.5625 × 3840 = 6000)
npx remotion still Cubes-ETF out/Cubes_ETF_f200.png --frame=200 --scale=1.5625 --image-format=png
npx remotion still Cubes-ETF out/Cubes_ETF_f53.png  --frame=53  --scale=1.5625 --image-format=png
```

The mid-tumble frame per acronym is in the table above. `npm run check` prints
it, and the stills script picks it automatically: the frame where a cube is
clearly airborne, fully inside the frame, with as many cubes on screen as
possible.

## Measured render time

RENDER_TIMES_PLACEHOLDER

## Banding check

BANDING_PLACEHOLDER

## Determinism

Remotion renders frames out of order, in several browser tabs. Every value on
screen is a pure function of the frame number:

- **No physics engine.** The tumble is closed-form (`src/lib/motion.ts`): drop
  arc, then 90° rolls about the rounded edge that touches the paper (the edge's
  cylinder rolls without slipping, so the cube never sinks or floats), then a
  settle `amp · e^(−k·t) · sin(ω·t)`, then exact rest from `tRest` (all ≤ 116).
  The roll sequence is solved backwards from the final pose, so the target
  character always lands on top, upright.
- **No `Math.random()` anywhere.** `mulberry32` seeded per purpose
  (`src/lib/prng.ts`): chart line, volume bars, paper fibres, light pattern,
  wood, side-face letters, roll counts and timings.
- **No `useFrame` clock, no `Date.now()`, no state carried between frames.**
  Per-frame values (camera, light drift, grain seed) are set in a
  `useLayoutEffect` keyed on `useCurrentFrame()`.
- **Canvas textures are generated once** per acronym and cached at module
  level, never per frame.
- **Font and textures are behind `delayRender` / `continueRender`.** The handle
  is released only after the `<ThreeCanvas>` has mounted. That canvas holds its
  own handle until R3F has drawn the frame, so no frame can capture blank cubes.
- **No async setup in the render path.** The post-processing composer
  (DoF → ACES → grain) is built synchronously in `useMemo`.
  `@react-three/postprocessing`'s `<EffectComposer>` builds its composer in a
  `useEffect` + `setState`, which can miss a cold tab's first frame. The PCSS
  shadow patch is installed at module load for the same reason: drei's
  `<SoftShadows>` patches in an effect, after the first frame.
- **No `AccumulativeShadows`** (it accumulates over frames). Soft shadows are
  PCSS on a 4096² shadow map.

Self-check used: `remotion still ... --frame=100` from a cold start compared
byte-for-byte with frame 100 of a full, out-of-order (`--concurrency=2`) render
to a PNG sequence:

```bash
npx remotion render Cubes-ETF out/seq --sequence --image-format=png --scale=0.5 --concurrency=2
npx remotion still  Cubes-ETF out/cold_100.png --frame=100 --scale=0.5 --image-format=png
python3 scripts/verify.py same out/seq/element-100.png out/cold_100.png
```

## How it is built

- `src/data/acronyms.ts`: the 13 data rows (`id`, `shape`, `seed`).
- `src/lib/world.ts`: framing as fractions of the frame. Cube top face = 11.5%
  of frame height; gap = 12% of cube width; camera 10° off vertical, 30° fov,
  2.5% straight push-in; key light position and drift.
- `src/lib/motion.ts`: the tumble.
- `src/lib/sideFaces.ts`: side-face letters. Consonants (and the odd 3/4/7)
  only, never O/0/I/1, never the acronym's own characters. The pick is
  repaired until no combination of faces that neighbouring cubes show the
  camera, at any frame from the first drop until everything is still, forms
  a 2–4 letter English word, a rude word or a known acronym.
- `src/lib/chart.ts`: per-acronym price line (seeded random-walk bridge over
  the shape, scaled to pass under the cube row) and volume-bar clusters.
- `src/textures/paper.ts`: the 8192×4608 sheet. Paper, grid and dashed rule
  use a fixed seed, so they are identical in all 13. No numbers, labels,
  tickers or currency.
- `src/textures/wood.ts`: procedural pale birch/beech grain, per-cube tint,
  letters printed into the wood (multiplied ink, darker rim, grain showing
  through).
- `src/textures/lightPattern.ts`: soft round spots in curved rows (perforated
  / woven screen), dimmed by lattice bars and foliage.
- `src/scene/AcronymCubes.tsx`: the scene.
  - **Key:** a `SpotLight` from upper-left with `SpotLight.map` = the pattern,
    so the dapple falls on the paper and the cubes and bends over their edges.
    The light and its target translate together 0.42 units over the clip: the
    pattern drifts slowly sideways while the shadow direction stays put.
  - **Fill:** warm, from the opposite side, at 40% of the key.
  - **Shadows:** PCSS toward lower-right, plus a contact-darkening decal under
    each resting cube.
  - **Post:** real depth-of-field (postprocessing `DepthOfFieldEffect`,
    focused on the cube tops), ACES filmic tone mapping, sRGB output, ±1/255
    shader noise on paper and cubes, and 1.75% film grain hashed from
    (pixel, frame).

### How to add an acronym

Add **one row** to `ACRONYMS` in `src/data/acronyms.ts`:

```ts
{ id: "EPS", shape: "clearRise", seed: 1616 },
```

That's all: the composition `Cubes-EPS` appears, with its side letters, rolls,
timings, chart line and volume bars derived from `seed`. Characters A–Z and 0–9
are supported; up to four cubes fit the frame at the fixed cube size. Then run
`npm run check`. If it reports a word or collision for the new row, change the
seed. Available shapes are listed at the top of the same file.

## Asset sources and licences

- **Font:** Archivo Black, © 2017 The Archivo Black Project Authors, SIL Open
  Font License 1.1. Shipped as `public/fonts/ArchivoBlack-Regular.woff2` (from
  the `@fontsource/archivo-black` package); licence text in
  `public/licenses/ArchivoBlack-OFL.txt`.
- **Wood texture:** generated procedurally in `src/textures/wood.ts` (seeded
  value noise: growth rings, pores, tone). No external image, nothing to
  license. Poly Haven and ambientCG were not reachable from the build
  environment, and the brief allows a generated grain.
- **Word list** for the side-face check: `an-array-of-english-words` (MIT,
  © Zeke Sikelianos), reduced to 2–4 letter words in `src/data/shortWords.ts`
  (regenerate with `npx tsx scripts/build-wordlist.ts`).
- **PCSS shader:** adapted from drei's `SoftShadows` (MIT, pmndrs).
- Paper, chart, light pattern: generated in code.

## Completion checklist

CHECKLIST_PLACEHOLDER
