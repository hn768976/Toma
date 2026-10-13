# Cloud Upload · Data Pills · Diamond Frames · Topo Lines · Faceted Relief

Five looks and eight compositions in one Remotion project. Every composition
is a **20 s seamless loop**: 600 frames at 30 fps, defined at 3840×2160.

| Composition id | Look | Engine | File name |
|---|---|---|---|
| `CloudUpload-Blue` | 1 Cloud Upload | three.js (WebGL2) | `CloudUpload_Blue.mp4` |
| `DataPills-Blue` | 2 Data Pills | three.js | `DataPills_Blue.mp4` |
| `DataPills-Amber` | 2 Data Pills | three.js | `DataPills_Amber.mp4` |
| `DiamondFrames-BlackGold` | 3 Diamond Frames | three.js | `DiamondFrames_BlackGold.mp4` |
| `DiamondFrames-BlackSilver` | 3 Diamond Frames | three.js | `DiamondFrames_BlackSilver.mp4` |
| `TopoLines-Silver` | 4 Topo Lines | full-screen fragment shader on a three.js plane | `TopoLines_Silver.mp4` |
| `TopoLines-Cyan` | 4 Topo Lines | fragment shader | `TopoLines_Cyan.mp4` |
| `FacetedRelief-MidnightBlue` | 5 Faceted Relief | three.js | `FacetedRelief_MidnightBlue.mp4` |

Remotion does not allow `_` in composition ids, so the ids use `-`. The
deliverable file name is the id with `-` replaced by `_`.

## Setup

```bash
npm install
npx remotion studio        # preview (the studio uses a lighter canvas resolution)
```

Node 18+ is required. Versions are pinned in `package.json`: Remotion
4.0.515, three 0.180.0, @react-three/fiber 9.4.0 and React 19.2.3.

### Chromium GL flag (required)

Every composition needs WebGL2, so headless Chromium must run with ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets this (`Config.setChromiumOpenGlRenderer("angle")`).
If you call the Node.js render APIs, pass `chromiumOptions: { gl: "angle" }`
yourself, because they ignore the config file. On a machine with no GPU,
ANGLE falls back to SwiftShader (software). It still works, just slowly; see
the timings below.

## Render commands

### 4K (3840×2160) per composition

```bash
npx remotion render CloudUpload-Blue            out/CloudUpload_Blue.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render DataPills-Blue              out/DataPills_Blue.mp4              --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render DataPills-Amber             out/DataPills_Amber.mp4             --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render DiamondFrames-BlackGold     out/DiamondFrames_BlackGold.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render DiamondFrames-BlackSilver   out/DiamondFrames_BlackSilver.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render TopoLines-Silver            out/TopoLines_Silver.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render TopoLines-Cyan              out/TopoLines_Cyan.mp4              --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render FacetedRelief-MidnightBlue  out/FacetedRelief_MidnightBlue.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

For a mezzanine master, use `--codec=prores --prores-profile=4444` instead.

### 6K still (6000×3375)

The compositions are 3840×2160, so a scale of 6000/3840 = 1.5625 gives 6000×3375:

```bash
npx remotion still CloudUpload-Blue out/CloudUpload_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Swap in any composition id and frame number. All sizes in the shaders
(line widths, blur radii, glow, grain) are defined relative to the frame
height, so a 6K still looks like the 720p preview, only sharper.

### 720p previews (as delivered)

```bash
scripts/render-previews.sh            # all eight, or pass ids
```

This renders a lossless PNG sequence at `--scale=0.3333333333333333`
(exactly 1280×720). It then encodes the sequence with ffmpeg as H.264,
CRF 16, yuv420p, 30 fps and no audio, and copies frame 300 as the PNG
still. The PNG sequence is kept because the determinism check compares
against it.

## How it's built

```
src/
  Root.tsx           registers one <Composition> per data row
  versions.ts        THE DATA: one row per version (colours etc.)
  common/
    Stage.tsx        ThreeCanvas host; t = frame % 600; font gate
    pipeline.ts      post: MSAA HDR -> DoF -> overlay -> fixed-res bloom -> ACES/sRGB + grain + dither
    env.ts           procedural strip environments (PMREM), built once
    backdrop.ts      full-screen gradient/haze background
    glsl.ts noise.ts random.ts constants.ts fonts.ts world.ts
  looks/
    cloud.ts datapills.ts diamonds.ts topo.ts facets.ts
```

Each look is a plain three.js "world" that is built once and has an
`update(t)` method. `t` is `frame % 600`, so frame 600 is literally frame 0.

- **Look 1, Cloud Upload.** The cloud outline comes from a smooth-union
  SDF (circles plus a rounded box), ray-marched into a polygon. The up-arrow
  is a hole in that outline. The shape is extruded with bevels into a
  `MeshPhysicalMaterial` (transmission 0.5, roughness 0.2) with an additive
  Fresnel rim (masked on downward faces to avoid edge-on hotspots). A
  slightly smaller solid glass arrow stands in the cut-out so the arrow
  reads clearly.
  - **Platform:** three rings, a dashed ring and ticks. They turn in
    opposite directions, one whole turn per loop.
  - **Beams:** 40 cylindrical-billboard beams plus 3 haze columns. Their
    flicker uses integer cycles per loop.
  - **Particles:** 1,500 dots, dashes and JetBrains Mono glyphs. They rise
    with whole-cycle wraps.
  - **Floor and wall:** circuit canvas textures (R channel = trace,
    G/R = per-trace phase) with pulses running outward.
  - **Depth of field:** focuses on the cloud.
- **Look 2, Data Pills.** 11 capsules per layout period (55 across the 5
  periodic copies in the scene, 8–12 on screen; the brief suggested about
  70, but the reference shows about 8, so this follows the reference).
  Capsules are rejection-sampled so they never overlap on screen. Each capsule is an
  instanced quad drawn with a stadium SDF: outline, glass fill, and a data
  atlas with 8 variants (padlock, divider, binary text in JetBrains Mono,
  bars).
  - **Links:** cubic-Bézier ribbons with dotted beads, node beads and
    pulses. Pulse periods are whole cycles per loop (600 frames divided by
    an integer).
  - **Specks:** 600 squares and dots.
  - **Depth of field:** computed per object in the shaders, so additive
    glows blur correctly.
  - **Camera:** glides exactly one layout period V in 600 frames.
- **Look 3, Diamond Frames.** A lattice of tiles, each with 5 bevelled,
  extruded square rings, every one 3% deeper than the last, around a
  dot-normal-mapped panel. Everything is instanced. The material is black
  satin metal (`#0A0A0C`, metalness 0.6, roughness 0.35).
  - **Lighting:** a strip environment, plus a `RectAreaLight` that sweeps
    diagonally once per loop. A bevel glint is driven by the same sweep
    position, giving the thin travelling gold lines.
  - **Glitter:** 3,000 points on a fine dot grid over the upper bands. They
    twinkle from hash(ID, 10-frame bucket mod 60), smoothly blended between
    buckets so they never strobe.
- **Look 4, Topo Lines.** One fragment shader.
  - **Field:** 4-octave 4D simplex fBm with time on a circle
    (θ = 2π·t/600).
  - **Lines:** anti-aliased iso-lines from the field value and its
    screen-space gradient (dFdx/dFdy), about 2 px wide at 720p, with a
    two-term glow.
  - **Sparkles:** beads travel along each contour on a phase field (6 whole
    cycles per loop), plus hashed twinkle stars.
  - **Brightness:** varies slowly along the lines.
- **Look 5, Faceted Relief.** Jittered seeds on a torus give periodic
  Voronoi cells. Each cell becomes a star: 16–20 ridges at even angles run
  from the raised apex down to the cell boundary, with notched valleys
  between them. Every facet is a flat triangle. Ridges and valleys get a
  thin world-space chamfer highlight in the shader.
  - **Material:** `#141A2E` metal, metalness 0.8, roughness 0.25.
  - **Lighting:** four soft environment strips that rotate exactly 360° per
    loop, plus a cool key light.
  - **Camera:** about 15° tilt, drifting exactly one tile period
    diagonally.

### Determinism

- **Inputs:** every on-screen value is a function of `useCurrentFrame()`
  only.
- **Randomness:** layouts come from `mulberry32` seeded at module level.
  There is no `Math.random()`, `Date.now()` or `useState` driving visuals.
- **The R3F clock:** `useFrame` is used only as R3F's render hook; its
  clock and delta are never read.
- **No temporal effects:** there is no TAA and no accumulation.
- **Assets:** fonts and canvas textures are built before the first frame,
  behind `delayRender` / `continueRender`.
- **Grain and dither:** both come from a PCG hash of
  `(pixel x, pixel y, frame % 600)`.

## Add a colourway (one data row)

Copy a row in `src/versions.ts`, give it a new `id` and change the colours.
Example:

```ts
{
  id: "TopoLines-Gold",
  look: "topo",
  background: "#000000",
  params: { line: "#FFE2A0", glow: "#C8902A", sparkle: "#FFF6E0" },
},
```

`Root.tsx` registers it automatically. Also add the id to `scripts/ids.sh`
if you want the helper scripts to include it.

## Measured render times

These were measured in a cloud container with **no GPU**. Chromium ran with
`--gl=angle`, which fell back to SwiftShader (software WebGL). All times
come from the final renders, one render thread each (`--concurrency=1`;
more threads were slower on this 4-core machine). The 720p figure is the
wall time of the full 600-frame render divided by 600.

| Composition | 720p s/frame | 600 frames at 720p |
|---|---|---|
| CloudUpload-Blue | 2.60 | 26.0 min |
| DataPills-Blue | 0.45 | 4.5 min |
| DataPills-Amber | 0.45 | 4.5 min |
| DiamondFrames-BlackGold | 0.81 | 8.1 min |
| DiamondFrames-BlackSilver | 0.87 | 8.7 min |
| TopoLines-Silver | 0.40 | 4.0 min |
| TopoLines-Cyan | 0.37 | 3.7 min |
| FacetedRelief-MidnightBlue | 0.62 | 6.2 min |

### Timed 4K frames (3840x2160, frame 300, `npx remotion still`)

| Composition | Wall time of the still | Minus start-up (≈ 6 s / 4.4 s) | Ratio to 720p frame |
|---|---|---|---|
| CloudUpload-Blue | 53.1 s | **≈ 47 s / frame** | ≈ 18x |
| DiamondFrames-BlackGold | 13.1 s | **≈ 8.7 s / frame** | ≈ 11x |

The start-up figure is the same composition's 720p still time minus its
720p per-frame time. It covers the browser launch, scene build, the PMREM
environment and the canvas textures.

### 4K estimates, same CPU-only machine, one thread

| Composition | Estimated s/frame at 4K | 600 frames |
|---|---|---|
| CloudUpload-Blue | ≈ 47 (measured) | ≈ 7.8 h |
| DataPills-Blue / Amber | ≈ 5–8 | ≈ 50–80 min each |
| DiamondFrames-BlackGold / Silver | ≈ 8.7 (measured) | ≈ 1.5 h each |
| TopoLines-Silver / Cyan | ≈ 3.5–4 | ≈ 35–40 min each |
| FacetedRelief-MidnightBlue | ≈ 6–8 | ≈ 60–80 min |

That is about 15 h for all eight at 4K on this CPU-only machine. These
scenes are fill-rate bound (MSAA, DoF gather, physical transmission), so a
machine with a real GPU through ANGLE should be one to two orders of
magnitude faster, roughly 0.3–2 s per 4K frame. Use `--concurrency` there.
Remotion's per-frame timeout is raised to 600 s in `remotion.config.ts`
because the 4K Cloud Upload frame exceeds the 30 s default on software GL.


## Checks and completion checklist

All checks ran on the **final** 720p renders. The scripts are in `scripts/`.

| Step | Check | Result |
|---|---|---|
| 1 | ffprobe: 1280x720, 30/1, h264, yuv420p, no audio, 20.0 s (`check-files.sh`) | **8/8 PASS** |
| 2 | Loop: composition made 601 frames (`loopCheck` prop), frame 0 vs 600 (`loop-check.sh`) | **8/8 pixel-identical** |
| 3 | Determinism: cold-start frame 300 vs frame 300 of the full render (`determinism-check.sh`) | **8/8 byte-identical** (decoded pixels and PNG file bytes) |
| 4 | Banding, read from frame 300 of the **encoded mp4** (`banding-stretch.py`, `banding-check.py`) | PASS, details below |
| 5 | Contact sheets, 5 frames each (`contact-sheets.sh` → `out/contact/`) | All required features present |
| 6 | Motion, frames 270–329 (`motion-check.py`): frame-to-frame difference, flicker spikes, 1:1 crops | 8/8: steady differences, **0 isolated spikes** |
| 7–8 | Reference comparison and independent critic rounds | See the delivery report. Three rounds were run per look. Significant differences remain for all five looks. |

**Banding.** Gradient-only patches are cut from each encoded mp4,
contrast-stretched 8×, and the column-mean profile is read:

- **Smooth ramps:** Data Pills backgrounds have a largest neighbour step of
  0.65 levels, and Cloud Upload's upper background 1.7 levels. All of these
  are smooth ramps covered by grain, with no contour steps.
- **Diamond Frames:** the centre panel shows only the intended dot-grid
  normal map.
- **Topo Lines:** the black between lines is flat and clean at levels 1–3,
  because grain and dither fade to zero below about 3% luminance, as
  specified. In TopoLines-Cyan there is one 1-level step in the far tail of
  the glow, visible only at 8× stretch. With grain off in near-black, that
  is the 8-bit minimum.

### Completion checklist

- [x] 8 compositions, 3840x2160, 30 fps, 600 frames, one data row each (`src/versions.ts`)
- [x] three.js on WebGL2 for Looks 1, 2, 3 and 5; one fragment shader for Look 4; no PixiJS
- [x] JetBrains Mono (OFL) bundled with its licence; no other text, no logos
- [x] Deterministic: seeded mulberry32 at module level, everything driven by `frame % 600`, no `Math.random` / `Date.now` / clock; no TAA or accumulation
- [x] Grain about 1.5% plus ±1/255 dither from (x, y, frame); grain fades out in near-black on Look 4
- [x] 720p previews and 720p PNG stills for all 8; ffprobe-verified
- [x] Loop, determinism, banding, contact-sheet and motion checks pass
- [x] Measured 720p times, two timed 4K frames, 4K estimates
- [ ] Visual match to the references: **not fully achieved**. See the remaining differences in the delivery report.


## Licences

- JetBrains Mono (`public/fonts/JetBrainsMono-Medium.woff2`): SIL Open Font
  License 1.1. The licence text is in `public/fonts/OFL.txt`.
- No logos and no text other than the tiny data glyphs in Looks 1 and 2.
