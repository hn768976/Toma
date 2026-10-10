# Neon Frame · Spotlight Dust · Glitter Floor (Remotion, 30 fps, 20 s seamless loops)

Five looped motion backgrounds from three references, in one Remotion project.
Everything is code: no media files, no text, no logos, no MCP servers.

| Composition id | Look | 2D/3D | Engine |
|---|---|---|---|
| `NeonFrame-Spectrum` | Neon Frame | 2D | full-screen fragment shader on a three.js plane (`@remotion/three`, WebGL2) |
| `SpotlightDust-TealCrimson` | Spotlight Dust (as reference) | 2D | PixiJS 8, 25,000 particles in one `ParticleContainer` (WebGL2) |
| `SpotlightDust-BlueViolet` | Spotlight Dust, awards colourway | 2D | PixiJS 8 |
| `GlitterFloor-Gold` | Glitter Floor (as reference) | 3D | three.js `Points`, 600,000 grains + 8,000 floaters, DoF in the point shader |
| `GlitterFloor-ChampagneSilver` | Glitter Floor, silver | 3D | three.js `Points` |

All compositions are defined at **3840x2160, 30 fps, 600 frames**. Frame 600 equals frame 0.

## Install and preview

```bash
npm install
npx remotion studio          # opens the Studio (canvases render at 0.5x there for speed)
```

## Chromium GL flag (required)

All five use WebGL2. Headless Chromium needs ANGLE:

```bash
--gl=angle        # machines with a GPU (and CPU-only machines: ANGLE falls back to SwiftShader)
```

`remotion.config.ts` also sets `Config.setChromiumOpenGlRenderer("angle")`, so the flag is optional on the
CLI but harmless. WebGPU is not used. Software rendering works (that is how every number below was measured).

## 4K renders (3840x2160, H.264, yuv420p, CRF 16)

```bash
npx remotion render NeonFrame-Spectrum              out/NeonFrame_Spectrum_4K.mp4              --gl=angle
npx remotion render SpotlightDust-TealCrimson       out/SpotlightDust_TealCrimson_4K.mp4       --gl=angle
npx remotion render SpotlightDust-BlueViolet        out/SpotlightDust_BlueViolet_4K.mp4        --gl=angle
npx remotion render GlitterFloor-Gold               out/GlitterFloor_Gold_4K.mp4               --gl=angle
npx remotion render GlitterFloor-ChampagneSilver    out/GlitterFloor_ChampagneSilver_4K.mp4    --gl=angle
```
(`--codec=h264 --pixel-format=yuv420p --crf=16` are already the defaults in `remotion.config.ts`.)
Add `--concurrency=N` to taste; on a CPU-only box 2-4 is about right.

## 6000x3375 stills (not rendered here)

Pick any frame; the composition is 3840x2160, so scale 6000/3840 = 1.5625:

```bash
npx remotion still GlitterFloor-Gold out/GlitterFloor_Gold_6K.png --frame=300 --scale=1.5625 --gl=angle
```
Same for the other ids (`NeonFrame-Spectrum`, `SpotlightDust-TealCrimson`, ...).

## 720p previews (optional; only the stills are supplied)

`--scale=0.3333333333333333` gives exactly 1280x720 (verified with ffprobe). Canvases use
`window.devicePixelRatio` as their backing-store ratio, so a 1/3 scale really does 1/9 of the GPU work.
`tools/render-preview.sh <id> <out.mp4>` renders a PNG sequence through Remotion (several tabs, frames out of
order) and encodes with ffmpeg (`libx264 -preset slow -crf 16 -pix_fmt yuv420p`, no audio).

## Measured render times

Machine: 4-core CPU-only container, Chromium headless shell, WebGL2 through ANGLE/SwiftShader (software). No GPU.
Times are Remotion's own per-frame figures (browser frame + screenshot + PNG encode), frames 300+, steady state.
`tools/time.mjs <id> <scale> <frames>` reproduces them.

| Composition | 720p / frame (1 tab) | 720p / frame (full 600-frame render, 4 tabs) | **4K / frame (1 tab)** | 4K vs 720p | **4K full render, estimate** |
|---|---|---|---|---|---|
| `NeonFrame-Spectrum` | 0.22 s | 0.12 s | 1.42 s | 6.5x | ~8 min |
| `SpotlightDust-TealCrimson` | 1.00 s | 0.90 s | 1.75 s | 1.7x | ~16 min |
| `SpotlightDust-BlueViolet` | 0.98 s | 0.91 s | 2.03 s | 2.1x | ~19 min |
| `GlitterFloor-Gold` | 0.38 s | 0.27 s | 1.88 s | 5.0x | ~14 min |
| `GlitterFloor-ChampagneSilver` | 0.36 s | 0.31 s | 1.89 s | 5.2x | ~16 min |

* **Two real 4K frames timed (3840x2160 canvases, verified):** `GlitterFloor-Gold` (3A, 600,000 points + shader DoF)
  **1.88 s/frame** (first frame in a fresh tab 3.6 s;
  a cold `remotion still` takes about 9 s end to end) and `SpotlightDust-TealCrimson` (2A, 25,000 sprites)
  **1.75 s/frame** (cold `remotion still` about 7 s). The other three were timed at 4K too (table).
* The 4K full-render figure is an **estimate**: 600 x the measured single-tab 4K frame time, divided by the parallel speed-up
  seen at 720p on this box (SwiftShader already uses all cores, so extra tabs help little: about 1.1x to 1.8x). It excludes the
  final H.264 encode of 4K frames (a few minutes). On a machine with a real GPU these should be several times faster. Not measured end to end.
* Spotlight Dust is the slowest per frame at 720p because 25,000 particles are updated in JavaScript and uploaded every frame;
  its cost grows far less with resolution than the glitter's does.


## Determinism (non-negotiable)

Every value on screen is a function of `useCurrentFrame() % 600` and nothing else: no `Math.random()` at render
time (module-level `mulberry32`), no `useFrame` clock, no `Date.now()`, no state carried between frames, no TAA.
`tools/loop-and-determinism.sh` checks it. One trap worth knowing about: **R3F clones the `uniforms` object you give
`<shaderMaterial>`**, so mutating your own object after mount silently freezes the animation in full renders
(stills look fine). The Neon Frame writes uniforms through the material ref inside `useFrame`; the glitter pipeline
builds its `ShaderMaterial`s by hand, which does not clone.

## How each look is built

- **Neon Frame** (`src/looks/NeonFrame.tsx`): rounded-rectangle signed distance (`softplus`-smoothed so there is
  no outline or crease), glow = exponential core + two Gaussians, perimeter angle drives two colour ramps that
  turn whole numbers of times per loop (2 forward, 1 backward) and a brightness field made from sinusoids with
  integer spatial and temporal frequencies (periodic by construction). Soft tone-map and pale-lilac haze at the
  strongest spots and at the frame edge. Dither + grain last.
- **Spotlight Dust** (`src/looks/SpotlightDust.tsx`): PixiJS 8. Three pre-rendered additive beam wedges that
  breathe by whole cycles; 25,000 `Particle`s from a procedurally drawn 4-cell atlas (fine dot, soft dot, bokeh disc,
  four-point glint). Each particle sits at a seeded position inside a beam (or strays), drifts on a closed
  Lissajous loop, twinkles on its own whole-cycle phase, and is coloured by height. A last full-screen Pixi
  filter adds dither + grain.
- **Glitter Floor** (`src/looks/GlitterFloor.tsx`): backdrop gradient shader + 600,000 `Points` on a 30 m x 40 m
  floor + 8,000 floaters, into a half-float target; point shader does depth-of-field (size and softness from
  distance to the 1.5 m focus), whole-cycle twinkle (8 % duty), four-point glints; bloom (two blur levels),
  shoulder tone-map, side vignette, dither + grain. Camera at 0.15 m, pitched up 5 degrees so the floor's far end sits
  62 % down the frame, with a whole-cycle sway.

## Adding a colourway

1. Add a row to `NEON_FRAME`, `SPOTLIGHT` or `GLITTER` in `src/colorways.ts` (the type tells you every field).
2. That is all: `src/Root.tsx` registers one `<Composition>` per row, with id `<Look>-<row.id>`.
3. Render it: `npx remotion render GlitterFloor-RoseGold out/x.mp4 --gl=angle`.

## Banding check (done on the encoded mp4, not the preview)

`tools/banding.py <mp4> <frame> <label> x0 y0 x1 y1 [strip]` decodes one frame of the **encoded mp4**, takes a trimmed mean
across a strip (so sparkles and particles are ignored) and reports step sizes along a line. On frame 300 of the final previews:

| Where | Result |
|---|---|
| 3A gold backdrop (vertical x=640, and horizontal y=60) | luma 188.9 -> 136.6 / smooth arch; max step 1.09 and 1.30 codes/px, 0-0.01 of steps >0.9: smooth |
| 3B champagne backdrop (vertical, horizontal) | 228.0 -> 143.1; max step 1.53 and 1.14 codes/px: smooth |
| Neon Frame glow falloff (left, bottom and top edges inward) | 142 -> 5, 6 -> 140, 133 -> 8 over 130-160 px; max step ~3 codes/px (a real slope, not plateaus; flat fraction 0.12-0.24): smooth |
| 2A / 2B beam edge (across a beam at y=120) | 8 -> 94; the big steps (6-9 codes) are single dust specks; p95 step ~3 codes/px: smooth |
| 2A / 2B dark stage background (vertical x=100) | 4-7 codes with noise, no steps (max 0.87-1.40): smooth |

No contour steps were found, so grain was left at the specified 1.5 % (Neon, Spotlight) and 2 % (Glitter); it was not raised.
The detector flags `POSSIBLE BANDING` when a ramp is mostly flat (<0.12 code/px) with sparse >0.9 jumps; nothing triggered it.


## Completion checklist

- [x] 5 compositions, 3840x2160, 30 fps, 600 frames; one data row per version (`src/colorways.ts`)
- [x] 720p previews: exactly 1280x720, h264, yuv420p, 30/1, 20.000 s, no audio stream (ffprobe)
- [x] Loop: frame 600 == frame 0 byte-identical for all 5 (temporary 601-frame build, `REMOTION_LOOP_CHECK=1`)
- [x] Determinism: frame 300 rendered alone from a cold start == frame 300 of the full multi-tab render, byte-identical, all 5
- [x] 600 distinct frames in each full render (guards against a frozen canvas, see "Determinism")
- [x] Banding checked on the encoded mp4 (table above)
- [x] Contact sheets reviewed: Neon colours and bright stretches move around the frame; beams + dust + colour-by-height; glitter
      thinning into haze, sparkles in different places; 3B has no gold backdrop or gold glitter body; no text or logos
- [x] Motion: frame-to-frame statistics, loop seam equals a normal step, no pops or strobing; consecutive-frame crops reviewed
- [x] Reference comparison: own side-by-side per version A, plus three blind sub-agent rounds per look (3 looks x 3 rounds)
- [ ] 4K videos and 6000x3375 stills were deliberately not rendered here (commands above)

