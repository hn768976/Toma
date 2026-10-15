# Stem Cells & Spiral Bands — Remotion (three.js / WebGL2)

Seven compositions from one shared cell kit and one abstract look.
All are 3840×2160, 30 fps. The cell loops and Spiral Bands are 20 s seamless
loops (600 frames). Cell Division is a 12 s story (360 frames).

| Composition id | Output name | Look | Frames |
|---|---|---|---|
| `CellField-Blue` | CellField_Blue.mp4 | 1A Cell Field, blue | 600 (loop) |
| `CellField-Red` | CellField_Red.mp4 | 1B Cell Field, red + fragments | 600 (loop) |
| `HeroCell-Blue` | HeroCell_Blue.mp4 | 2 Hero Cell push-in | 600 (loop) |
| `CellDivision-Red` | CellDivision_Red.mp4 | 3A Cell Division, red | 360 |
| `CellDivision-Blue` | CellDivision_Blue.mp4 | 3B Cell Division, blue | 360 |
| `SpiralBands-White` | SpiralBands_White.mp4 | 4A Spiral Bands, white | 600 (loop) |
| `SpiralBands-Graphite` | SpiralBands_Graphite.mp4 | 4B Spiral Bands, graphite | 600 (loop) |

(Remotion composition ids cannot contain `_`, so the ids use `-`.)

## Setup

```
npm install
npx remotion studio
```

The Studio previews at half resolution (1920×1080 backing store) to stay
interactive. Renders always use the full composition size times `--scale`.

## Chromium GL flag

All looks need **WebGL2**. Render with ANGLE:

```
--gl=angle
```

This is already set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`).
On a machine with a GPU, ANGLE uses it. Without one, Chromium falls back to
SwiftShader (software). That works, but it is slow (see the timings below).

## 4K render commands

```
npx remotion render CellField-Blue       out/CellField_Blue.mp4       --gl=angle
npx remotion render CellField-Red        out/CellField_Red.mp4        --gl=angle
npx remotion render HeroCell-Blue        out/HeroCell_Blue.mp4        --gl=angle
npx remotion render CellDivision-Red     out/CellDivision_Red.mp4     --gl=angle
npx remotion render CellDivision-Blue    out/CellDivision_Blue.mp4    --gl=angle
npx remotion render SpiralBands-White    out/SpiralBands_White.mp4    --gl=angle
npx remotion render SpiralBands-Graphite out/SpiralBands_Graphite.mp4 --gl=angle
```

`remotion.config.ts` sets H.264, `yuv420p`, CRF 16 and PNG intermediate frames.
There is no audio track. Add `--concurrency=N` to suit the machine; each tab
needs its own WebGL context and about 1–1.5 GB of GPU memory at 4K.

720p previews (what was rendered here):

```
npx remotion render <id> out/<name>.mp4 --gl=angle --scale=0.3333333333333333
```

## Stills (6K)

6000×3375 is 3840×2160 × 1.5625:

```
npx remotion still CellField-Blue out/CellField_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Any composition id and frame work the same way.

## Measured render times

Measured in a cloud container **without a GPU**: Chromium falls back to
SwiftShader (software WebGL), on 4 vCPUs. A machine with a GPU will be much
faster. These numbers are an upper bound.

**720p previews** (`--scale=0.3333333333333333`, `--concurrency=2`, whole
render divided by frame count, startup included):

| Composition | Frames | Total | Per frame |
|---|---|---|---|
| CellField-Blue | 600 | 2125 s | 3.5 s |
| CellField-Red | 600 | 2315 s | 3.9 s |
| HeroCell-Blue | 600 | 2051 s | 3.4 s |
| CellDivision-Red | 360 | 1262 s | 3.5 s |
| CellDivision-Blue | 360 | 1223 s | 3.4 s |
| SpiralBands-White | 600 | 4020 s | 6.7 s |
| SpiralBands-Graphite | 600 | 4061 s | 6.8 s |

**Two real 4K frames** (3840×2160, `npx remotion still --scale=1`, one tab):

| Frame | 4K still | 720p still, same frame | 4K frame, setup removed* |
|---|---|---|---|
| 1A CellField-Blue, frame 300 | 21.3 s | 10.7 s | ≈ 14 s |
| 3A CellDivision-Red, frame 330 (wide hold) | 24.5 s | 8.9 s | ≈ 19 s |

\* A still includes page load, geometry build and shader compile (about
5–7 s, the 720p still minus a 720p frame).

**4K estimates on this software GL:** 4K costs about 4× (1A) to 5.4× (3A)
a 720p frame, not 9×, because a good part of the cost is vertex and CPU
work that does not scale with pixels.

| Composition | Estimated time |
|---|---|
| CellField-Blue / Red, HeroCell-Blue | about 14–16 s/frame, 2.3–2.6 h each |
| CellDivision Red / Blue | about 19 s/frame, about 1.9 h each |
| SpiralBands (not measured at 4K) | about 20–25 s/frame, about 3.5–4 h each, mostly CPU geometry update, scales less with pixels |
| All seven | roughly 17–18 h |

On a real GPU the GL part is typically one to two orders of magnitude
faster, so expect a small fraction of that. That figure is an estimate; it
was not measured here.

## How it works

### Shared cell kit (`src/cells`)

- **Membrane.** A thin glass shell (`materials.ts`): Fresnel reflection of the
  two shell interfaces, a membrane "line" whose optical path grows as 1/N·V (the
  bright rim), refraction of the backdrop at the silhouette, a 3–13% cytoplasm
  haze with soft cloud and granules, and a soft-box "window" highlight on the glow side.
  The shell is a **surface of revolution** (`lathe.ts`), the exact smooth union
  of two spheres, solved each frame on the CPU and passed to the vertex
  shader as 128 rings. A resting cell is a single sphere (`d = 0`). Wobble is
  periodic vertex noise, with normals from finite differences.
- **Nucleus.** A displaced icosphere (`nucleusGeometry.ts`): fractal lumps
  plus two octaves of cellular domes, built once per variant, with a
  subsurface-like rim glow and highlights on the granule peaks.
- **Backdrop.** An analytic studio gradient with a glow (`lib/glsl.ts`). The
  glass evaluates the same function at refracted positions. There are 200
  particles in depth groups.
- **Depth of field.** Every cell is an *impostor*: it is rendered alone into a
  4× MSAA half-float target framed on its screen bounds, blurred by a
  40-tap golden-angle **gather** with its own circle of confusion, and
  composited back to front. Impostor resolution drops as the blur grows, so
  near and far cells stay cheap, and transparent cells blur correctly over each other.
  The blur changes continuously with depth, so there is no layer popping.
- Why not `MeshPhysicalMaterial` transmission: three.js transmissive objects
  do not see other transmissive objects, which breaks a dense field of
  overlapping glass cells, and 60 transmission passes is too heavy. The custom
  thin-shell shader is the "cheaper fake glass" from the brief, used for every
  cell. It still has real Fresnel, a refracted backdrop and DoF.

### Division (`divisionScene.ts`)

Per cell: (1) **nucleus split**, 1 s. Two coincident copies of the nucleus (the second
one 3% smaller, so it is hidden) stretch and move apart inside the still-round
cell. (2) **Pinch**, 2 s. The lobes separate while the smooth-union blend radius
is *solved* so the waist follows a target curve that reaches zero exactly at
the end. The whole shape is rescaled so the cell keeps its length. (3)
**Separation**, 1 s, after which the daughters drift apart. The first cell divides
1.5–5.5 s. Twenty neighbours, already present out of focus or out of frame,
divide in turn from 4 s, giving about 40 cells in the wide hold.

### Spiral Bands (`src/bands`)

There are 20 bands on members of one log-spiral family `r = C_i e^{0.3θ}`, which
never cross. Each band has a rounded top, square end caps, and a gently rippling height
(whole cycles). Ambient occlusion is analytic: the distance from each wall
sample to the facing wall is found once at load, and per frame the occlusion
angle is computed from the current neighbour heights. This replaces SSAO,
because it is exact for this geometry and has no screen-space noise to crawl. The scene
has a soft shadow from the upper-right key and a sweep light that turns
one full azimuth per loop (cool and low for Graphite). The shadow is analytic too: per vertex, the
ray toward the key light is tested against the facing wall's current height,
with a penumbra that grows with distance. three.js shadow maps were tried
first. They made a frame depend on the frames the same tab had rendered
before it, which broke byte-for-byte determinism. The spiral turns ±12° (cosine).

### Banding

All scene targets are RGBA half-float. The final pass converts to sRGB and
adds a triangular blue-noise dither of ±1/255 (a 64×64 void-and-cluster tile,
offset per frame by an R2 sequence) and about 1.5% luminance grain. Both are
fixed functions of pixel position and `frame mod loopFrames`.

### Determinism

- All layouts, schedules and band shapes come from `mulberry32` seeded
  from the data row. `Math.random()`, `Date.now()` and clock values are never used.
- Each frame is computed from `useCurrentFrame()` only. R3F's `useFrame`
  (priority 1) is used only as the "draw now" hook; its clock is ignored.
- No TAA, no accumulation, and no state carried between frames.
- Geometry and textures are built synchronously before the first frame is
  drawn.

## Add a colourway (one data row)

1. For cells, add a `CellColors` object in `src/data/palettes.ts`, or spread an
   existing one and override the colours. For bands, add a `BandColors` object in
   `src/bands/palettes.ts`.
2. Add one row to `ROWS` in `src/data/versions.ts`:

```ts
{ id: "CellField-Green", look: "field", frames: 600, loopFrames: 600, seed: 7, colors: CELL_GREEN },
```

The composition appears in the Studio automatically. `look` selects the scene
(`field`, `hero`, `division`, `bands`), and `seed` selects the layout.

## Verification tools

- `node scripts/stills.mjs --comps <ids> --frames 0,300 --out dir [--props '{"durationOverride":601}']`
  renders stills from one bundle and times them.
- `python3 scripts/compare.py same a.png b.png` checks pixel and byte identity.
- `python3 scripts/compare.py band img.png x0 y0 x1 y1 N` reads a luminance
  profile across a gradient, for banding.
- `scripts/contact.sh video.mp4 N sheet.png` makes a contact sheet.

## Banding check

The check reads frames from the **encoded mp4s**, not the preview.
`scripts/banding.py` averages a 24–48-row strip column by column across a
soft gradient. That removes grain and dither but keeps quantisation steps.

| Preview, area | Range (code values) | Steps > 0.5 code |
|---|---|---|
| HeroCell_Blue, backdrop glow (y 30, x 420–880) | 107–143 | none in the open gradient; the only jumps are at cell rims |
| CellField_Blue, glow (y 230, x 660–900) | 188–213 | 3, at a rim |
| SpiralBands_White, band face (y 600, x 100–500) | 193–219 | 0 |
| SpiralBands_Graphite, dark face | 58–65 | 0; the strip mean changes in fractions of a code |
| CellDivision Red/Blue, CellField_Red, backdrop strips | | smooth; jumps only where a strip crosses a rim |

No staircase anywhere. Targets are half-float, with blue-noise dither and
1.5% grain in the final pass.

## Completion checklist

- [x] 7 compositions, 3840×2160, 30 fps. Loops are 600 frames; Cell Division is 360.
- [x] One data row per version (`src/data/versions.ts`).
- [x] 720p previews: 1280×720, h264, yuv420p, 30/1, no audio stream.
  Cell Division is 12.0 s; the rest are 20.0 s (checked with ffprobe).
- [x] Loop check: each loop rendered at 601 frames, frames 0 and 600
  identical byte for byte (all 5 loops).
- [x] Determinism: the middle frame of each composition rendered alone from
  a cold start is byte-identical to the same frame from a multi-threaded
  sequence render (all 7).
- [x] Banding: frames from the encoded mp4s, smooth (above).
- [x] Contact sheets per composition, and motion smoothness. Mean
  frame-to-frame difference over 2 s around the middle (Cell Division over
  1.5–9 s) shows no spikes; the largest frame is 1.7× the median. The pinch,
  stepped frame by frame, has no seams or pops.
- [x] Model check (3 rounds) and reference comparison by fresh sub-agents
  (3 rounds per look).
- [x] Two real 4K frames timed.
- [x] `npm install && npx remotion studio` from a clean copy of the zip.

## Known limitations

- Spiral Bands has no depth of field (the reference blurs far bands). The
  brief does not ask for it.
- Hero Cell ends with the hero at about 40% of frame height, as the brief
  specifies. The reference is closer (about 70%).
- Cell Field Red: the near cells that sweep past the lens are large and
  heavily blurred. In some frames they dominate more than in the reference.
- The soft-box highlight on the cell glass breaks into small scribble-like
  marks where the membrane wobbles.
