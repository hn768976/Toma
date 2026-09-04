# Flow Field Streamlines

Two 15-second seamless loops of a curl-noise flow field traced by glowing
streamlines across a displaced surface, built with [Remotion](https://remotion.dev)
and `@remotion/three`.

| Composition id         | Look                                    | Seed       |
| ---------------------- | --------------------------------------- | ---------- |
| `V1-FlowFieldBlue`     | Deep blue on `#01040c` (reference match) | `20260904` |
| `V2-FlowFieldEmerald`  | Emerald / teal-green on `#010c08`        | `71144822` |

Both are defined at **3840×2160, 30 fps, 450 frames (15 s)** and loop exactly.
They share all of the motion machinery and differ in palette and field seed, so
they read as two separate clips rather than two colourways of one.

## Install

```console
npm install
npx remotion studio
```

## Render

**4K masters** — one command per composition:

```console
npx remotion render V1-FlowFieldBlue out/V1_FlowFieldBlue.mp4 --scale=1 --crf=16 --color-space=bt709 --pixel-format=yuv420p
npx remotion render V2-FlowFieldEmerald out/V2_FlowFieldEmerald.mp4 --scale=1 --crf=16 --color-space=bt709 --pixel-format=yuv420p
```

**1080p previews** — the same picture at half scale:

```console
npx remotion render V1-FlowFieldBlue out/V1_FlowFieldBlue.mp4 --scale=0.5 --crf=27 --color-space=bt709 --pixel-format=yuv420p
npx remotion render V2-FlowFieldEmerald out/V2_FlowFieldEmerald.mp4 --scale=0.5 --crf=27 --color-space=bt709 --pixel-format=yuv420p
```

`--color-space=bt709` matters: without it Remotion tags the file full-range and
ffprobe reports `yuvj420p`, which anything that ignores the range flag renders
with crushed blacks. With it you get properly tagged limited-range `yuv420p`.

Dense hairlines plus film grain are expensive to encode, so the previews run
crf 27 — 12-13 Mbps, 23 MB for the blue and 25 MB for the brighter emerald —
rather than crf 16, which at 1080p costs four times the file for nothing visible
at 3x zoom. The ladder on this content runs roughly crf 16 → 104 MB, 20 → 60 MB,
25 → 31 MB, 27 → 23 MB; pick to taste, the structure survives all of them. The
4K masters keep crf 16.

Note that `--encoding-max-rate` / `--encoding-buffer-size` are silently ignored
on this codec path in Remotion 4.0.515 — passing an 8 Mbps ceiling to a 19 Mbps
encode produced a byte-identical file — so size is steered with `--crf` alone.

**Stills:**

```console
npx remotion still V1-FlowFieldBlue out/V1_FlowFieldBlue_still.png --frame=120 --scale=0.5
npx remotion still V2-FlowFieldEmerald out/V2_FlowFieldEmerald_still.png --frame=200 --scale=0.5
```

Every size in the clip is expressed in composition pixels or as a fraction of
the frame, so `--scale=0.5` is an exact downscale of the 4K render rather than a
different picture.

### GPU

The trails are WebGL geometry, so headless Chrome needs a real GL backend.
`remotion.config.ts` sets `--gl=angle`, which picks a GPU where one exists and
falls through to SwiftShader where one does not. SwiftShader works but is much
slower; add `--gl=swiftshader` explicitly if ANGLE misbehaves in your image.

### Measured render time

On 4 vCPUs with no GPU (SwiftShader), **1080p (`--scale=0.5`) costs ≈ 0.9 s per
frame** — the two 450-frame loops took 394 s and 414 s of wall clock. SwiftShader
already spreads rasterisation across every core, so raising `--concurrency` past
1 buys nothing on a 4-core box: measured throughput was the same at
`--concurrency=1` (0.83 s/frame over 30 frames) and at `--concurrency=4`.

Integration runs one midpoint step per frame of a particle's age, so the
longest-lived particles (cycle 225) are integrated up to 224 steps rather than
the 30-60 a shorter cycle would need. That buys the long ribbons the look
depends on, and it is affordable here because the field is read from a grid
rather than from the noise directly: the whole frame's integration is a few
hundred thousand bilinear lookups.

Roughly 0.3 s of each frame is CPU-side geometry building — about 240k ribbon
and glow quads rebuilt from scratch, which `npm run verify-loop` reports — and
the rest is rasterisation and encode. A 4K render is four times the pixels and
the same geometry cost, so budget around 2 s per frame on the same machine, and
far less on anything with a GPU.

## How it is put together

```
src/flow-field/
  noise.ts         4D simplex noise — the two extra axes carry the time loop
  field.ts         curl field, surface relief and brightness field, on grids
  camera.ts        the fixed low camera, shared by three.js and the CPU maths
  particles.ts     the seeded particle table (positions, trails, lives, phases)
  build-frame.ts   per-frame streamline integration and ribbon geometry
  palette.ts       the two colour ramps
  Streamlines.tsx  the mesh, its shader, and the per-frame buffer upload
  FlowField.tsx    composition: canvas, vignette, grain
```

**The surface** is not a mesh. A particle's height is a direct lookup into the
same noise the relief is drawn from, which is both cheaper and exact.

**The field** is the curl of a three-octave scalar potential, taken by central
differences on a 288×216 grid. Curl, not gradient: a divergence-free field is
what closes the vortices, and gradient-following noise gives combed lines with
no curl at all.

**The loop** is the part worth reading the code for. Remotion renders frames out
of order across threads, so no mutable particle array can survive between
frames. Instead every particle has a fixed seed, a life length that divides
evenly into 450, and a phase offset; at any frame it is integrated forward from
its seed by `(frame + phase) mod cycle` steps. That makes a frame a pure
function of its frame number. Four different life lengths (75, 90, 150, 225) are
in play, so although each particle resets several times over the clip, the
ensemble only repeats at frame 450. `tools/verify-loop.ts` checks this: it
builds frames 0 and 450 and asserts the vertex buffers are bit-identical.

```console
npm run verify-loop
```

**Seeding** follows the frustum rather than a world-space rectangle. The visible
ground is a narrow trapezoid — a couple of dozen world units across at the
bottom of frame, hundreds at the top — so a rectangle would put most particles
off the sides and starve the near field. Depths are drawn with a density that
goes as 1/depth, which keeps the perspective density gradient without letting
the far field outnumber the near field by the square of the depth ratio.

Population is held steady by the life cycle rather than by wrapping particles
around the frame edges. A particle that drifts off frame simply stops being
drawn until its cycle returns it to its seed, and because phases are staggered
the on-screen count is constant. Wrapping would be the other way to do it, but in
a field that is not periodic it makes a trail jump across the frame mid-ribbon.

**Depth** does the rest of the work: line width, brightness, fog and depth of
field are all functions of view-space depth, which is why the far field
compresses into hairlines near the top of frame and dissolves into a glow rather
than ending at a visible edge.
