# Flag Growth / Decline Chart — template (25 countries × 2)

A country's flag on a glossy card stands on a soft blue studio floor. In front
of it, nine glossy white 3D bars form a chart and a bold 3D arrow zigzags
through them — **Growth**: bars rise and a green arrow climbs; **Decline**:
bars fall and a red arrow drops. The camera drifts slowly around the scene.

Remotion 4 + `@remotion/three` (react-three-fiber, three.js r180), WebGL2.
**50 compositions, 3840×2160, 30 fps, 360 frames (12 s).** One data row per
country, two direction presets. A separate, self-contained project (the flags
were copied from the FlagMap template so the two series match).

```
npm install
npx remotion studio
```

## Compositions

Remotion composition IDs may only contain letters, digits and `-`, so the IDs
are `FlagChart-<ID>-Growth` / `FlagChart-<ID>-Decline` (e.g.
`FlagChart-SouthKorea-Decline`); the commands below write the files as
`FlagChart_<ID>_<Direction>.mp4`.

IDs: `USA China Japan Germany UK India France Italy Canada Brazil Russia
SouthKorea Australia Spain Mexico Indonesia Netherlands UAE Turkiye
Switzerland Argentina SouthAfrica Nigeria Egypt Pakistan`

## Render

`remotion.config.ts` sets: ANGLE GL, PNG intermediate frames, H.264, CRF 16,
`yuv420p`, muted (no audio stream), concurrency 4.

**4K, one composition**

```
npx remotion render FlagChart-SouthKorea-Decline out/FlagChart_SouthKorea_Decline.mp4 --gl=angle --crf=16 --pixel-format=yuv420p
```

**4K, all 50** (bash; bundles once)

```
npx remotion bundle --out-dir=build
for id in USA China Japan Germany UK India France Italy Canada Brazil Russia SouthKorea Australia Spain Mexico Indonesia Netherlands UAE Turkiye Switzerland Argentina SouthAfrica Nigeria Egypt Pakistan; do
  for dir in Growth Decline; do
    npx remotion render build "FlagChart-$id-$dir" "out/FlagChart_${id}_${dir}.mp4" --gl=angle --crf=16 --pixel-format=yuv420p || exit 1
  done
done
```

**720p preview**

```
npx remotion render FlagChart-SouthKorea-Decline out/FlagChart_SouthKorea_Decline.mp4 --scale=0.3333333333333333
```

**Still, 6000×3375, frame 300**

```
npx remotion still FlagChart-SouthKorea-Decline out/FlagChart_SouthKorea_Decline_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375; the canvas renders at the scaled
resolution through `devicePixelRatio`, so it is a true 6K render.)

**Chromium GL flag.** WebGL2 needs `--gl=angle` in headless Chromium (set in
`remotion.config.ts` via `Config.setChromiumOpenGlRenderer('angle')`; with the
Node APIs pass `chromiumOptions: {gl: 'angle'}`). Without a GPU, ANGLE falls
back to SwiftShader (CPU), which works but is slow.

## Render time

Measured on the build machine: 4 vCPUs, **no GPU** (ANGLE falls back to
SwiftShader, i.e. WebGL on the CPU), `FlagChart-SouthKorea-Decline`, PNG
frames, start-up time subtracted. Each frame is three passes (mirror
reflection, main scene with 4× MSAA and PCSS shadows, post with depth of field).

| Resolution | One worker | Full 12 s clip, 4 workers |
|-----------|-----------|---------------------------|
| 720p (`--scale=0.333…`) | **2.27 s / frame** | __CLIP_TIME__ incl. encoding |
| 1080p (`--scale=0.5`) | 4.47 s / frame | — |
| **4K (estimate)** | **≈ 16 s / frame** | ≈ 1.6 h per composition, ≈ 80 h for all 50 |

Time grows roughly linearly with pixel count (720p → 1080p: 2.25× pixels, 2.0×
time); 4K (9× the pixels of 720p) is extrapolated, not measured — 4K was not
rendered here. SwiftShader already uses every core, so Remotion concurrency
barely helps on a CPU-only machine. **Render the 4K set on a machine with a
GPU**: expect roughly 0.5–1.5 s per 4K frame there.

## Scene (shared by all 50 — `src/scene/`)

- **Card:** rounded-rectangle slab, 3% of its width thick, corner radius 3% of
  its height, thin white bevelled rim; flag on the front face with a glossy
  clearcoat (the studio HDRI's reflection slides across it as the camera
  moves) and one soft reflection sweep around frame 200. Constant height,
  width from the flag's official ratio, shrunk only if it would exceed 55% of
  the frame width (UK, USA, Canada…). Optional per-row `cardOffset`.
- **Bars:** 9 rounded boxes, glossy white `#F4F6FA` with a cool fill in the
  shadows; heights seeded per country (`src/data/rows.ts`, module-level
  `mulberry32`): rising 10% → 100% with two small dips for Growth, the same
  heights mirrored for Decline. The tallest bar is ≈ 46% of frame height.
  The bar row is turned 30° so its right end recedes, as in the references.
- **Arrow:** a thick zigzag ribbon (mitred corners, square-ish section) just
  below the bar tops and in front of them, plus a bold arrowhead; green
  `#3AE84A` with a lighter top edge (Growth) or red `#E8203A` (Decline);
  glossy; a soft coloured glow on the floor beneath it. It draws on with a
  clipping plane; the head pops in last.
- **Floor:** blue-grey `#94AED2` → `#C8D8E8` toward the horizon, faint light
  specks and thin "network" lines with nodes (fixed, seeded), and a blurred
  mirror reflection (the scene is rendered mirrored from the same camera and
  sampled in screen space). Backdrop: pale-blue gradient dome, brighter at the
  top. Floor and backdrop are display-referred (exact colours, no tonemapping).
- **Lighting:** Poly Haven "Studio Small 03" HDRI (CC0) + key light from the
  upper left; PCSS soft shadows patched into three's shadow chunk at module
  load (same technique as drei's `<SoftShadows>`, which applies in an effect —
  too late for a cold-started Remotion frame). No `AccumulativeShadows`.
- **Post:** depth of field (sharp zone from the chart's front to the card's
  back, recomputed each frame), ACES tonemapping, sRGB, ±1/255 dither and 1.5%
  (peak-to-peak) grain from an integer hash of pixel and frame.
- **No text** in the frame.

Timeline: fade-in 0–15; bars grow 10–70 (staggered, ease-out with a small
overshoot); arrow draws on 30–100, head pops 98–110; camera drifts 0–360 from
35° high and 14° left to 15° high and 11° right (25° orbit) with a 14%
push-in; reflection sweep across the card around frame 200.

## Determinism

- No `Math.random()` at render time: bar heights and floor lines come from a
  module-level seed (`src/lib/random.ts`); grain/dither is an integer hash of
  pixel and frame.
- No clocks or state driving visuals: the R3F render callback reads the
  current frame number only. Geometry and textures are built once per
  composition. Flags and the HDRI load behind `delayRender`.
- No TAA, temporal AO or `AccumulativeShadows`.

## Checks

__CHECKS__

## How to add a country

One row in `src/data/rows.ts`:

```ts
{id: 'Chile', label: 'Chile', flag: 'Chile'},
```

plus its flag in `src/flags/flags.ts`, e.g.
`Chile: {w: 3, h: 2, main: '#0039A6', source: 'code', svg: ...}` (draw it from
its construction sheet, or put a public-domain SVG in `public/flags/` and use
`file:` instead of `svg:`, then list it in `FLAG_SOURCES.md`). Both
compositions `FlagChart-Chile-Growth` and `FlagChart-Chile-Decline` appear
automatically; the bar heights are seeded from the ID. If the chart hides the
flag's emblem, nudge the card with `cardOffset: {x: 0.1}` (fractions of the
card's width/height).

## Project layout

```
src/data/rows.ts            25 rows, direction presets, seeded bar heights
src/flags/flags.ts          flags drawn in code + Wikimedia file references
src/scene/layout.ts         look settings, camera, framing, timeline
src/scene/geometry.ts       card, bars, arrow ribbon + head
src/scene/shaders.ts        PCSS patch, floor, backdrop, post pass, glint
src/scene/ChartScene.tsx    scene graph and the per-frame render loop
src/sheets/                 contact-sheet compositions
public/flags/               public-domain Wikimedia flag SVGs
public/hdri/                Poly Haven studio HDRI (CC0)
scripts/contact-sheets.mjs  renders the sheets (+ frame-300 cold-start twice check)
```
