# Neon Data City Grid

A field of glowing vertical bars rising from a wireframe plane, viewed at a
diagonal so the plane's edge cuts across frame and leaves a wedge of empty
black for a title. Three versions, all 4K, 30fps, 10 seconds, all seamless
loops.

Built with [Remotion](https://remotion.dev) + three.js
(`@remotion/three` / react-three-fiber).

| Composition ID       | Look                                                   |
| -------------------- | ------------------------------------------------------ |
| `V1-DataCityMagenta` | Magenta/blue neon, tight diagonal framing               |
| `V2-DataCityCyan`    | Cyan/teal, same framing — a cooler "data centre" read   |
| `V3-DataCityWide`    | Wide shot: camera back and up, the whole grid in frame  |

## Rendering

```bash
npm install
```

Every composition is **authored at 3840×2160**. Render 4K with `--scale=1`:

```bash
npx remotion render V1-DataCityMagenta out/V1_DataCityMagenta.mp4 --scale=1 --crf=16
npx remotion render V2-DataCityCyan    out/V2_DataCityCyan.mp4    --scale=1 --crf=16
npx remotion render V3-DataCityWide    out/V3_DataCityWide.mp4    --scale=1 --crf=16
```

A 1080p preview is the same command with `--scale=0.5`. The two are meant to be
indistinguishable apart from size — see *Resolution independence* below.

Stills:

```bash
npx remotion still V1-DataCityMagenta out/V1_DataCityMagenta.png --frame=96 --scale=1
```

Interactive:

```bash
npx remotion studio
```

`remotion.config.ts` already pins H.264 / `yuv420p` / CRF 16 and PNG frame
capture, so the render commands above need no extra flags.

## How it is put together

`src/data-city/` holds the whole piece.

**`variants.ts`** is the only file worth editing to change how it looks. Camera
angles, palette, plane extents, bar statistics, the depth-of-field bands and
the bloom all live there, three configs deep.

**The camera is the composition.** The diagonal only reads the way it does at
one particular pair of angles, so cameras are built by `rig(x, y, z, yaw,
pitch)` rather than by a look-at point. For V1 and V2 the camera hovers just
off the plane's right-hand edge (the line `x = 0`) and looks back across it,
turned 36° off the lattice and pitched 43.5° down. Yaw decides how fast the
edge drifts across frame as it recedes; pitch puts the horizon off the top of
frame and therefore sets how steeply it climbs. Together they land the edge 19%
in at the bottom of frame and 79% in at the top, which is the reference
framing. The upper-right stays black — that is title space, and nothing is
placed in it.

**`field.ts`** places the bars. It walks the lattice, projects each
intersection through the camera and keeps only what can reach the frame, so the
bar budget is spent on visible pixels rather than on a square grid whose
corners are off-camera. Every decision — occupancy, height, hue, phase — comes
from a hash of the cell's position, never from a stateful PRNG, so the field is
identical no matter what order cells are visited in and identical between
renders. Hue is a low-frequency noise field, contrast-stretched hard, so
colours pool into magenta regions and blue regions instead of averaging into
purple.

**`shaders.ts`** holds three hand-written emissive materials. There is no
lighting model: bars are a vertical gradient with a hot cap, dots are billboard
quads with a radial falloff, and the ground plane is a single quad with a
procedural lattice. The grid uses screen-space derivatives (`fwidth`) for its
line coverage, which keeps line width constant and properly anti-aliased at any
distance and any output resolution — the reason the far field stays clean
instead of turning into moiré. Tone mapping is off, so hot tips clip to white.

### The loop

`t = frame / durationInFrames` is the only time input in the project. Animated
bar heights come from 4D value noise sampled as
`noise(x, z, cos 2πt, sin 2πt)` — walking a circle through the last two
dimensions, so frame 300 lands exactly back on frame 0 while the path between
never repeats. The camera drift is `sin 2πt` and `cos 2πt - 1`, periodic for
the same reason. Nothing integrates or accumulates: heights are solved from
scratch each frame from `useCurrentFrame()`, which is what lets Remotion render
frames out of order across threads and still get identical output.

### Depth of field

DOF is faked, deliberately. The scene is sliced into bands by camera distance,
each band renders to its own canvas, and the canvases are blurred and stacked.
Bars near a band boundary cross-fade in the shader, so four fixed blur values
become a continuous ramp rather than four visible steps — in V1, roughly 14px
at the bottom edge of frame through 10 and 3 to sharp by about 45% up, then
softening again into the far field. A full bokeh pass at this bar count and
this resolution costs far more and, at 30fps, looks the same.

Bloom is a fifth layer: the tips of the bars and their dots only, blurred wide
and screened back over the stack.

Grain is the last layer, and it is not a texture effect — it is dithering. The
falloff into black is a very long, very shallow ramp, and without a per-pixel
disturbance H.264 lays visible contour rings across it.

### Resolution independence

Remotion's `--scale` sets the device pixel ratio, so a 3840px-wide canvas
rasterises at exactly the output width with no wasted pixels. Anything that
must look the same at both sizes — blur radii, grid line widths, the minimum
on-screen size of a dot — is expressed in *composition* pixels and converted to
device pixels inside the shader. Render at `--scale=0.5` or `--scale=1` and you
get the same picture, one twice the size of the other.

### Bar counts

V1 and V2 place about 2,900 bars each, of which roughly 2,200 fall inside the
frame; the rest sit just outside it, where their blur and bloom still spill
back in. V3 places about 5,500 for roughly 4,600 in frame. Occupancy is 40% of
visible lattice cells (38% for V3) — the gaps matter, a fully populated grid
reads as a solid mass.

## Layout

```
src/
  index.ts                  registerRoot
  Root.tsx                  the three <Composition>s
  data-city/
    variants.ts             V1 / V2 / V3 — cameras, palettes, DOF bands
    constants.ts            4K, 30fps, 300 frames
    random.ts               mulberry32 + position hashing
    noise.ts                2D and looping 4D value noise
    field.ts                bar placement, per-frame heights, camera path
    shaders.ts              GLSL for bars, dots and the ground plane
    Bars.tsx                instanced bars, one mesh per depth band
    Dots.tsx                instanced billboard tip dots
    GridPlane.tsx           procedural wireframe ground
    DepthLayer.tsx          one canvas per depth band, plus the bloom pass
    Grain.tsx               dithering overlay
    DataCity.tsx            stacks the layers
```
