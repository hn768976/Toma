# Line Mesh Cloth

A dark surface built from hundreds of fine parallel lines, undulating like cloth
and catching light along the crests. Two materials, both 3840×2160, 30 fps, 360
frames (12 s), and both seamless loops.

| Composition id        | Material                                        |
| --------------------- | ----------------------------------------------- |
| `V1-LineMeshBlue`     | Deep blue — the reference match                  |
| `V2-LineMeshCopper`   | Copper / bronze — warm metal, tighter highlight  |

Built with Remotion + `@remotion/three` (react-three-fiber / three.js).

## Requirements

- Node 18 or newer
- The renderer needs a Chromium with working WebGL. Remotion downloads its own
  Chrome Headless Shell on first render.

## Install and preview

```console
npm install
npx remotion studio
```

## Render

`remotion.config.ts` sets the output up already: PNG intermediates (JPEG's
chroma subsampling shows in the cloth's dark falloff), `yuv420p`, `bt709`, and
no audio track. It also sets `Config.setChromiumOpenGlRenderer("angle")`.
**Headless Chromium must run WebGL through ANGLE** or the compositions render
black — if you drive Remotion through the Node APIs instead of the CLI (the
config file does not apply there), pass `chromiumOptions: { gl: "angle" }`.
On the CLI you can also force it per render with `--gl=angle`.

The config additionally reuses a Playwright Chromium if one happens to be
installed at `/opt/pw-browsers/...`, which is only there in some sandboxed
environments. On a normal machine that path does not exist and Remotion falls
back to its own managed browser — nothing to change.

### 4K master (3840×2160)

```console
npx remotion render V1-LineMeshBlue   out/V1_LineMeshBlue.mp4   --scale=1 --crf=16
npx remotion render V2-LineMeshCopper out/V2_LineMeshCopper.mp4 --scale=1 --crf=16
```

### 1080p preview (1920×1080)

```console
npx remotion render V1-LineMeshBlue   out/V1_LineMeshBlue.mp4   --scale=0.5 --crf=17
npx remotion render V2-LineMeshCopper out/V2_LineMeshCopper.mp4 --scale=0.5 --crf=17
```

### Stills

```console
npx remotion still V1-LineMeshBlue   out/V1_LineMeshBlue.png   --frame=96  --scale=0.5
npx remotion still V2-LineMeshCopper out/V2_LineMeshCopper.png --frame=210 --scale=0.5
```

## Measured render time

Measured on the machine that produced the deliverables — a 4-core container with
**no GPU**, so Chromium fell back to SwiftShader (software WebGL). Timings are
per frame at `--concurrency=1`, taken as the slope between a 10-frame and a
40-frame render so bundling and browser start-up are excluded:

| Render          | Per frame | 360 frames, `--concurrency=1` |
| --------------- | --------- | ----------------------------- |
| 1080p (`--scale=0.5`) | **1.85 s** | ~11 min |
| 4K (`--scale=1`)      | **2.18 s** | ~13 min |

4K costs only ~18% more than 1080p because the load is almost entirely vertex
processing — three octaves of 4D simplex noise at three sample points per
vertex, across ~435k line vertices — not rasterisation. On real GPU hardware
both figures should drop by more than an order of magnitude, and 4K should stay
close to 1080p for the same reason.

## How it works

**Geometry.** Every line is a screen-space ribbon — two vertices per sample,
pushed apart along the screen-space perpendicular of the line's tangent — and
all 640 lines live in a single merged `BufferGeometry`, never one object per
line. The `position` attribute does not hold a position: it holds `(u, v, side)`
in parameter space, and the vertex shader evaluates the real world position from
it. Lines are emitted far edge first, so back-to-front alpha compositing is
correct without sorting.

**Displacement.** Three octaves of 4D simplex noise, evaluated analytically in
the vertex shader. The normal comes from the two tangents the shader already
needs (one for the ribbon direction, one for the line pitch), so shading follows
the surface exactly rather than an interpolated approximation.

**Looping.** Every animated value is a pure function of
`uPhase = 2π · frame / durationInFrames`. Each octave rides its own circle in
the noise's 4th dimension *and* orbits its sample position, so folds migrate
across the cloth instead of pulsing in place, and frame 0 and frame 360 are
identical by construction. Nothing reads a clock: no `useFrame`, no delta
accumulation, so Remotion can render frames out of order across threads.

**Aliasing.** Hundreds of fine lines at 4K is the main risk, and it is handled
in three places:

1. *Analytic coverage.* The fragment shader divides the ribbon profile by its
   own pixel footprint (`fwidth`), so a roughly one-pixel ribbon contributes its
   true covered fraction instead of landing on one pixel centre or two depending
   on where it falls.
2. *Merging, not thinning.* Where the surface turns away and neighbouring lines
   converge below `SAFE_PX` on screen, ribbons are widened until they overlap
   and paid for in alpha, turning a picket fence into continuous coverage. The
   threshold is in device pixels, so a 4K master keeps its line texture much
   further back than the 1080p preview does — which is the correct behaviour,
   not a discrepancy.
3. *Occlusion.* An opaque backing surface is written into the depth buffer just
   below the lines. Without it the cloth is a transparent mesh and you see the
   far side of every fold through the gaps between the near lines — two line
   families at slightly different pitches, which is a moiré generator.

**Look.** Brightness comes from the surface normal: crests facing the key go
bright, the far side of a fold goes nearly black, with a tight specular for the
filament edges along the folds and a rim term where the surface turns steeply.
A second, coarser copy of the mesh drawn additively with wide ribbons provides
bloom on the brightest crests only. Depth fade dissolves the far field, a light
DOF softens the nearest lines, and a full-screen grain pass at ~2% doubles as a
dither so the dark falloff does not band once encoded to 8-bit `yuv420p`.

## Tuning

Almost everything is in `src/scene-config.ts` (camera, fold field, lighting,
line width, DOF, fades) and `src/constants.ts` (resolution, duration, line and
sample counts). Colours are in `src/palettes.ts`.
