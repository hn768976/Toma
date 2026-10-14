# AI HUD Plane · Particle AI Chip · AI Chip Reveal

Five motion graphics in one Remotion project, built on **three.js / WebGL2**
(`@remotion/three`). The shared kit has "AI" letterforms, HUD widgets and a chip
model. It is used in three looks, which make five compositions:

| Composition (Remotion ID) | Output file | Look | Length |
|---|---|---|---|
| `AIHudPlane-Violet` | `AIHudPlane_Violet.mp4` | tilted HUD plane builds itself, violet | 450 f · 15 s story |
| `AIHudPlane-Teal` | `AIHudPlane_Teal.mp4` | same, teal | 450 f · 15 s story |
| `ParticleAIChip-Blue` | `ParticleAIChip_Blue.mp4` | chip drawn from ~40k glowing points | 600 f · 20 s loop |
| `AIChipReveal-Blue` | `AIChipReveal_Blue.mp4` | letters scramble → "AI", callouts draw out | 300 f · 10 s story |
| `AIChipReveal-Amber` | `AIChipReveal_Amber.mp4` | same, amber | 300 f · 10 s story |

> Remotion composition IDs may not contain `_`, so the IDs use `-`
> (`AIHudPlane-Violet`). The output files keep the requested `_` names.

All compositions are 30 fps, 16:9 and defined at **3840×2160**.

## Quick start

```bash
npm install
npx remotion studio          # preview (the studio renders at reduced resolution)
```

Node 18+ is needed. The fonts are bundled in `public/fonts` (see *Fonts*).

## Rendering

### Chromium GL flag

Use **`--gl=angle`**. `remotion.config.ts` already sets
`Config.setChromiumOpenGlRenderer("angle")`, so the CLI picks it up. If you
render through the Node APIs, pass `chromiumOptions: { gl: "angle" }`. ANGLE
uses the GPU when one is present and falls back to SwiftShader (software)
when there is none. All three looks use WebGL2, not WebGPU.

### 4K (3840×2160) — one command per composition

```bash
npx remotion render src/index.ts AIHudPlane-Violet   out/AIHudPlane_Violet_4K.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render src/index.ts AIHudPlane-Teal     out/AIHudPlane_Teal_4K.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render src/index.ts ParticleAIChip-Blue out/ParticleAIChip_Blue_4K.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render src/index.ts AIChipReveal-Blue   out/AIChipReveal_Blue_4K.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render src/index.ts AIChipReveal-Amber  out/AIChipReveal_Amber_4K.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

(ProRes: `--codec=prores --prores-profile=4444`.)

### 720p previews

```bash
npx remotion render src/index.ts AIHudPlane-Violet out/AIHudPlane_Violet.mp4 \
  --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p
```

`scripts/render-previews.sh` renders all five (`--muted`, so there is no silent audio track) and logs the wall time.
Remotion adds a silent AAC track unless `--muted` is passed; add it to the 4K commands too if you need video-only files.
`3840 × 0.3333333333333333` rounds to exactly 1280×720, so no ffmpeg
downscale is needed (checked with ffprobe).

### 6000×3375 stills

```bash
npx remotion still src/index.ts AIHudPlane-Violet out/AIHudPlane_Violet_6K.png --frame=360 --scale=1.5625 --gl=angle
npx remotion still src/index.ts ParticleAIChip-Blue out/ParticleAIChip_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
npx remotion still src/index.ts AIChipReveal-Blue out/AIChipReveal_Blue_6K.png --frame=240 --scale=1.5625 --gl=angle
```

`--scale` drives the WebGL drawing-buffer size directly: the canvas `dpr`
follows Remotion's device scale factor. A 6K still is therefore rendered at
6K, not upscaled. Point sizes, line widths and blur radii are written in px at
2160p and scale with the output.

## Measured render times

Measured on the build machine: a 4-vCPU cloud container with **no GPU**, so
headless Chromium ran WebGL2 on ANGLE → SwiftShader (software). On a machine
with a GPU expect these to be several times faster.

### 720p (1280×720, `--scale=0.3333333333333333`), full renders

| Composition | Frames | Wall time | Per frame (concurrency 4) | Per frame (concurrency 1, 6-frame run) |
|---|---|---|---|---|
| AIHudPlane-Violet | 450 | 285 s | 0.63 s | 0.67 s |
| AIHudPlane-Teal | 450 | 289 s | 0.64 s | — (same scene) |
| ParticleAIChip-Blue | 600 | 333 s | 0.55 s | 0.65 s |
| AIChipReveal-Blue | 300 | 199 s | 0.66 s | 0.63 s |
| AIChipReveal-Amber | 300 | 185 s | 0.62 s | — (same scene) |

SwiftShader already spreads one frame across all cores, so extra Remotion
concurrency barely helps on a CPU-only machine.

### Two real 4K frames (3840×2160, `--scale=1`)

| Frame | Cold single still (browser start + one-time texture builds + frame) | Steady-state per frame (6-frame run, concurrency 1) |
|---|---|---|
| AIHudPlane-Violet, frame 360 (hold) | 14.2 s | ≈ 5.8 s |
| ParticleAIChip-Blue, frame 300 | 11.4 s | ≈ 4.2 s |

Both stills were checked: 3840×2160.

### 4K estimates (same CPU-only machine)

4K costs ≈ 7–9× the 720p per-frame time (9× the pixels; the HUD and point
passes scale with pixels, the per-frame JS does not).

| Composition | Estimate |
|---|---|
| AIHudPlane-Violet / Teal (450 f × ≈5.8 s) | ≈ 44 min each |
| ParticleAIChip-Blue (600 f × ≈4.2 s) | ≈ 42 min |
| AIChipReveal-Blue / Amber (300 f × ≈5.5 s, scaled from 720p) | ≈ 28 min each |
| **All five** | **≈ 3 h 10 min** |

On a desktop GPU (ANGLE → GPU), expect well under 1 s per 4K frame and
roughly 30–40 min for all five. That figure is an estimate; it was not
measured here.

## How to change things

### Centre text, labels, colours → `src/colorways.ts`

Each version is **one data row** in `ROWS`:

```ts
{ look: "chipReveal", id: "AIChipReveal_Amber", hud: "#FFE6B8", ticks: "#FFC060", die: "#1E1208",
  bokeh: ["#FF8A3A", ...], board: "#2A1606", centre: "AI",
  labels: { chatbot: "CHATBOT", prompt: "COMMAND PROMPT:", data: "DATA", model: "MODEL" } }
```

* **Centre text:** change `centre` (e.g. `"ML"`). The letter scramble in
  AI Chip Reveal locks onto whatever string you put here.
* **Callout labels** (AI Chip Reveal): change `labels`.
* **Add a colourway:** copy a row and give it a new `id`, e.g.
  `AIHudPlane_Green`. The ID becomes `AIHudPlane-Green` in Remotion
  automatically. Change the colours and nothing else.
* The HUD plane headings and the made-up code are in
  `src/looks/HudPlane.tsx` (`buildSheet`). The code lines come from a seeded
  generator in `src/kit/hudText.ts`.

## Project layout

```
src/
  Root.tsx                 compositions (one per data row)
  colorways.ts             the data rows
  kit/
    Stage.tsx              ThreeCanvas wrapper (dpr = render scale, font gate)
    Pipeline.tsx           half-float post chain: bloom, vignette, grain, dither
    painter.ts             Canvas-2D HUD painter → RGBA texture with reveal-time channel
    materials.ts / glsl.ts HUD + texture materials with in-material depth of field
    chip.ts                shared chip layout (pads, die frame) — texture & point source
    board.ts / bokeh.ts    blurred circuit board, bokeh discs
    fonts.ts               FontFace loading behind delayRender
    random.ts              mulberry32, integer hashes, held tickers
  looks/
    HudPlane.tsx           Look 1
    ParticleChip.tsx       Look 2
    ChipReveal.tsx         Look 3
scripts/                   preview render, file checks, determinism, banding helpers
public/fonts/              OFL fonts + licence texts
```

## How it works

* **HUD build-on.** Each HUD sheet is drawn **once** with Canvas 2D into two
  canvases. They are packed into one texture: R is line/text, G is cell fill,
  B is reveal time × coverage, and A is coverage. The shader shows a pixel
  once `now ≥ B/A` and flashes it briefly as it appears. Lines are stroked in
  short segments with increasing time, so they grow from a corner. Text gets
  one time per character, so it types in. Mip levels average reveal times
  weighted by coverage, so blurred areas reveal correctly too.
* **Live layers** (ticking numbers, the letter scramble) are small canvases.
  Each is redrawn only when its string changes. The string is a pure function
  of the frame: `hash(slot, floor(frame / hold))`.
* **Depth of field without a DoF pass.** Every material computes its own
  circle of confusion: a screen-space band for the tilted HUD, or a thin-lens
  depth for the chips. It then samples its texture with 12 Vogel-disc taps
  at a matching mip level, or grows its point sprites with energy
  conservation. This keeps DoF exact on transparent, additive layers. TAA and
  accumulation are not used.
* **Post.** The scene renders into an RGBA16F target. A 5-level bloom chain
  follows, also in half float. The final pass adds the vignette, a soft
  shoulder, about 1.5 % grain from an integer hash of
  (pixel, frame mod period) and ±1/255 triangular dither.

## Determinism

* Nothing uses `Math.random()`, `Date.now()`, the R3F clock or `useState`
  for visuals. Every value comes from `useCurrentFrame()`. The only `useState`
  is the font-loading gate.
* The R3F `useFrame` callback runs with priority 1 only so that the post chain
  replaces the default render. Its `clock` and `delta` are never read.
* Layouts, HUD text, pad sets and the 40k particle set are generated from
  constant seeds (`mulberry32`). The particle sets are built at module level.
* The loop composition uses `frame % 600` everywhere. Its motions have whole
  numbers of cycles, the twinkle has 200 buckets of 3 frames, and the grain
  period is 600.

## Verification (run before delivery)

| Check | Result |
|---|---|
| 1 · File checks (`scripts/check-files.sh`) | **Pass** for all 5: h264, 1280×720, 30/1, yuv420p, no audio stream, 15.000 / 20.000 / 10.000 s. (First run failed: Remotion adds a silent AAC track by default, which also made durations 15.06 s. The previews were remuxed with the video stream copied bit-for-bit and no audio, and the script now renders with `--muted`.) |
| 2 · Loop (601-frame override, frames 0 vs 600) | **Pass**: identical pixels and identical PNG bytes. |
| 3 · Determinism (middle frame from a cold start vs the same frame of a full multi-threaded render, `scripts/determinism.sh`) | **Pass** for all 5 (frames 225 / 225 / 300 / 150 / 150): PNG files identical byte for byte. |
| 4 · Banding (`scripts/banding.py`, frames decoded **from the encoded mp4**) | **Pass**: no hard band edges (two flat runs of ≥12 px meeting at a clean step) in any of 15 strips through the blurred backgrounds, dark spaces and bokeh. Gradients step one level at a time with interleaving (e.g. 20 20 21 20 21 21 22 21 …). One 16-px flat run in the particle chip is at luma 8 (near black), where x264 flattens grain; values on both sides interleave 7/8/9. |
| 5 · Content (contact sheets, `scripts/contact-sheet.sh`) | **Pass**: the HUD builds on a tilted plane with the AI ring, blurred violet/teal background and DoF band. The particle chip shows the AI centre, data rain and bokeh. The reveal scrambles, locks on "AI", and the callouts (CHATBOT, COMMAND PROMPT, DATA, MODEL) draw out. "AI" is in capitals everywhere; there are no logos. |
| 6 · Motion | **Pass**: HUD line and text regions change by ≈1 level per frame on the hold (no shimmer or moiré, mipmaps + 8× anisotropy). Twinkle shows no spikes at bucket boundaries (mean frame-to-frame change 3.9 at boundaries vs 4.4 within buckets, mostly grain). The scramble changes every 2 frames. |

### Completion checklist

- [x] 5 compositions at 3840×2160 / 30 fps, one data row each
- [x] three.js on WebGL2 via `@remotion/three`; `--gl=angle`
- [x] OFL fonts only (Orbitron 600 / JetBrains Mono / Rajdhani), licences included
- [x] No `Math.random()`, `Date.now()`, R3F clock or visual `useState`; seeded `mulberry32` + integer hashes
- [x] Half-float targets, ±1/255 dither, ≈1.5 % frame-indexed grain
- [x] 720p previews and stills; 4K render commands and still command above
- [x] Render times measured; two real 4K frames timed

## Fonts (SIL Open Font License 1.1)

* **Orbitron** (variable, used at weight 600) — the "AI" letters — `public/fonts/OFL-Orbitron.txt`
* **JetBrains Mono** (variable) — HUD text — `public/fonts/OFL-JetBrainsMono.txt`
* **Rajdhani** SemiBold/Bold — HUD headings — `public/fonts/OFL-Rajdhani.txt`

There are no logos, brands or maker's marks. All HUD text is made up.
