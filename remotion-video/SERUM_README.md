# Serum Molecules & Bubbles

Twelve seamless-loop compositions of translucent spheres in soft studio light,
built as one Remotion + three.js template. Six looks; several ship in more than
one colourway.

Compositions are defined at **3840x2160, 30fps, 16:9**. Looks 1-4 and 6 are
**300 frames (10s)** seamless loops. Look 5 is **600 frames (20s)** and is
**not a loop** — it is a beauty pass followed by its own luma matte.

---

## The twelve compositions

| Composition id | Output name | Look | Frames |
|---|---|---|---|
| `Molecule-Lavender` | `Molecule_Lavender` | 1 — Molecule Chain | 300 |
| `Molecule-Blue` | `Molecule_Blue` | 1 — Molecule Chain | 300 |
| `Molecule-Gold` | `Molecule_Gold` | 1 — Molecule Chain | 300 |
| `GiantSphere-Champagne` | `GiantSphere_Champagne` | 2 — Giant Sphere Cluster | 300 |
| `GiantSphere-Lilac` | `GiantSphere_Lilac` | 2 — Giant Sphere Cluster | 300 |
| `CandyBlob-Rose` | `CandyBlob_Rose` | 3 — Candy Blob | 300 |
| `CandyBlob-Orange` | `CandyBlob_Orange` | 3 — Candy Blob | 300 |
| `BubbleField-Pink` | `BubbleField_Pink` | 4 — Fine Bubble Field | 300 |
| `BubbleField-Blue` | `BubbleField_Blue` | 4 — Fine Bubble Field | 300 |
| `IridescentRise-Pink` | `IridescentRise_Pink` | 5 — Iridescent Rise **+ matte** | 600 |
| `GoldenOil-Amber` | `GoldenOil_Amber` | 6 — Golden Oil Cluster | 300 |
| `GoldenOil-Olive` | `GoldenOil_Olive` | 6 — Golden Oil Cluster | 300 |

Composition ids use hyphens because Remotion rejects underscores in ids; the
delivered file names use underscores.

---

## Rendering

### 4K master, one composition

```bash
npx remotion render <id> out/<name>.mp4 --scale=1 --crf=16
```

for example

```bash
npx remotion render GoldenOil-Amber out/GoldenOil_Amber.mp4 --scale=1 --crf=16
```

### 1080p preview

Compositions are defined at 4K, so previews come from the same composition at
half scale:

```bash
npx remotion render <id> out/<name>.mp4 --scale=0.5 --crf=16
```

### Stills

```bash
npx remotion still <id> out/<name>.png --frame=<frame> --scale=1.5625
```

`--scale=1.5625` takes the 3840x2160 composition to **6000x3375**. The frame
chosen for each composition's headline still is stored in its data row
(`stillFrame`), with three harvest frames in `stillFrames` — see
`src/serum/looks.ts`.

### Headless Chromium

This project renders through WebGL, so Chromium needs a GL backend:

```bash
npx remotion render <id> out/<name>.mp4 --gl=angle
```

`--gl=angle` is the right choice on a machine with a GPU. Without one, ANGLE
falls back to SwiftShader, which works but is much slower — see the measured
timings below. Add `--concurrency=4` (or your core count); on software
rendering this was worth roughly a 3x speed-up over the default.

---

## Measured render cost

Transmission is the most expensive material in three.js: the scene behind every
transmissive surface is re-rendered into a backdrop buffer each frame. Look 6 is
the heaviest by a distance, because frame-filling spheres in contact mean almost
every pixel is seen through several transmissive surfaces at once.

Measured on the build machine — **4 vCPU, no GPU, SwiftShader software
rendering**. A machine with a real GPU will be very substantially faster; treat
these as a worst case, not a target.

<!--TIMINGS-->

The 4K estimate is the 1080p figure scaled by the 4x pixel count. It is close to
linear here because these scenes are fragment-bound.

If per-frame cost is a problem, the order to attack it in:

1. **Lower the backdrop buffer.** `TRANSMISSION_RESOLUTION_SCALE` in
   `src/serum/Scene.tsx` (currently `0.3`) sets the transmission buffer as a
   fraction of the viewport. This is the biggest single saving and these scenes
   are far too blurred to show the difference.
2. Reduce element counts in `src/serum/build.ts`.
3. Only then consider dropping look 6 to 150 frames.

Measured on this machine, backdrop buffer resolution made almost no difference
(512 vs 256 vs 1024 were within 3% of each other) because the 1080p main render
dominated — so on a GPU, step 1 will matter more than it did here.

---

## Adding a colourway

A colourway is **one data row**. Open `src/serum/looks.ts` and add an entry to
`LOOKS` using the helper for that look:

```ts
moleculeRow('Molecule-Rose', 'Molecule_Rose', 1104, '#c85f8a', 3.3, '#b8547e'),
```

The arguments are the composition id, the output name, a seed, the attenuation
colour, the attenuation distance and the internal-bubble core colour.

Colourways of a look share a `geometrySeed`, so the new row has **identical
geometry and motion** to its siblings and differs only in colour. That is
deliberate — it is what makes a colourway free. Nothing else needs touching:
`src/serum/Root.serum.tsx` registers whatever is in `LOOKS`.

---

## How it is built

```
src/serum/
  random.ts            mulberry32 + seeded helpers
  types.ts             the LookRow data model
  looks.ts             the twelve data rows
  build.ts             build-time geometry for all six modes
  blob.ts              marching-cubes fused blob (look 3)
  geometry.ts          smooth-normal icospheres
  motion.ts            closed-form Lissajous drift + integer-turn rotation
  Background.tsx       shader gradient with dither
  BubbleMaterial.tsx   internal bubbles (Fresnel, inverted lensing)
  iridescence.ts       thin-film thickness map (look 5)
  Grain.tsx            deterministic film grain
  env.ts               studio HDRI, decoded at module level
  Scene.tsx            the fixed rig
  SerumComposition.tsx composition entry point
  Root.serum.tsx       registers every row in LOOKS
```

### Determinism

Remotion renders frames out of order across several threads, so every value on
screen is a pure function of `useCurrentFrame()`.

- A `mulberry32` is seeded at **module level**; every per-element value —
  position, axis, frequencies, phases, sizes, inner-bubble layout, cluster
  topology, film thickness — is drawn **once, at build time**, outside the
  render path.
- No `useFrame` clock, no `Date.now()`, no delta accumulation, no
  `Math.random()` at render time, no physics or spring integrator.
- Marching-cubes blob meshes are generated once, never per frame.
- The film grain is a hash of `(pixel, frame % durationInFrames)` — periodic
  over the loop, so frame 300 gets frame 0's grain.

**This project deliberately does not use drei's `MeshTransmissionMaterial`.**
It renders the scene into its own framebuffer inside `useFrame` and keeps that
buffer between frames; frame 150 rendered cold then differs from frame 150 of a
sequential render, which fails the determinism requirement outright. three's
built-in transmission rebuilds its backdrop from the opaque objects every frame
and holds no state, so it passes — and it is cheaper, because it is one shared
pass for every transmissive material rather than one per instance.

The trade is that transmissive objects are excluded from each other's backdrop,
so the hero spheres refract the approximated layers rather than one another.
Those layers are stateless and are what carry the depth cues — look 6's packed
back mass is what its foreground spheres bend into the dark lens shapes.

### The loop

Each element travels a small **closed Lissajous path** with integer frequencies
(1-3) and amplitudes of 10-20% of its own diameter, and rotates about a fixed
axis by an **integer number of full turns**. Both return exactly to their start
at `t = 1`. Nothing translates-and-wraps at the frame edge, because that pops.

Look 6's amplitudes are much smaller (3-5% of sphere diameter): packed spheres
in contact cannot drift far without interpenetrating, so its rotation carries
the movement instead.

### Look 5's matte

`IridescentRise-Pink` is one 600-frame composition:

- **frames 0-299** — beauty pass on the pink field
- **frames 300-599** — the identical animation as **solid black shapes on pure
  white**, so the bubbles can be keyed over other footage

Both halves are driven by the same motion frame and the same seeded values, so
the matte lines up with the beauty pass frame for frame. This composition is
**not a loop** and must not be keyworded as one.

### Banding

Large smooth pastel gradients across a 4K frame are a bad case for 8-bit H.264.
Two defences: the background shader dithers the gradient by ±1 LSB in linear
space before tonemapping, and a deterministic grain pass adds 1.8-2.2% noise
over the whole frame after tonemapping. Look 5's matte half gets neither.

To verify, extract a PNG from the **encoded mp4** -- not the studio preview,
which will look clean when the encoded file does not:

```bash
npx remotion ffmpeg -i out/BubbleField_Pink.mp4 -ss 5 -frames:v 1 -y check.png
```

and inspect the background along a horizontal and a vertical scanline. Stepped
plateaus mean banding.

### Measured result, and a limit worth knowing

Sampling a pure-background region of look 1 and measuring the mean length of
runs of identical value along a scanline:

| Source | mean run | longest run | reading |
|---|---|---|---|
| Rendered PNG (lossless) | 2.3-3.4 px | 34-41 px | properly dithered |
| Encoded mp4, CRF 16, grain 2.0% | 6.3-6.8 px | 156-425 px | flattened |
| Encoded mp4, CRF 14, grain 3.5% | 4.2-8.7 px | 159-443 px | mildly flattened |

**The render itself is clean.** The dither and grain are present and
pixel-to-pixel at the point the frame leaves three.js. What flattens them is
x264: in smooth areas its deblocking filter and psychovisual quantisation
remove sub-LSB noise. Both remedies in the brief were tried and measured --
CRF lowered to 14 and then 12, grain raised to 3.5% -- and each helped only
marginally, because the limit is the deblocking filter rather than the
quantiser.

The lever that would actually fix it is x264's `tune=grain` (or a negative
`deblock` setting), and Remotion's CLI does not expose x264 parameters. If
banding is visible in your delivery, render an image sequence and encode it
yourself with that tuning:

```bash
npx remotion render <id> out/seq --sequence --image-format=png --scale=1
npx remotion ffmpeg -framerate 30 -i out/seq/element-%d.png \
  -c:v libx264 -crf 14 -tune grain -pix_fmt yuv420p out/<name>.mp4
```

Do not flatten the gradient to hide it.

---

## Known limitations

### Spheres do not refract one another

In the reference clips, where two spheres overlap you can see the rear one
through the front one, distorted by it. In these compositions a hero sphere in
front **occludes** the one behind instead.

This is a direct consequence of the determinism requirement, and it is worth
understanding before trying to "fix" it:

- three's transmission builds its backdrop from the **opaque** objects only, so
  transmissive objects are excluded from each other's backdrop by design.
- drei's `MeshTransmissionMaterial` would give inter-sphere refraction, but it
  keeps its framebuffer between frames. Frame 150 rendered cold then differs
  from frame 150 of a sequential render -- it fails the determinism check
  outright, and Remotion renders frames out of order across threads.
- Alpha-blending the hero layer to fake the see-through was tried and reverted.
  Transmission already outputs the transmitted background, so blending it again
  double-counts and washes the frame out.

What the spheres *do* refract is the background and the approximated layers,
which is why look 6's packed back mass still produces its dark elongated lens
shapes. The approximated layers are stateless, so they stay deterministic.

If you have a GPU budget and are willing to give up frame-order independence,
the fix is one transmission material per depth group and a matching relaxation
of the determinism guarantee. Do not make that change if frames will be
rendered in parallel.

### Banding in the encoded previews

Mild, and caused by x264 rather than the render. See the banding section above
for the measurements and an encode recipe that avoids it.

---

## Credits and licence

**HDRI** — the studio environment is `studio_small` from
[Poly Haven](https://polyhaven.com/), **CC0**. It ships with the project through
the [`@pmndrs/assets`](https://www.npmjs.com/package/@pmndrs/assets) npm
package, which self-hosts it as a base64 module, so the project has no runtime
download. It is decoded once at module level in `src/serum/env.ts`.

The molecule clusters are **decorative, not real molecular structures** — the
topology is arbitrary branching and no compound is named anywhere in this
project. There is no text, watermark, logo, brand mark, product or packaging in
any composition.

---

## Completion checklist

- [ ] `npm install && npx remotion studio` works from a clean copy
- [ ] All twelve compositions appear in the studio
- [ ] `ffprobe` on each preview: 1920x1080, 30/1, h264, yuv420p, no audio stream
- [ ] Duration 10.0s (looks 1-4, 6) / 20.0s (look 5)
- [ ] Loop closure: frame 300 pixel-identical to frame 0 (temporarily set
      `durationInFrames + 1`, render both, compare, set it back)
- [ ] Determinism: frame 150 rendered alone is byte-identical to frame 150 of a
      sequential render
- [ ] Banding checked on the encoded mp4, not the preview
- [ ] Look 5's matte half samples as pure 255,255,255 and 0,0,0
- [ ] Stills exported at 6000x3375
