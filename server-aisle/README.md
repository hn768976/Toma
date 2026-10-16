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

<!-- RESULTS -->
