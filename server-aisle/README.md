# Server Aisle · Frame Tunnel · Stream Corridor · Screen Corridor · Stage Beams

Five looks, eight compositions, one Remotion project. Every look is built in code
with three.js on WebGL2 through `@remotion/three` (Stage Beams is a single
full-screen fragment shader on a three.js plane). All compositions are defined at
**3840×2160, 30 fps**.

| # | Composition ID | Output name | Look | Length |
|---|----------------|-------------|------|--------|
| 1 | `ServerAisle-Steel` | `ServerAisle_Steel` | sideways track along a rack row, shallow DoF | 600 f (20 s loop) |
| 2 | `FrameTunnel-WhiteBurst` | `FrameTunnel_WhiteBurst` | neon frames switch on, white-out | 180 f (6 s **transition**) |
| 3 | `FrameTunnel-CyanMagenta` | `FrameTunnel_CyanMagenta` | the same tunnel as a glide | 600 f (20 s loop) |
| 4 | `StreamCorridor-Blue` | `StreamCorridor_Blue` | glass cabinets, white edge-light, blue ribbons | 600 f (20 s loop) |
| 5 | `ScreenCorridor-GreenBlue` | `ScreenCorridor_GreenBlue` | aisle of racks covered in screens | 600 f (20 s loop) |
| 6 | `ScreenCorridor-AmberTeal` | `ScreenCorridor_AmberTeal` | same, warm night-shift palette | 600 f (20 s loop) |
| 7 | `StageBeams-Steel` | `StageBeams_Steel` | two hazy stage spots, smoke, floor pool | 600 f (20 s loop) |
| 8 | `StageBeams-Amber` | `StageBeams_Amber` | same, warm gold | 600 f (20 s loop) |

Remotion only allows `a-z A-Z 0-9 -` in composition IDs, so the IDs use a hyphen
and the rendered files use the underscore names from the brief.

> **Frame Tunnel White Burst is a transition.** It ends on pure white
> (`#FFFFFF`, 255/255/255) from frame 168 to the last frame (179), with grain and
> dither switched off for those frames, so editors can cut on the white.

## Setup

```bash
npm install
npx remotion studio          # preview (the Studio draws the WebGL canvas at half size)
```

Node 18+; versions are pinned in `package.json` / `package-lock.json`.

### Chromium GL flag

Always render with ANGLE: `--gl=angle` (already set in `remotion.config.ts`
via `Config.setChromiumOpenGlRenderer("angle")`). On a machine with a GPU this
uses it; in a headless sandbox it falls back to SwiftShader (slow but
identical-looking). Do not use WebGPU.

## 4K renders

```bash
npx remotion render ServerAisle-Steel        out/ServerAisle_Steel.mp4        --gl=angle
npx remotion render FrameTunnel-WhiteBurst   out/FrameTunnel_WhiteBurst.mp4   --gl=angle
npx remotion render FrameTunnel-CyanMagenta  out/FrameTunnel_CyanMagenta.mp4  --gl=angle
npx remotion render StreamCorridor-Blue      out/StreamCorridor_Blue.mp4      --gl=angle
npx remotion render ScreenCorridor-GreenBlue out/ScreenCorridor_GreenBlue.mp4 --gl=angle
npx remotion render ScreenCorridor-AmberTeal out/ScreenCorridor_AmberTeal.mp4 --gl=angle
npx remotion render StageBeams-Steel         out/StageBeams_Steel.mp4         --gl=angle
npx remotion render StageBeams-Amber         out/StageBeams_Amber.mp4         --gl=angle
```

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, PNG intermediate
frames and a 120 s per-frame timeout. On a GPU box add `--concurrency=<n>`; on a
CPU-only box keep `--concurrency=1` (SwiftShader already uses every core, so
extra tabs only add overhead).

### 6K stills (6000×3375)

```bash
npx remotion still ServerAisle-Steel out/ServerAisle_Steel_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(Any composition ID works; `--scale=1.5625` turns 3840×2160 into 6000×3375. The
WebGL canvas is drawn at the device pixel ratio, so the still is rendered
natively at 6K, not upscaled.)

### 720p previews

`scripts/render-all.sh` renders all eight at `--scale=0.3333333333333333`
(exactly 1280×720) as PNG sequences into `out/seq/<Name>/`, then encodes
`out/previews/<Name>.mp4` (H.264, `yuv420p`, CRF 16, 30 fps, no audio) and copies
the middle frame to `out/previews/<Name>.png`. Keeping the PNG frames lets
`scripts/verify.py` compare frames byte for byte.

## How it is built

```
src/
  Root.tsx            one <Composition> per data row
  variants.ts         THE data rows (one per version)
  lib/
    GLStage.tsx       ThreeCanvas wrapper: builds a look once, draws frame N in a layout effect
    post.ts           postprocessing chain: (DoF) -> bloom -> grade/vignette/grain/white/dither
    reflection.ts     planar mirror for floors (half-float, mipmapped blur, contact shadows)
    ledMaterial.ts    MeshStandardMaterial with a 3-group blink mask on the emissive map
    canvasTex.ts      Canvas 2D textures: mipmapped, max anisotropy
    bluenoise.ts      64×64 void-and-cluster blue noise, generated from a fixed seed
    fonts.ts          JetBrains Mono (OFL) loader for canvas text
    random.ts         mulberry32, integer hash, LED blink/breathe on periods dividing 600
  looks/
    serverAisle.ts  frameTunnel.ts  streamCorridor.ts  screenCorridor.ts  stageBeams.ts
public/fonts/         JetBrainsMono-Medium.woff2 + OFL.txt
scripts/              render-preview.sh, render-all.sh, verify.py
```

* **Instancing.** Racks, bezels, glass, handles, faceplates, cabinets, edge-lights,
  slats, frames, screens and ribbons are `InstancedMesh`es.
* **Procedural textures.** Rack faceplates (7 bay types), cabinet LED faces (4
  types), rack faces and the 24-cell screen atlas are drawn once in Canvas 2D,
  with separate emissive and blink-mask canvases. No logos, brand names or
  vendor marks; screen text is made-up digits in JetBrains Mono.
* **Lighting.** `RoomEnvironment` PMREM for reflections plus `RectAreaLight`s
  (Server Aisle key/fill/aisle strip, Screen Corridor ceiling tubes). The Frame
  Tunnel slats use a cheap analytic falloff from the nearest 15 frames.
* **Post.** `postprocessing` `EffectComposer` with **half-float** buffers and
  4× MSAA; bokeh DoF (Server Aisle), mip-chain bloom, then a final pass that
  tone-maps (ACES fit; off for Screen Corridor and Stage Beams), grades in
  display space, vignettes, adds grain, mixes to white (White Burst) and adds a
  ±1/255 **blue-noise dither** in sRGB space.

### Determinism

Every value on screen is a function of `useCurrentFrame()` only.

* No `Math.random()` at render time: all layouts (bay types, LED groups, screen
  layouts, ribbon curves, cabinet dots, blue noise) come from `mulberry32`
  seeded at module level.
* No `useFrame` clock, `Date.now()` or state driving visuals. A priority-1
  `useFrame(() => undefined, 1)` only stops R3F from drawing its own empty
  scene; the look is drawn synchronously in a layout effect from the frame
  number.
* No TAA, no accumulative shadows; flicker in the White Burst comes from an
  integer hash of the frame bucket.
* Canvas textures and the font are built once behind `delayRender`.

### Loops

Every moving term is periodic with a period that divides 600 frames, and each
look evaluates it from `frame mod period`:

* Server Aisle trucks exactly **7 bays** per loop; the row repeats every 7 bays,
  ceiling panels every 7 bays, LEDs blink on periods 50–200 frames.
* Frame Tunnel Cyan-Magenta glides exactly **6 frame spacings**; colours
  alternate every frame (period 2), the brightness wave has period 300 frames
  and a wavelength of 3 spacings, slat variation repeats every 4 slats (= 6 spacings).
* Stream Corridor glides exactly **4 cabinet spacings** (2.8 m); ribbon curves
  repeat every 2.8 m or 1.4 m, dashes advance a whole number of cycles, sway and
  roll are whole sine cycles.
* Screen Corridor pushes exactly **5 bays**; bay layouts repeat every 5 bays;
  screen animations use periods dividing 600.
* Stage Beams: the fbm noise lattice wraps in y and z, so sampling at
  `(x, y − t, t)` walks a closed loop through noise space (time on a circle): the
  smoke drifts up and evolves and is back where it started at frame 600. Beam
  sway uses periods 600 and 300.
* Grain and dither use `frame mod 600` as their seed, so they loop too.

A composition prop `loopCheck: true` makes a loop 601 frames long so frame 600
can be rendered and compared with frame 0:

```bash
npx remotion still ServerAisle-Steel a.png --frame=0   --scale=0.3333333333333333 --props='{"loopCheck":true}'
npx remotion still ServerAisle-Steel b.png --frame=600 --scale=0.3333333333333333 --props='{"loopCheck":true}'
```

Because each term is evaluated from `frame mod period`, frame 600 is identical
to frame 0 by construction. The meaningful test is the **seam**: the step from
frame 599 to frame 0 must look like any other step. `scripts/verify.py`
measures both.

## Add a colourway (one data row)

Copy a row in `src/variants.ts`, give it a new `id`, and change the colours:

```ts
{
  id: "ScreenCorridor-RedWhite",
  look: "screenCorridor",
  durationInFrames: 600,
  loop: 600,
  params: {
    bars: "#FF4A3A", panels: "#E8E8F0", icons: "#3AC8FF", floor: "#807878",
    grade: { exposure: 1.0, contrast: 1.08, saturation: 1.1, vignette: 0.35, grain: 0.015, toneMap: false },
  },
},
```

`Root.tsx` registers every row automatically. Stage Beams rows take `beam`,
`fringe`, `pool`, `background`; Frame Tunnel rows take `mode`, `colorA`,
`colorB`, `slat`; Stream Corridor takes `ribbon`, `edge`; Server Aisle takes
`ledA`, `ledB`.

## Measured results (this build, CPU-only container)

All numbers come from a 4-core cloud container **with no GPU**: Chromium's ANGLE
fell back to SwiftShader (software WebGL2). SwiftShader already uses every core,
so `--concurrency=1` was fastest. Expect these to be one to two orders of
magnitude faster on any machine with a real GPU.

### Render time per frame at 720p, and 4K estimates

| Output | Frames | 720p wall time | per 720p frame | per 4K frame (est.) | 4K full render (est., CPU) |
|---|---|---|---|---|---|
| `ServerAisle_Steel` | 600 | 22.6 min | 2.26 s | ~30 s | ~5.0 h |
| `FrameTunnel_WhiteBurst` | 180 | 4.8 min | 1.59 s | ~22 s | ~1.1 h |
| `FrameTunnel_CyanMagenta` | 600 | 13.3 min | 1.33 s | ~19 s | ~3.1 h |
| `StreamCorridor_Blue` | 600 | 11.6 min | 1.16 s | ~16 s | ~2.7 h |
| `ScreenCorridor_GreenBlue` | 600 | 9.7 min | 0.97 s | ~14 s | ~2.4 h |
| `ScreenCorridor_AmberTeal` | 600 | 9.6 min | 0.96 s | ~14 s | ~2.4 h |
| `StageBeams_Steel` | 600 | 10.1 min | 1.01 s | ~14 s | ~2.4 h |
| `StageBeams_Amber` | 600 | 9.9 min | 0.99 s | ~14 s | ~2.3 h |

**Two real 4K frames were timed** (frame 300, `npx remotion still --scale=1`,
3840×2160, minus the browser/bundle start-up measured on a 720p still of the same
composition):

* `ServerAisle-Steel`: **≈ 29.8 s** per 4K frame (43.8 s wall incl. ≈ 13.9 s start-up) — 13.2× its 720p frame.
* `ScreenCorridor-GreenBlue`: **≈ 14.4 s** per 4K frame (25.0 s wall incl. ≈ 10.6 s start-up) — 14.9× its 720p frame.

The other 4K estimates use ×14 of the measured 720p frame time (9× the pixels
plus MSAA, mip-chain bloom and full-size reflection targets). Budget roughly
**20 h of CPU time for all eight at 4K** in a software-GL environment, or render
on a GPU machine.

### Verify loop (scripts/verify.py)

| Output | 1 · file (1280×720, h264, yuv420p, 30/1, no audio) | 2 · loop 0 vs 600 | 3 · cold vs full render | 4 · banding / white | 6 · motion evenness |
|---|---|---|---|---|---|
| `ServerAisle_Steel` | pass (20.0 s) | pass (max diff 0; seam ratio 0.997) | pass (md5 equal, max diff 0) | pass (flat blocks 0.069 %) | max/median step 1.023 |
| `FrameTunnel_WhiteBurst` | pass (6.0 s) | n/a (transition) | pass (md5 equal, max diff 0) | pass (flat blocks 0.0 %; white min 255) | max/median step 4.723 |
| `FrameTunnel_CyanMagenta` | pass (20.0 s) | pass (max diff 0; seam ratio 0.867) | pass (md5 equal, max diff 0) | pass (flat blocks 0.085 %) | max/median step 1.062 |
| `StreamCorridor_Blue` | pass (20.0 s) | pass (max diff 0; seam ratio 1.115) | pass (md5 equal, max diff 0) | pass (flat blocks 0.0 %) | max/median step 1.121 |
| `ScreenCorridor_GreenBlue` | pass (20.0 s) | pass (max diff 0; seam ratio 0.988) | pass (md5 equal, max diff 0) | pass (flat blocks 0.0 %) | max/median step 1.017 |
| `ScreenCorridor_AmberTeal` | pass (20.0 s) | pass (max diff 0; seam ratio 0.973) | pass (md5 equal, max diff 0) | pass (flat blocks 0.0 %) | max/median step 1.023 |
| `StageBeams_Steel` | pass (20.0 s) | pass (max diff 0; seam ratio 0.921) | pass (md5 equal, max diff 0) | pass (flat blocks 0.194 %) | max/median step 1.012 |
| `StageBeams_Amber` | pass (20.0 s) | pass (max diff 0; seam ratio 0.931) | pass (md5 equal, max diff 0) | pass (flat blocks 0.092 %) | max/median step 1.012 |

* **Step 2.** Frame 600 equals frame 0 exactly (by construction, see *Loops*).
  The real test is the seam: the mean change from frame 599 to frame 0
  divided by the median change between ordinary neighbouring frames. 1.0 means
  the seam looks like any other step; all loops are between 0.87 and 1.12.
* **Step 3.** The middle frame rendered alone from a cold start is byte-identical
  (pixel md5) to the same frame from the full render, for all eight.
* **Step 4.** Measured on frames decoded from the encoded mp4. (a) Smooth
  gradient regions (floor, ceiling, haze, beam interiors) averaged across their
  short axis: no step above 1.5 code values. (b) Share of 8×8 blocks above 3 %
  luminance whose 64 pixels are all one value (what undithered 8-bit gradients
  produce): 0.0–0.19 %. Frame Tunnel White Burst: 50 random points in each of
  the last 12 frames all read **255,255,255**.
* **Step 6.** Frame-to-frame change over frames 270–330 is even (max/median
  1.01–1.12, no hitch). For White Burst the 4.7 peak is the deliberate flicker
  and the white-out, not a hitch.

### Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps; 600 frames (1, 3–8) and 180 frames (2)
- [x] three.js on WebGL2 via `@remotion/three`; Stage Beams as one fragment shader
- [x] `InstancedMesh` for all repeated units; Canvas 2D textures, mipmapped, 16× anisotropic (capped by the GPU)
- [x] Half-float post chain; blue-noise dither in every final pass; grain from pixel + frame, faded below 3 % luminance
- [x] White Burst ends on pure white, no grain/dither in the last 12 frames
- [x] Determinism: seeded at module level; no `Math.random`, clocks or state; cold frame = full-render frame
- [x] Exact loops (steps 2 and 6)
- [x] JetBrains Mono (OFL) with licence in `public/fonts/OFL.txt`; no logos or vendor marks
- [x] 720p previews + stills; 4K/6K commands above


### Reference comparison: what is still different

Three rounds of independent side-by-side critique were run per look (step 8);
the last round's fixes are in this build but were not re-judged.

* **Server Aisle realism (open).** All three realism critiques still call it a
  good CG render rather than a photograph: the 7 faceplate textures repeat,
  units are flat (no relief), there is little cabling and no cast shadows.
* **Server Aisle camera** sits at 0.72 m instead of 0.9 m so the rack bottoms
  run nearly flat, as in the reference.
* **Stage Beams** cross just above the top edge, so on screen they enter as two
  separate lamp heads and diverge, as in the reference; the brief's wording
  ("cross near the middle") would contradict the reference frame.
* **Frame Tunnel White Burst**: critiques disagreed between rounds on how bright
  the outer slat walls should be; the last round still found the walls darker
  and the end wall brighter/flatter than the reference.
* **Screen Corridor** keeps chart panels and JetBrains Mono digit readouts
  (required by the brief) that the reference does not show, and stays a little
  greener and brighter.
* **Stream Corridor** ribbons are still thinner and more numerous than the
  reference's few thick streams.
