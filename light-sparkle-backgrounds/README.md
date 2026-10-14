# Light & Sparkle Backgrounds (Remotion + PixiJS 8 / WebGL2)

Five looks, eight compositions, one shared light-and-sparkle kit. Every composition is
**3840×2160, 30 fps, 600 frames (20 s), a seamless loop**. Nothing is random at render time:
every value on screen is a function of `useCurrentFrame()` only.

| Composition id | Output file | Look |
|---|---|---|
| `SpotlightSparkles-Blue` | `SpotlightSparkles_Blue.mp4` | 1A rays + sparkles, blue |
| `SpotlightSparkles-Gold` | `SpotlightSparkles_Gold.mp4` | 1B rays + sparkles, gold |
| `PastelBokeh-PinkLavender` | `PastelBokeh_PinkLavender.mp4` | 2A pastel bokeh |
| `PastelBokeh-MintAqua` | `PastelBokeh_MintAqua.mp4` | 2B pastel bokeh |
| `SunFlare-Midday` | `SunFlare_Midday.mp4` | 3A sun, starburst, lens flares |
| `SunFlare-GoldenHour` | `SunFlare_GoldenHour.mp4` | 3B warm low sun |
| `StarTwinkle-Black` | `StarTwinkle_Black.mp4` | 4 cross-flare stars on pure black |
| `SilkLight-PaleBlue` | `SilkLight_PaleBlue.mp4` | 5 pale diagonal light streaks |

(Remotion ids only allow letters, digits and `-`, so ids use a dash and file names an underscore.)

## Setup

```bash
npm install          # Node 18+; versions are pinned in package.json
npx remotion studio  # preview (the Studio renders the GL canvas at half resolution for speed)
```

## GPU / Chromium flag

PixiJS runs on **WebGL2** (not WebGPU). Headless Chromium needs the ANGLE backend:

```
--gl=angle
```

It is already set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), so the
commands below don't need it, but pass it explicitly if you render through the Node API or
another config. On a machine without a GPU ANGLE falls back to SwiftShader (CPU) — that is
what the timings below were measured on.

## Render commands (4K, final)

The config already sets PNG intermediate frames (no JPEG blocking on gradients), H.264,
`yuv420p`, CRF 16.

```bash
npx remotion render src/index.ts SpotlightSparkles-Blue   out/SpotlightSparkles_Blue.mp4   --gl=angle
npx remotion render src/index.ts SpotlightSparkles-Gold   out/SpotlightSparkles_Gold.mp4   --gl=angle
npx remotion render src/index.ts PastelBokeh-PinkLavender out/PastelBokeh_PinkLavender.mp4 --gl=angle
npx remotion render src/index.ts PastelBokeh-MintAqua     out/PastelBokeh_MintAqua.mp4     --gl=angle
npx remotion render src/index.ts SunFlare-Midday          out/SunFlare_Midday.mp4          --gl=angle
npx remotion render src/index.ts SunFlare-GoldenHour      out/SunFlare_GoldenHour.mp4      --gl=angle
npx remotion render src/index.ts StarTwinkle-Black        out/StarTwinkle_Black.mp4        --gl=angle
npx remotion render src/index.ts SilkLight-PaleBlue       out/SilkLight_PaleBlue.mp4       --gl=angle
```

720p preview of one composition: add `--scale=0.3333333333333333` (gives exactly 1280×720).
The GL canvas follows Remotion's scale (devicePixelRatio), so a scaled render really draws
at the output size — it is not a 4K render shrunk afterwards.

### 6K stills (6000×3375)

```bash
npx remotion still src/index.ts SpotlightSparkles-Blue out/SpotlightSparkles_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(any composition id; 3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375. Not rendered here.)

## How it is built

```
src/
  kit/
    engine.ts      Pixi WebGL2 renderer, half-float targets, bloom chain, final composite pass
    glsl.ts        shared GLSL: PCG integer hash, periodic value noise/fbm, grain + blue-noise dither
    sprites.ts     sprite textures prebaked once in Canvas 2D (512 px, mipmapped)
    blueNoise.ts   64×64 void-and-cluster blue noise, generated once at module level
    particles.ts   ParticleContainer helpers
    loop.ts        loop constants, whole-cycle pulse(), glint envelope
    random.ts      mulberry32 (seeded, used only at scene construction)
  looks/           one file per look: its GLSL background + its sprite layers + update(frame)
  variants.ts      ONE DATA ROW PER VERSION
  LightScene.tsx   Remotion component (delayRender until the GL scene is built, one manual render per frame)
  Root.tsx         one <Composition> per row
```

Per frame (no ticker, no stored state):
1. `look.update(frame)` sets every particle and uniform from `frame % 600`.
2. Sprite layers → `rgba16float` render target, additive.
3. Bloom: 1/2 → 1/4 (9-tap gaussian = bloom 1) → 1/8 → 1/16 (gaussian = bloom 2), all half-float, fixed kernels.
4. Final pass computes the look's background (gradients, rays, sun, streaks) in float, screens the
   sprites + bloom over it, adds grain and blue-noise dither, and writes the 8-bit canvas.

Shared kit: sparkle sprite (4-point with faint diagonals, 4-point with chromatic fringe, 6-point,
plain dot), streak sprite, bokeh sprite (round, soft round, slightly hexagonal), ring; twinkle =
`pulse(phase, k, φ, sharpness)` with `k` cycles per loop (period divides 600) plus glints on a
fixed schedule with a wrapped envelope; ray shader; multi-stop float gradients; fixed bloom.

### Add a colourway (one data row)

Copy a row in `src/variants.ts`, give it a new `id` (letters/digits/dashes) and `file`, change
the colours:

```ts
{ id: "SpotlightSparkles-Rose", file: "SpotlightSparkles_Rose", make: () => spotlight({ seed: 1001, bgEdge: "#1A0210", bgCenter: "#7A1A4A", rays: "#FF9AC8", sparkles: ["#FFFFFF", "#FFE2F0", "#FFC0DC"] }) },
```

It appears in the Studio and can be rendered with the commands above. Keep the same `seed` to
get the same layout as its sibling, or change it for a new layout.

## Loop check

`--props='{"loopCheck":true}'` makes any composition 601 frames long, so frame 600 can be
rendered and compared to frame 0:

```bash
npx remotion still src/index.ts SunFlare-Midday out/f0.png   --frame=0   --props='{"loopCheck":true}' --scale=0.3333333333333333
npx remotion still src/index.ts SunFlare-Midday out/f600.png --frame=600 --props='{"loopCheck":true}' --scale=0.3333333333333333
```

## Verification scripts (used to produce the results below)

- `node scripts/render-preview.mjs [ids]` — 720p PNG sequence → ffmpeg H.264 CRF 16 yuv420p, records per-frame time, keeps verification frames.
- `node scripts/stills.mjs <dir> <frame> [scale] [ids]` — cold single-frame stills (set `LOOPCHECK=1` for the 601-frame variant).
- `node scripts/time-frames.mjs <scale> <from> <to> <concurrency> <ids>` — per-frame render timing.
- `python3 scripts/verify.py [ids]` — ffprobe checks, cold-vs-full byte comparison, banding lines, black level, contact sheets, motion.

## Measured render times (this machine)

Machine: 4-core cloud container, **no GPU**: WebGL2 runs on ANGLE → SwiftShader (CPU).
Headless shell Chromium 1194, Remotion 4.0.515, PixiJS 8.21.0. Timings are Remotion's per-frame
time (render + PNG screenshot), concurrency 1, frames 285–314. Raising concurrency did not help:
SwiftShader already uses every core.

| Composition | 720p median / frame | 720p full 600-frame preview (wall) |
|---|---|---|
| SpotlightSparkles-Blue | 0.52 s | 3.9 min |
| SpotlightSparkles-Gold | 0.49 s | 3.7 min |
| PastelBokeh-PinkLavender | 0.50 s | 3.7 min |
| PastelBokeh-MintAqua | 0.51 s | 3.9 min |
| SunFlare-Midday | 0.98 s | 8.2 min |
| SunFlare-GoldenHour | 0.96 s | 8.2 min |
| StarTwinkle-Black | 0.25 s | 1.6 min |
| SilkLight-PaleBlue | 0.38 s | 2.6 min |

**Two real 4K frames (3840×2160, frame 300, cold browser):**
- **1A SpotlightSparkles-Blue: 4.7 s** (3.4–4.9 s over frames 299–301).
- **2A PastelBokeh-PinkLavender: 3.6 s** (3.2–4.5 s).

4K is roughly 7–9× the 720p cost here, close to the 9× pixel ratio, so the cost is per pixel.

**4K estimates per 600-frame composition, on this CPU-only box:**
- 1A/1B: about 47 min each.
- 2A/2B: about 36 min each.
- 3A/3B: about 85 min each.
- 4: about 20 min.
- 5: about 35 min.

That's roughly **6.5 h for all eight**. On a machine with a real GPU, the WebGL work drops to
milliseconds and the PNG screenshot dominates; expect a small fraction of this.

## Verification results

All eight passed every check below on the final code.

| Check | Result |
|---|---|
| 1. ffprobe | All 8: h264, 1280×720, 30/1, yuv420p, no audio stream, 20.000 s, 600 frames |
| 2. Loop | 601-frame variant (`loopCheck`): frame 600 ≡ frame 0 pixel for pixel, all 8. Also checked that the 599→0 step on lossless frames matches a normal frame step (ratio 0.84–1.06), so no term jumps at the seam |
| 3. Determinism | Cold single still of frame 300 vs frame 300 of the full render: **byte-identical PNG files**, all 8 |
| 4. Banding | Frame 300 decoded **from the mp4**, 6 full-length lines each (3 columns, 3 rows), see below |
| 4. Black level | Look 4: 50 points away from stars in the mp4 frame all read **0,0,0** (71.5 % of the lossless frame is exactly 0) |
| 5. Contact sheets | 5 frames each (0/120/240/360/480): each look shows what its section of the brief asks for |
| 6. Motion | Frame-to-frame change over frames 270–330 is flat (max/median 1.02–1.25; Star Twinkle 2.1 from the deliberate glints); no one-frame strobes; sprites are mipmapped |

**Banding detail.**
- Longest run of identical RGB pixels along any gradient line, in the decoded mp4 frame: 10 px (Spotlight), 24 px (Pastel), 24 px (Sun), 25 px (Silk). Plateaus would mean banding; these are short.
- The only long runs are in clipped pure white (the sun core) and exact black (Look 4), which is intended.
- Contrast-stretched crops of the pale and dark gradients show grain, with no contour steps.
- `-tune grain` was not needed at CRF 16.
- How it's built: float gradients, `rgba16float` targets, 64×64 blue-noise dither offset by `frame % 600`, and a hashed grain (1.5 %, 2 % on Looks 2 and 5). Look 4 has no grain or dither.

## Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps, 600 frames, seamless loops, one data row each
- [x] PixiJS 8 on WebGL2 (`preference: "webgl"`), manual render per Remotion frame, no ticker
- [x] No `Math.random`, `Date.now`, clocks or carried state; mulberry32 seeded at construction
- [x] Sprites prebaked once (Canvas 2D, 512 px, mipmapped); `delayRender` until ready
- [x] Half-float targets, blue-noise dither, deterministic grain; Look 4 exactly black
- [x] 720p previews + 720p stills of all 8; steps 1–6 pass
- [x] Render times, two timed 4K frames, 4K estimates
- [x] Zip without node_modules / .git / refs / output; clean `npm install && npx remotion studio` checked
