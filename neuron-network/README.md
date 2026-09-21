# Neuron Network

Eleven looping compositions from six looks: branching neurons in depth, with
glowing somas, tapering dendrites, signal pulses travelling along the branches,
drifting particles and heavy depth of field.

Built with Remotion + `@remotion/three` (react-three-fiber, WebGL2).
**30fps, 600 frames (20s), 16:9, compositions defined at 3840×2160.**

---

## Quick start

```bash
npm install
npx remotion studio
```

## Compositions

| Composition id | Output file | Look | Still frames |
|---|---|---|---|
| `HeroNeuronMatted` | `HeroNeuron_Matted.mp4` | 1A Hero Neuron, matted | 75, 225, 450 |
| `HeroNeuronCrystalline` | `HeroNeuron_Crystalline.mp4` | 1B Hero Neuron, crystalline | 40, 280, 520 |
| `NetworkDriftTeal` | `NetworkDrift_Teal.mp4` | 2A Network Drift, teal | 110, 300, 470 |
| `NetworkDriftNavy` | `NetworkDrift_Navy.mp4` | 2B Network Drift, navy | 60, 260, 500 |
| `PulseNetworkGold` | `PulseNetwork_Gold.mp4` | 3A Pulse Network, gold | 95, 290, 455 |
| `PulseNetworkMagenta` | `PulseNetwork_Magenta.mp4` | 3B Pulse Network, magenta | 70, 310, 480 |
| `DenseMeshViolet` | `DenseMesh_Violet.mp4` | 4 Dense Mesh, violet | 55, 275, 495 |
| `DenseMeshTeal` | `DenseMesh_Teal.mp4` | 4 Dense Mesh, teal | 95, 255, 470 |
| `ClearLightGold` | `ClearLight_Gold.mp4` | 5A Clear Light, gold nodes | 45, 265, 505 |
| `ClearLightCool` | `ClearLight_Cool.mp4` | 5B Clear Light, cool nodes | 45, 265, 505 |
| `FibrousFieldBlue` | `FibrousField_Blue.mp4` | 6 Fibrous Field | 80, 300, 520 |

---

## Rendering

### 4K (the delivery render)

```bash
npx remotion render <composition-id> out/<name>.mp4 --scale=1 --crf=16
```

For example:

```bash
npx remotion render HeroNeuronMatted out/HeroNeuron_Matted.mp4 --scale=1 --crf=16
```

Codec, pixel format and CRF are set in `remotion.config.ts` (h264, `yuv420p`,
CRF 16). No audio track is produced.

### 1080p previews

```bash
npx remotion render <composition-id> out/<name>.mp4 --scale=0.5 --crf=16
```

Or render all eleven from a single bundle, which skips ten redundant bundling
passes and writes per-composition timings to `out/render-timings.json`:

```bash
node scripts/render-all.mjs --scale=0.5 --concurrency=2
```

### Stills

```bash
npx remotion still <composition-id> out/<name>.png --frame=<frame> --scale=1.5625
```

`--scale=1.5625` gives 6000×3375 from the 3840×2160 composition. The frames to
use are in the table above and in each look's `stillFrames` row; they were
chosen so a pulse sits well. To harvest all of them — three high-resolution
stills plus one 1080p still per composition:

```bash
node scripts/stills.mjs
```

### Chromium GL flag

Headless Chromium needs a software GL backend. `remotion.config.ts` sets
`--gl=angle`, which is the faster of the two; `swiftshader` also works and is
slower. The config also raises the per-frame timeout, because software GL
compiles these shaders slowly on each worker's first frame.

### Measured render time

See **Performance** below for measured figures from this project.

---

## Adding a look

**A look is one data row in `src/looks/looks.ts`. No component changes.**

Append an entry to `LOOKS` with an `id` (the composition id), a `file` (the
output stem), a `seed`, three `stillFrames`, and these blocks:

| Block | What it controls |
|---|---|
| `field` | How many neurons, whether one is a hero, soma radius, screen coverage (`spreadX`/`spreadY` are fractions of the frame; `1.0` fills it), depth range, how much branch depth the furthest neurons lose |
| `grow` | Branch parameters: primaries, branch probability, max depth, length decay, base radius and length, wander and branch angles, Leonardo exponent, tip taper, branch budget |
| `soma` | Icosphere subdivision, noise displacement amount and frequency, octaves, and whether facets are flat-shaded |
| `tube` | Radial resolution, curve sampling, myelin collars, transparency, ambient/rim shading, how far the soma's glow bleeds into the dendrites |
| `palette` | Background gradient, dendrite and rim, soma core and glow, pulse, node and particle colours |
| `emissive` | Soma brightness, rim strength, and how tightly the hot core sits inside the glow |
| `pulse` | Pulse style: simultaneous slots, traversal counts, width, hardness, junction flare, whole-cell activation, junction flashes, steady node glow |
| `particles` | Count, size, brightness, whether they cluster on the fibres |
| `sparks` | Star-shaped junction flashes: count, size, strength, cycles |
| `camera` | Position, target, fov, Lissajous amplitude/frequency/phase, clip planes |
| `post` | Focus distance and range **in world units**, bokeh scale, bloom, grain, background lift and gain, multisampling |

Then add the row's `file` to the deliverables list. `Root.tsx` maps over
`LOOKS`, so the composition appears automatically.

Two conventions the loop depends on:

- **Every frequency must be an integer** — pulse traversal counts, junction
  flash cycles, whole-cell activation cycles, camera Lissajous frequencies,
  particle path frequencies. One non-integer value anywhere breaks loop closure.
- **Camera roll is zero**, or an integer number of full turns. Nothing between.

---

## How it works

### Branch generation

One recursive rule, run once per look at build time from a seeded
`mulberry32`. From each soma, 5–10 primary dendrites grow by segments; at each
segment there is a `branchProbability` chance of ending in a two-way split.

Growth is **breadth-first**. With a depth-first walk the branch budget is spent
entirely on the first dendrite and the rest of the cell comes out stunted;
breadth-first means the budget runs out at a uniform depth across the whole
cell.

Taper is **Leonardo's rule** — `r_parent^n = Σ r_child^n` with `n = 2.5` — so a
symmetric split keeps 76% of the radius. A flat 0.7 multiplier thins far too
fast and the result reads as a tree diagram rather than a cell. On top of that,
radius thins continuously along normalised arc length from the soma
(`tipRadius`, `tipTaperPower`), which is what takes a dendrite from a broad
base to a hair-fine tip instead of a pipe that steps down at forks.

### Tubes

`TubeGeometry` sweeps a single constant radius and cannot do this, so the tube
builder walks the Catmull-Rom curve, emits a ring of vertices at each step with
*that step's* radius, and stitches consecutive rings. Frames are
parallel-transported so the tube does not spin at inflection points.

**Every branch of every neuron accumulates into one `BufferGeometry`.** A
ten-neuron field as separate meshes would be thousands of draw calls; merged,
the whole dendrite field is one. See **Performance** for the counts.

### Pulses

When a tube is built, each vertex stores its **normalised distance from the
soma** as a vertex attribute, along with the per-dendrite traversal counts and
phase offsets. A pulse is then just a number:

```glsl
float pos = fract(uT * n + offset);
float d = arc - pos;
d -= floor(d + 0.5);          // wrap, so a pulse runs off the tip and
                              // reappears at the soma with no seam
float glow = amp * exp(-(d * d) / (2.0 * sigma * sigma));
```

No geometry moves, nothing is created or destroyed, and a branch carries up to
three pulses at once. Arc length is normalised per primary dendrite, so a
single pulse fans out through the whole sub-tree the way a real signal front
does.

The same per-vertex junction-proximity attribute drives look 5's steady nodes,
look 4's flashes, and look 3A's flare as a pulse crosses a junction.

### Camera

The camera moves on a closed Lissajous path with integer frequencies. It is
**not** flown forward through the network: a forward fly-through cannot loop
without a visible wrap, and building a spatially periodic dendrite field to
avoid that costs far more than it is worth. Amplitudes give parallax, not
travel. The neurons themselves are static apart from their glow.

### Post chain

`DepthOfField → Bloom → ToneMapping (AgX) → grain/dither`, at
`HalfFloatType` so bloom and tone mapping have headroom.

Depth of field is authored **in world units** (`focusWorld`,
`focusRangeWorld`) and converted against the camera's clip range at render
time. The effect's own parameters are normalised over that range, which makes
them meaningless to tune by hand and silently wrong whenever near/far change.

Bloom runs with a **high threshold** so only emissive elements bloom. If the
whole dendrite network glows the threshold is too low and the image turns to
mush — that is the most common failure on this subject.

Bokeh kernels are measured in texels, so the same `bokehScale` is half as soft
at 4K as at 1080p. It is scaled by frame height, so a 4K render matches the
1080p preview instead of being twice as sharp.

### Banding

Dark blue gradients under bloom are the worst case for 8-bit H.264, and most of
these compositions are exactly that.

- The background gradient dithers itself, before tone mapping.
- A final pass adds **film grain plus a sub-code-value dither after bloom**,
  where the smooth ramps are created, and after tone mapping, where values are
  actually quantised to 8 bits. Both terms are a hash of pixel coordinate and
  frame index — never `Math.random()` — and the frame index is fed in as
  `frame % 600`, so the grain is identical at frame 0 and frame 600.
- Both terms are **gated on luminance**, so a look whose background is meant to
  be pure black encodes as pure black rather than being lifted off zero. This
  is what lets look 6 satisfy both the grain requirement and its true-black
  corners.

**Verify on the encoded mp4, not the preview.** `node scripts/verify-output.mjs
out/video` extracts frames from the encoded files and reports the longest run
of an identical code value along horizontal and vertical scanlines; stepped
plateaus mean banding. If bands survive, raise grain toward 2.5% and then lower
CRF toward 14.

### Look 6 is pure black

`FibrousField_Blue` must encode true black in the corners away from any fibre.
The background's outer colour is `#000000` and the grain gate leaves it at
zero. `scripts/verify-output.mjs` reports `cornerMax` per file; for look 6 it
must be `0`. If compression has lifted it, raise the bitrate (lower CRF).

---

## Determinism

Remotion renders frames out of order across several threads, so **every value
on screen is a pure function of `useCurrentFrame()`**.

- No `useFrame` clock, no `Date.now()`, no delta accumulation.
- No `Math.random()` at render time. A `mulberry32` is seeded per look and
  every value — branch directions, angles, radii, branch decisions, pulse
  offsets and counts, particle paths, soma displacement — is drawn once at
  build time.
- The dendrite structure is generated once and cached at module level, never
  rebuilt per frame.
- No mutable state between frames, no per-frame ref mutation, no `useState`
  driving visuals.

One subtlety: **the loop period is a project constant, not
`useVideoConfig().durationInFrames`.** They are the same number in normal use,
but the loop-closure check renders frame 600 from a composition temporarily
extended to 601 frames — if the period came from the composition it would
change to 601 under the test and frame 600 would no longer land on zero.

---

## Verification

```bash
node scripts/verify-loop.mjs      # loop closure + determinism, all 11
node scripts/verify-output.mjs out/video   # encoded-file checks
node scripts/stats.mjs            # branch/segment/draw-call counts
```

`verify-loop.mjs` temporarily extends each composition to 601 frames, renders
frames 0 and 600, and requires them to be byte-identical; then renders frame
300 alone and as part of a sequence and requires those to match too.

If loop closure fails, check in this order: pulse traversal counts (all
integers), junction flash frequencies, camera Lissajous frequencies, camera
roll, particle paths, grain (`frame % 600`).

---

## Performance

Measured in this project's environment: 4 CPU cores, **no GPU**, headless
Chromium on software GL (ANGLE). A machine with a real GPU will be far faster.

Per-frame timings are written to `out/render-timings.json` by
`scripts/render-all.mjs`. See **Report** in the delivery notes for the measured
figures and the 4K estimate.

Geometry counts per composition come from `node scripts/stats.mjs`. The number
that matters is **draw calls per frame: 3–4 for every composition** —
background, merged tubes, merged somas, and particles or sparks where a look
uses them. Everything else is a post pass. If that number were in the hundreds,
the branch merging did not happen and a 4K render would be far slower than it
needs to be.

One notable cost: `dpr` follows `window.devicePixelRatio` rather than being
pinned to 1. Remotion's `--scale` is a browser device-scale factor, and
react-three-fiber would otherwise clamp `dpr` to at least 1 and allocate a full
3840×2160 backing store for a 1080p render — four times the pixels for the same
output. Fixing that alone cut render time by roughly 3.5×.

---

## Notes

- These are **stylised, not anatomically accurate**. No brain region, cell type
  or condition is named anywhere in the project.
- No text, watermark, logo or brand marks.
- Bloom is spatial and required. **Forbidden:** TAA, temporal motion blur,
  temporally-denoised SSAO, or anything that accumulates across frames.
- WebGL2, not WebGPU — WebGPU is unreliable in headless Chromium and nothing
  here needs a compute pass.
