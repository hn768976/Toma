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

__TIMINGS__

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
has a VSM soft shadow from the upper-right key (blurred in shadow space,
deterministic), and a sweep light that turns one full azimuth per loop
(cool and low for Graphite). The spiral turns ±12° (cosine).

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

__CHECKS__
