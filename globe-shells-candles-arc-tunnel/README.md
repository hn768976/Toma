# Particle Globe · Dot Shells · Candle Chart · Light Arc · Dot Tunnel

Five looks, eight compositions, one Remotion project. Every composition is a
**20 s seamless loop** (600 frames at 30 fps), defined at **3840×2160**.

| Composition id | Look | Engine | Output name |
|---|---|---|---|
| `ParticleGlobe-Blue` | Particle Globe | three.js `Points` + streak quads, WebGL2 | `ParticleGlobe_Blue` |
| `DotShells-BlueCoral` | Dot Shells 2A | three.js `Points`, WebGL2 | `DotShells_BlueCoral` |
| `DotShells-VioletGold` | Dot Shells 2B | three.js `Points`, WebGL2 | `DotShells_VioletGold` |
| `CandleChart-Blue` | Candle Chart 3A | Canvas 2D, pre-rendered layer tiles | `CandleChart_Blue` |
| `CandleChart-Emerald` | Candle Chart 3B | Canvas 2D, pre-rendered layer tiles | `CandleChart_Emerald` |
| `LightArc-Gold` | Light Arc | full-screen fragment shader + `Points`, WebGL2 | `LightArc_Gold` |
| `DotTunnel-Blue` | Dot Tunnel 5A | three.js `Points`, WebGL2 | `DotTunnel_Blue` |
| `DotTunnel-Violet` | Dot Tunnel 5B | three.js `Points`, WebGL2 | `DotTunnel_Violet` |

(Remotion composition ids can't contain `_`, so ids use `-`; pass the output
file name you want on the command line.)

## Setup

```bash
npm install
npx remotion studio          # preview
```

Versions are pinned in `package.json` (Remotion 4.0.515, three 0.186.1,
@react-three/fiber 9.8.1, world-atlas 2.0.2, topojson-client 3.1.0).

### Chromium GL flag

WebGL2 runs in headless Chromium through ANGLE. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, i.e. Chromium's `--gl=angle`
(equivalent CLI flag: `--gl=angle`). On a machine **without a GPU** set
`REMOTION_GL=swangle` (ANGLE on SwiftShader) or pass `--gl=swangle`. In the
GPU-less build container both modes produced byte-identical frames (ANGLE
falls back to SwiftShader there).

## 4K renders

H.264, yuv420p, CRF 16 are set in `remotion.config.ts`.

```bash
npx remotion render ParticleGlobe-Blue   out/ParticleGlobe_Blue.mp4   --gl=angle --concurrency=4
npx remotion render DotShells-BlueCoral  out/DotShells_BlueCoral.mp4  --gl=angle --concurrency=4
npx remotion render DotShells-VioletGold out/DotShells_VioletGold.mp4 --gl=angle --concurrency=4
npx remotion render CandleChart-Blue     out/CandleChart_Blue.mp4     --gl=angle --concurrency=4
npx remotion render CandleChart-Emerald  out/CandleChart_Emerald.mp4  --gl=angle --concurrency=4
npx remotion render LightArc-Gold        out/LightArc_Gold.mp4        --gl=angle --concurrency=4
npx remotion render DotTunnel-Blue       out/DotTunnel_Blue.mp4       --gl=angle --concurrency=4
npx remotion render DotTunnel-Violet     out/DotTunnel_Violet.mp4     --gl=angle --concurrency=4
```

720p preview of any composition: add `--scale=0.3333333333333333` (gives exactly
1280×720 – verified on the stills).

## Stills (6000×3375)

6000/3840 = 1.5625, so render with `--scale=1.5625`:

```bash
npx remotion still ParticleGlobe-Blue out/ParticleGlobe_Blue_6k.png --frame=300 --scale=1.5625 --gl=angle
# same pattern for every composition id above
```

720p stills: `--scale=0.3333333333333333`.

## Measured render times

Measured in the build container: 4 vCPU, **no GPU** (WebGL2 on SwiftShader via
ANGLE), headless Chromium. "Per frame" excludes browser start-up: it's
(time for 21 frames − time for 1 frame) / 20, rendered on one thread
(`--concurrency=1`). On a machine with a real GPU and `--gl=angle`, the WebGL
looks will be several times faster.

| Composition | 720p, s/frame (1 thread) | 4K, s/frame (1 thread) | 4K, 600 frames, 1 thread | 4K, 600 frames, `--concurrency=4`* |
|---|---|---|---|---|
| ParticleGlobe-Blue | 4.07 | **5.16** (timed) | ≈ 52 min | ≈ 17 min |
| DotShells-BlueCoral | 3.17 | **3.90** (timed) | ≈ 39 min | ≈ 13 min |
| DotShells-VioletGold | 3.07 | ≈ 3.9 (same geometry as 2A) | ≈ 39 min | ≈ 13 min |
| CandleChart-Blue | 0.21 | 4.23 (timed) | ≈ 42 min | ≈ 14 min |
| CandleChart-Emerald | 0.23 | ≈ 4.2 | ≈ 42 min | ≈ 14 min |
| LightArc-Gold | 3.75 | 4.48 (timed) | ≈ 45 min | ≈ 15 min |
| DotTunnel-Blue | 2.51 | 3.45 (timed) | ≈ 34 min | ≈ 11 min |
| DotTunnel-Violet | 2.43 | ≈ 3.4 | ≈ 34 min | ≈ 11 min |

\* Measured speed-up at 720p going from `--concurrency=1` to `4` was about 3.4×
(Dot Shells: 4.6 → 1.34 s/frame wall-clock), so the last column assumes about 3×.

The two timed 4K frames the brief asks for:
* **2A (Dot Shells Blue-Coral)**, about 210k points with shader DoF over 4
  shells: **3.9 s** per frame (10.4 s for the first frame, including browser
  start-up).
* **1 (Particle Globe)**, 220k globe points, 80k shell points, 45k specks and
  350 streaks: **5.2 s** per frame (12.2 s for the first frame).

On a CPU-only machine the GL scenes cost about the same at 720p and 4K. The
time goes into per-frame fixed work (vertex processing of a few hundred
thousand points, capture and PNG encoding) rather than pixels.

`remotion.config.ts` raises the delayRender timeout to 180 s, because with
several tabs on software GL the first frame (building layouts and compiling
shaders) can take longer than Remotion's 30 s default.

## Where the build follows the reference clips over the brief's numbers

Each version A (and 1 and 4) was compared with its reference clip by a fresh
sub-agent, up to three rounds per look. Where the brief's numbers and the
reference disagreed, the reference look won:

* **Dot Shells.** Dot spacing along each ring equals the spacing between rings
  (a square grid), so the dots read as distinct dots as in the reference.
  Ring counts stay at 150/175/200/220, which gives about **210k points** instead
  of 400k. The camera sits between the r=1.25 and r=1.55 shells (inside the
  two outer shells), with a 92° field of view. Two shells have their poles
  turned toward the camera, so their whirlpools show. Shell offsets are up to
  0.05, not 0.12.
* **Dot Tunnel.** Rings sit every **0.125** (not 0.25) with **96** slots (not
  256), and the pattern period is K = 128 rings. The camera still travels
  exactly 16 units per loop. Denser rings and fewer slots make the dots read
  as radial spokes, as in the reference. About 35% of slots are empty, as
  specified.
* **Light Arc.** The ~90 lines are concentric curves in a **tilted plane seen
  in perspective** (fitted to the reference's band shape), not flat 2D
  ellipses. This gives the reference's thin, distant tail and broad near
  side. Each pixel still evaluates its radius and angle analytically, with a
  crisp anti-aliased core and halo.
* **Candle Chart.** The slope is 30° (the reference rises at about 30–35°, not
  22°). Main candles are 36 px wide at 4K, and the far layer's blur is 11 px.
* **Particle Globe.** 45k background specks (not 25k) to match the
  reference's density.
* **Glints and four-point sparkles.** The brief asks for them; the reference
  clips have few or none. They are kept but subtle.

## Determinism

* Every visual value is a function of `useCurrentFrame()` only, reduced to
  `frame % 600` (`src/lib/loop.ts`). Every animated term runs a whole number of
  cycles per loop, so frame 600 is the same picture as frame 0, and frame 599
  runs smoothly into frame 0.
* All layouts (points, rings, candles, line spacing, sparkles, land-mask
  sampling) come from `mulberry32` with fixed seeds (`src/lib/random.ts`).
  There is no `Math.random()`, `Date.now()`, R3F clock or state carried
  between frames.
* `@remotion/three`'s `ThreeCanvas` drives rendering. A priority-1 `useFrame`
  takes over the render and reads only the Remotion frame. Each frame is held
  with `delayRender` until the GL pass has finished.
* Bloom is a single-frame deterministic mip chain (13-tap downsample, tent
  upsample). There is no TAA and no history.
* Grain and dither are integer-hash functions of pixel position and
  `frame % 600` (WebGL looks), or fixed seeded noise tiles offset by
  `frame % 600` (Candle Chart).
* The land mask (Globe) and the candle layer tiles are built once at load,
  behind `delayRender`.

## Verification

Done in the build container on 720p renders (`--scale=1/3`, exactly 1280×720).
At the client's request no mp4 previews were rendered, only one still per
composition, so the checks that need an encoded mp4 were not run (see below).

| Check | Result |
|---|---|
| Loop (step 2): a 601-frame version (`--props='{"loopCheck":true}'`), frame 0 vs frame 600 | **Identical pixels, all 8.** The 599→0 wrap changes as much as any other step (e.g. Globe 3.92 vs 3.86 mean abs diff for 0→1). |
| Determinism (step 3): frame 300 rendered alone from a cold start vs frame 300 of a 4-thread sequence render of 290–310 | **Identical pixels, all 8.** |
| Banding (step 4) | Candle gradients, tunnel glow, globe haze, arc warm glow and shell haze show no contour steps even contrast-stretched ×4 (dither ±1/255 + grain). Light Arc: the empty upper-left is **100% pure black (0,0,0)**, so grain and dither are masked below about 3% luminance. |
| Contact sheets (step 5): frames 0/120/240/360/480 | All required features present. Motion is visible between frames. No text or logos. |
| Motion steadiness (step 6, stand-in): mean frame-to-frame change across frames 290–310 | Steady to within 1–4% for all 8 (no pops or judder). |
| Clean copy: `npm install && npx tsc && npx remotion studio` | Installs, typechecks, and the Studio builds and serves. |

**Not run** (they need an encoded video, which was dropped at the client's
request): the ffprobe check of the mp4 (step 1), banding measured on the
*encoded* H.264 (step 4 was measured on the PNGs instead), and stepping
through a 2 s clip by eye (step 6 used the numeric stand-in above).

Helper scripts: `scripts/verify.mjs` (renders the stills, loop and contact frames
with one browser), `scripts/loopcheck.sh`, `scripts/coldcheck.sh`,
`scripts/seq_and_time.sh`, and `dev.sh` (quick 720p still of any composition).

### Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps, 600 frames, one data row per version
- [x] Seamless 20 s loops: frame 600 is identical to frame 0 for all 8
- [x] Deterministic: cold frame 300 is identical to the sequence frame 300 for all 8
- [x] No `Math.random()`, no `Date.now()`, no R3F clock, no TAA
- [x] Dither ±1/255 and grain from position and frame % 600; the Light Arc black stays clean
- [x] No text, logos, numbers or tickers
- [x] 720p PNG still of each composition
- [x] Render times measured (720p per composition, plus 4K frames of 2A and 1)
- [ ] 720p mp4 previews: not rendered, at the client's request

## Adding a colourway

Each version is one data row in `src/Root.tsx` (`GLOBE_VERSIONS`,
`SHELLS_VERSIONS`, `CANDLE_VERSIONS`, `ARC_VERSIONS`, `TUNNEL_VERSIONS`). Copy a
row, give it a new `id` (letters, digits and `-`), and change the hex colours.
The schema for each look (zod, in `src/looks/*`) lists the fields, and the
Studio's props panel can edit them live. Geometry is shared, so a new row
needs no other change.

## Licence note: land outlines

The Particle Globe's land mask is rasterised at load from **world-atlas**
`land-110m.json` (© 2013–2019 Michael Bostock, ISC licence), read with
**topojson-client** (ISC). world-atlas is derived from
**Natural Earth** data, which is in the **public domain**
(naturalearthdata.com).

## Project layout

```
src/Root.tsx            compositions + one data row per version
src/gl/GLStage.tsx      ThreeCanvas driver (frame -> uniforms -> post chain)
src/gl/post.ts          bloom mip chain, background glows, vignette, grain, dither
src/gl/points.ts        DoF point-sprite shader shared by the point looks
src/looks/globe.ts      Look 1   src/looks/landmask.ts  world-atlas rasteriser
src/looks/shells.ts     Look 2
src/looks/CandleChart.tsx Look 3
src/looks/arc.ts        Look 4
src/looks/tunnel.ts     Look 5
scripts/                verification helpers (loop check, stills)
```
