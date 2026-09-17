# Aviation set — six shots from six references

Six short 3D shots, each recreating one supplied reference clip: same framing,
same camera move, same duration, rebuilt from scratch in three.js so they are
resolution-independent and yours.

Everything renders through [Remotion](https://remotion.dev) at **30fps**, H.264,
silent, 16:9.

| # | Composition | Frames | Duration | Reference | Shot |
|---|---|---:|---:|---|---|
| 1 | `Shot01-ContainerAscent` | 251 | 8.37s | istockphoto-2195724474 (8.375s @ 29.97) | Wide lens at ground level, tipped near vertical up a stack of boxes; a jet crosses high above |
| 2 | `Shot02-ContainerWall` | 360 | 12.00s | istockphoto-2194384866 (12.012s @ 29.97) | Long slider move along a wall of stacks, ragged skyline against broken high cloud |
| 3 | `Shot03-ContainerCanyon` | 301 | 10.03s | istockphoto-2194385790 (10.043s @ 29.97) | Symmetrical aisle between two blocks, jet flying straight down the slot of sky |
| 4 | `Shot04-CloudCruise` | 151 | 5.03s | shutterstock-4179374583 (5.033s @ 30) | Chase position on a widebody above a lit cloud deck, bearing swinging aft |
| 5 | `Shot05-OverheadSilhouette` | 216 | 7.20s | shutterstock-3390729315 (7.2s @ 25) | Camera on its back, jet crossing the zenith, teal-graded |
| 6 | `Shot06-AirportSign` | 270 | 9.00s | shutterstock-4036720581 (9.0s @ 25) | Paris International Airport direction sign, departure climbing out behind |

Each shot exists twice — `-1080p` and `-4K` — as the same scene at two
resolutions. Nothing is re-timed between them; only raymarch step counts and
texture anisotropy change, and those follow from the resolution.

References 5 and 6 were shot at 25fps. Their **durations are carried over
exactly** and the frame counts follow from 30fps, which is why they are round.

## Rendering

```bash
npm install
npm run models        # once: preprocess the source GLBs into public/models
npm run render:1080p  # all six, into out/1080p
npm run render:4k     # all six at 3840x2160, into out/4k
node scripts/render-shots.mjs 4k 3   # just shot 3
npm run dev           # Remotion Studio, to scrub and re-light
```

`DevMaterialProbe` is a development composition that orbits the containers and
then the aircraft at close range under neutral light. Both subjects are either
distant or steeply foreshortened in the finished shots, which makes material
changes almost impossible to judge from the shots themselves — scrub this
instead.

## How it is built

### Rendering path

three.js `WebGPURenderer` with TSL node materials throughout — no GLSL, and no
WebGL-specific code anywhere. Three things about the setup are load-bearing
rather than incidental, and all three are documented at their call sites:

- **`remotion.config.ts` forces `chrome-for-testing` mode and multi-process on
  Linux.** WebGPU is only exposed under Chrome's *new* headless mode with its
  own GPU process. Remotion's Linux default is `--headless=old` plus
  `--single-process`, and under either of those `navigator.gpu` is simply
  absent, so three falls back to WebGL2 without saying anything.
- **The renderer is built with no canvas** and draws into an offscreen target
  whose pixels are read back and blitted (`three/ThreeStage.tsx`). A headless
  software adapter hands out a working WebGPU *device* but cannot allocate the
  shared image a canvas swap chain needs — and attaching such a canvas poisons
  the renderer, so even offscreen draws silently produce nothing.
- **A `delayRender` handle is opened during the React render phase**, not from
  an effect, and closed only once the frame's pixels are demonstrably on the
  page. `renderAsync` only queues work, while Remotion screenshots as soon as
  no handle is outstanding.

Each frame is three passes (`post/pipeline.ts`): the sky dome alone into a
half-resolution target, then the scene at full resolution over it, then a grade.
Because the sky arrives as a background rather than as geometry, solid objects
occlude cloud with no depth-buffer work at all.

### Clouds

A proper raymarched layer (`post/clouds.ts`): Perlin-Worley base shape, a height
gradient per cloud type, Worley erosion, Beer-Lambert extinction, a secondary
march towards the sun, Henyey-Greenstein phase with forward and back lobes, and
a multiple-scattering approximation without which cumulus renders as a flat grey
slab.

Two implementation notes worth knowing before editing it:

- **The march is unrolled in JavaScript, not looped in TSL.** A TSL `Loop` that
  accumulates into variables declared outside it contributes nothing on this
  backend — the loop runs, the result integrates to zero, and nothing reports an
  error. The same applies to assigning from inside an `If`. The shader therefore
  contains no control flow, and empty steps are made cheap by the density term
  itself rather than by branching.
- **The noise volumes are 2D slice atlases, not `Data3DTexture`.** three
  generates correct WGSL for a 3D texture (`texture_3d<f32>`) but builds the
  bind group with a 2D view, which the device rejects; the pipeline is then
  invalid and the sky renders as nothing. `three/noise-textures.ts` packs each
  volume into a grid of slices and interpolates depth in the shader.

### Models

Both GLBs arrive as a single unparented mesh in arbitrary units, so their
orientation was measured rather than assumed (`three/assets.ts`): the container
runs along local Z with its cargo doors at +Z, and the aircraft's fuselage runs
along local X with the tail at +X, which is why it gets a quarter turn to point
down −Z. Scale factors put both into metres — the container becomes a real
6.058m ISO 20ft box, the aircraft a 60.3m-span widebody.

The fuselage axis is also measured, from vertices near the centreline amidships.
Centring a model on its bounding box puts the origin several metres above the
fuselage axis on a widebody, because the fin drags it up — so anything placed
from the centroid lands on the tail instead.

- **Container** — no material at all, so it is shaded procedurally
  (`materials/paintedSteel.ts`): factory paint, UV chalking, yard grime, oxide
  running down from the top rail, and stencilled ISO codes drawn into a canvas
  atlas. A whole yard is one `InstancedMesh`; per-box variation rides on two
  instanced attributes.
- **Aircraft** — ships base colour, metallic-roughness and normal maps, so its
  material is used as delivered. There is deliberately no reduced copy: a second
  GLB would duplicate 22MB of texture for a subject that is never more than a
  few hundred pixels across.

### Determinism

Every shot's `update` is a pure function of the frame number. Layout noise comes
from a seeded PRNG (`three/rng.ts`), grain is keyed to the frame index, and
nothing reads wall-clock time — so the studio preview, a CLI render and a
distributed render all agree frame for frame.

## Known limitations

- **Shot 4's cloud deck is thinner and hazier than its reference.** The march is
  real, but at the step counts that keep a software-rendered frame affordable it
  reads as broken deck rather than dense golden cumulus. On a machine with a
  real GPU, raising `cloudSteps` and `cloudLightSteps` in `config.ts` is the
  first thing to try.
- Container stencils are legible close up but wash to a faint grey at the
  distances shots 1–3 actually use — which is what they do in the references
  too, but it does mean the atlas detail is mostly unseen.
