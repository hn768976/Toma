# Digital Data Reveal — Tech Acronyms (Remotion)

A storm of glowing digital particles (binary digits and symbols) streams
through a dark blue field, converges into a glowing wireframe word, bursts into
light-speed streaks and settles as clean white text.

- 9 compositions, one per acronym, identical style
- 3840×2160, 30 fps, **600 frames (20 s)**
- **These do NOT loop.** Each one is a one-way reveal that ends in a long hold
  (frames 340–599). Don't keyword or sell them as loops. The hold is there so
  buyers can trim it to fit.

| Composition id | Word |
|---|---|
| `Reveal-CRM` | CRM |
| `Reveal-AI` | AI |
| `Reveal-SEO` | SEO |
| `Reveal-API` | API |
| `Reveal-ERP` | ERP |
| `Reveal-SaaS` | SaaS |
| `Reveal-IoT` | IoT |
| `Reveal-LLM` | LLM |
| `Reveal-GPU` | GPU |

> Remotion composition ids may only contain `a-z A-Z 0-9 -`, so the ids use a
> hyphen (`Reveal-CRM`). Output files use the underscore names
> (`Reveal_CRM.mp4`).

## Setup

```bash
npm install
npx remotion studio        # preview in the browser
```

Node 18+ is required (tested with Node 22). All dependency versions are pinned
in `package.json`.

## Chromium GL flag

The particle layer is WebGL2 (`@remotion/three`). Headless Chromium needs ANGLE:

```
--gl=angle
```

This is already set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`),
so the CLI commands below pick it up automatically. Add `--gl=angle` yourself
only when rendering through the Node API or with a different config.

## Render at 4K (one command per acronym)

`remotion.config.ts` sets h264, `yuv420p`, CRF 16, PNG intermediate frames and
no audio.

```bash
npx remotion render Reveal-CRM  out/Reveal_CRM_4K.mp4  --gl=angle
npx remotion render Reveal-AI   out/Reveal_AI_4K.mp4   --gl=angle
npx remotion render Reveal-SEO  out/Reveal_SEO_4K.mp4  --gl=angle
npx remotion render Reveal-API  out/Reveal_API_4K.mp4  --gl=angle
npx remotion render Reveal-ERP  out/Reveal_ERP_4K.mp4  --gl=angle
npx remotion render Reveal-SaaS out/Reveal_SaaS_4K.mp4 --gl=angle
npx remotion render Reveal-IoT  out/Reveal_IoT_4K.mp4  --gl=angle
npx remotion render Reveal-LLM  out/Reveal_LLM_4K.mp4  --gl=angle
npx remotion render Reveal-GPU  out/Reveal_GPU_4K.mp4  --gl=angle
```

1080p preview (what was delivered for CRM and SaaS):

```bash
npx remotion render Reveal-CRM out/Reveal_CRM.mp4 --scale=0.5
```

## Stills

6000×3375 stills (composition is 3840×2160, so the scale is 6000/3840 = 1.5625):

```bash
# main still: clean white word
npx remotion still Reveal-CRM out/Reveal_CRM_f450_6000.png --frame=450 --scale=1.5625 --image-format=png
# glowing outline with sparks and circuit lines
npx remotion still Reveal-CRM out/Reveal_CRM_f235_6000.png --frame=235 --scale=1.5625 --image-format=png
```

Swap `Reveal-CRM` for any composition id. To render many stills in one go
(it bundles once and reuses one browser), use the batch script:

```bash
# every Reveal-* composition, frames 235 and 450, at 6000x3375
node scripts/stills.mjs --scale=1.5625 --frames=235,450 --out=out/stills-6000
# 1080p check stills for selected words
node scripts/stills.mjs --scale=0.5 --frames=180,235,450 --out=out/stills CRM SaaS
```

## Timeline (frames @ 30 fps)

| Frames | Phase |
|---|---|
| 0–45 | Dark blue field, faint drifting data lines |
| 45–150 | Particle storm: thousands of glyphs stream from deep in the scene past the camera, with motion streaks and ~5% orange |
| 150–210 | Converge: particles curve in and gather into the word; orange sparks fly off |
| 210–260 | Outline: neon outline flickers in, particles fade, circuit traces draw out from the letters |
| 260–300 | Burst: 84 light-speed streaks and a brief flash |
| 300–340 | Settle: streaks fade, white fill comes in, outline fades into it |
| 340–599 | Hold: clean white word, soft breathing halo, slow drifting lines |

## How to add an acronym

Add **one row** to `src/acronyms.ts`:

```ts
export const ACRONYMS = [
  "CRM",
  // ...
  "GPU",
  "IoT",
  "VPN", // <- new composition "Reveal-VPN"
];
```

Nothing else changes. The composition, particle targets, outline, circuit
traces and streak origin all come from the word. Letter height is fixed (cap
height = 12% of frame height), so short words come out narrow and long words
come out wide. Words are not scaled to fit a fixed width. At this size a
capital is about 6% of frame width (SaaS is 24%), so words of up to roughly
12 characters fit inside the frame with margin.

## Architecture

Three layers stacked in one composition (`src/Reveal.tsx`):

1. **Background (2D, SVG):** steel-blue radial gradient, faint dashed data lines
   at several depths, a static seeded dither tile, and a vignette.
2. **Particles (3D, `@remotion/three`, WebGL2):** **one instanced mesh** of
   camera-facing quads that sample a glyph texture atlas (`0 1 + # = / x -`,
   dash, dot). The atlas is drawn once after the font loads, with a sharp
   version and a pre-blurred version. Near particles use the blurred version
   and get larger; far ones stay small and sharp. Quads stretch along their
   own velocity for motion streaks. ACES Filmic tonemapping, sRGB output,
   ±1/255 shader dither.
3. **Word, circuits, streaks (2D, SVG on top):** the word is real SVG text, so
   it stays vector-sharp at any resolution. The glow is a stacked filter: three
   blurs at 1 : 4 : 12, each fainter, merged under the crisp `SourceGraphic`.
   Film grain on top comes from `feTurbulence` with a frame-derived seed.

### Particle → letter assembly (no physics)

- After the font loads (`delayRender`/`continueRender`), `src/sampling.ts`
  draws the word into a hidden canvas once and samples **6,000 target points**
  across the letters. Half come from a 2 px edge band and half from the
  interior, so edges are denser.
- Every particle's start point, swirl control point, landing curve, arrival
  frame (150–210), glyph, size, colour, spark path and fade time come from a
  module-level seeded `mulberry32` (`src/particles.ts`).
- The vertex shader computes each particle's position as a closed-form cubic
  Bézier of `uFrame`, plus a swirl that decays to zero on arrival. Nothing is
  simulated and nothing carries over between frames.

### Determinism

- No `Math.random()`, `Date.now()`, `useFrame`, CSS animations or transitions.
  Every visual is a function of `useCurrentFrame()`.
- All random data comes from seeded `mulberry32` at module level: particles,
  streaks, background lines, dither tile, circuit traces (seeded per word).
- Font loading and word sampling are wrapped in `delayRender` /
  `continueRender`, so no frame is ever captured with a fallback font.
- `bash scripts/determinism.sh Reveal-CRM` renders a full PNG sequence
  (4 threads, out of order), then frame 180 alone from a cold start, and
  compares the two byte for byte.

## Banding check

```bash
npx remotion render Reveal-CRM out/Reveal_CRM.mp4 --scale=0.5
python3 scripts/banding.py out/Reveal_CRM.mp4 450     # needs numpy + pillow
```

This extracts frame 450 **from the encoded mp4** and reads pixel values on
single rows from the frame centre out to the edge. Banding shows up as long
runs of one identical value followed by a jump. A dithered gradient changes
every pixel or two. The script was checked against a deliberately banded
control gradient encoded with the same settings. The control fails (mean run
35 px, max 191 px), so the check really does catch banding.

Results for the delivered previews are under "Measured results" below.

## Measured results

Measured in a 4 vCPU, CPU-only Linux container. WebGL ran through ANGLE on
SwiftShader with no GPU, so a workstation with a GPU will be faster.

| What | Measured |
|---|---|
| Particle count | **6,000** (one instanced mesh; `PARTICLE_COUNT` in `src/config.ts`) |
| 1080p full render (`--scale=0.5`, 600 frames, 4 threads) | **200–209 s**, about **0.34 s per frame** of wall-clock time (≈1.4 s per frame per render thread) |
| 4K, frames 120–239 (storm and outline, heaviest) | 253 s per 120 frames, about **2.1 s per frame** |
| 4K, frames 400–519 (hold) | 153 s per 120 frames, about **1.3 s per frame** |
| **4K estimate, full 600 frames** | **≈ 16 min per acronym** on the same 4 vCPU machine (≈ 2.5 h for all 9) |
| 6000×3375 still | 8–9 s (frame 450), 14–15 s (frame 235) |
| 1080p preview file size | ≈ 175 MB each (CRF 16 keeps the grain, which costs bitrate) |

Banding check (frame 450 from the encoded 1080p mp4):

| File | Mean run of identical values | 99th pct | Max | Result |
|---|---|---|---|---|
| `Reveal_CRM.mp4` | 1.15 px | 3 px | 6 px | PASS |
| `Reveal_SaaS.mp4` | 1.13 px | 3 px | 6 px | PASS |
| control: banded gradient, no dither | 35 px | 170 px | 191 px | FAIL (as expected) |

Film grain measures **1.73%** of full scale (standard deviation) on the
mid-tone gradient at frame 450 (`GRAIN_OPACITY` in `src/Grain.tsx`).

Determinism: frame 180 from a cold `npx remotion still` and frame 180 from a
full 4-thread PNG-sequence render are **byte-identical** (same SHA-256).

## Font licence

**Montserrat** ExtraBold (800), © 2011 The Montserrat Project Authors
(https://github.com/JulietaUla/Montserrat), licensed under the **SIL Open Font
License 1.1**. The full licence is in `public/fonts/OFL.txt`.

The shipped `public/fonts/Montserrat-ExtraBold.woff2` is the static Google
Fonts ExtraBold instance (v9.000) with **overlapping contours merged**
(`fontTools.ttLib.removeOverlaps`), converted to WOFF2. Without that step the
stroked outline phase drew internal seams inside letters such as R and G. This
counts as a Modified Version under the OFL. Montserrat declares no Reserved
Font Name, and the font is redistributed under the same OFL.

## Completion checklist

- [x] 9 compositions from one template, one data row each (`src/acronyms.ts`)
- [x] 3840×2160, 30 fps, 600 frames; **not a loop** (one-way reveal plus a 260-frame hold)
- [x] 3D particle storm in `@remotion/three` (WebGL2, one instanced mesh, ACES Filmic, sRGB, shader dither)
- [x] 2D SVG outline, fill, circuit traces and streaks on top; stacked 1 : 4 : 12 glow with crisp edges
- [x] Montserrat ExtraBold shipped in `public/fonts`; cap height 12% of frame height for every word; mixed case kept (SaaS, IoT)
- [x] Word centred on its ink bounding box (within 1 px at 1080p for all 9)
- [x] Particle targets sampled once per word, after the font loads (`delayRender`)
- [x] No `Math.random`, `Date.now`, `useFrame`, CSS keyframes or transitions; everything is a function of the frame
- [x] Cold frame 180 byte-identical to the full-render frame 180
- [x] Film grain 1.5–2% from `feTurbulence` with a frame-derived seed; static seeded dither tile on the background
- [x] Banding checked on the **encoded** mp4 (frame 450): PASS
- [x] 1080p previews: `Reveal_CRM.mp4`, `Reveal_SaaS.mp4` (h264, yuv420p, 30/1, 20.0 s, no audio)
- [x] 27 stills at 1080p (frames 180, 235 and 450 for all 9)
- [x] 18 stills at 6000×3375 (frames 235 and 450 for all 9)
- [x] `npm install && npx remotion studio` works from a clean copy of the zip
- [ ] 4K renders: left to you, using the commands above
