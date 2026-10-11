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
| 720p (`--scale=0.333…`) | **2.27 s / frame** | 13 min 17 s incl. encoding |
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
  the frame width (UK, USA, Canada…). Growth's tall bars stand at the near end,
  in front of the card's centre, so the Growth preset moves the card further
  right (`cardShift`); a per-row `cardOffset` nudges single flags (Spain, whose
  arms sit toward the hoist).
- **Bars:** 9 rounded boxes, glossy white `#F4F6FA` with a cool fill in the
  shadows; heights seeded per country (`src/data/rows.ts`, module-level
  `mulberry32`): rising 10% → 100% with two small dips for Growth, the same
  heights mirrored for Decline. The tallest bar is ≈ 46% of frame height
  (a little above the 40% asked for, toward the references' larger chart).
  The bar row is turned 25° so its right end comes toward the camera, as in
  both references; a 40° lens close up gives the references' strong
  perspective.
- **Arrow:** a thick zigzag ribbon (mitred corners, square-ish section) just
  below the bar tops and in front of them, plus a bold arrowhead; green
  `#3AE84A` with a lighter top edge (Growth) or red `#E8203A` (Decline);
  glossy; a soft coloured glow on the floor beneath it. It draws on with a
  clipping plane; the head pops in last. The arrow is rendered
  display-referred (it skips ACES): the tone curve turned the vivid green
  pastel. Measured on screen: green ≈ (58,234,83), red ≈ (223,38,66).
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
35° high and 14° left to 24° high and 11° right (25° orbit) with a 14%
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

Run before delivery:

- **Files:** `ffprobe` on the preview: 1280×720, 30/1, 12.000 s, 360 frames,
  h264, yuv420p, video stream only.
- **Determinism:** the preview rendered in full as a PNG sequence (4 workers,
  out of order) and frame 200 rendered alone from a cold start: byte-identical.
  `npm run sheets` renders frame 300 of all 50 compositions twice, each pass
  in a fresh browser, and compares the PNGs: 50/50 identical.
- **Every composition renders:** the same script (no errors, no empty frames)
  builds the Growth and Decline sheets.
- **Banding:** a frame decoded from the encoded mp4, read down a floor column
  left of the chart (5×5 averaged to remove grain): values fall smoothly from
  191 to 162 with no step larger than 2.4 levels, no plateaus. What prevents
  banding: ±1/255 dither after tonemapping and 1.5% grain (integer hash of
  pixel and frame) in the final pass; half-float render targets; PNG
  intermediate frames.
- **Motion:** frames 0/40/105/200/280/359 of the preview: fade-in, bars grow,
  the arrow draws on and lands with its head, the reflection sweep crosses the
  card at 200, the camera moves from high-left to lower-right.
- **Flags:** an independent check of the numbered flag sheet identified all 25
  and found no inaccuracies.
- **Clean copy:** `npm install && npx remotion studio` from a fresh copy (no
  `node_modules`) starts the studio.

### Completion checklist

- [x] 50 compositions (25 countries × Growth/Decline) from data rows, 3840×2160, 30 fps, 360 frames
- [x] 3D (WebGL2, `@remotion/three`): flag card, 9 glossy bars, extruded zigzag arrow with draw-on and head pop
- [x] Flags uncropped at official ratios on the card; card ≤ 55% of frame width; Saudi Arabia omitted
- [x] Floor gradient + specks + network lines + blurred reflection; backdrop gradient; HDRI + key light; PCSS shadows; DOF; ACES
- [x] Dither + grain, no `Math.random()`, no clocks, no temporal effects; byte-identical cold frames
- [x] HDRI licence (CC0) and `FLAG_SOURCES.md` shipped
- [x] 720p preview `FlagChart_SouthKorea_Decline.mp4`; flag, Growth and Decline sheets

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
