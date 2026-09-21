# Virus Particle Field — ten looks

Ten compositions from one rig. A field of spiked particles drifting and
rotating slowly in depth, heavy depth-of-field, each look a different palette,
spike morphology and background treatment.

Compositions are defined at **3840×2160, 30fps, 600 frames (20s)**. The
previews in `out/` are rendered at `--scale=0.5`, giving 1920×1080.

---

## Quick start

```bash
npm install
npx remotion studio
```

Composition ids are `VirusField-<LookId>` (hyphen — Remotion does not allow
underscores in ids). Output filenames use underscores.

| # | Composition id            | Output file                    |
|---|---------------------------|--------------------------------|
| 1 | `VirusField-PaleMint`     | `VirusField_PaleMint.mp4`      |
| 2 | `VirusField-LimeSun`      | `VirusField_LimeSun.mp4`       |
| 3 | `VirusField-PastelMulti`  | `VirusField_PastelMulti.mp4`   |
| 4 | `VirusField-DeepNavy`     | `VirusField_DeepNavy.mp4`      |
| 5 | `VirusField-ElectricBlue` | `VirusField_ElectricBlue.mp4`  |
| 6 | `VirusField-BloodField`   | `VirusField_BloodField.mp4`    |
| 7 | `VirusField-BlackCyan`    | `VirusField_BlackCyan.mp4`     |
| 8 | `VirusField-BokehDark`    | `VirusField_BokehDark.mp4`     |
| 9 | `VirusField-GlowBlue`     | `VirusField_GlowBlue.mp4`      |
| 10| `VirusField-AmberHorizon` | `VirusField_AmberHorizon.mp4`  |

---

## Rendering

### 4K video, per composition

```bash
npx remotion render VirusField-PaleMint out/VirusField_PaleMint.mp4 \
  --scale=1 --crf=16 \
  --gl=angle --image-format=png --muted \
  --codec=h264 --pixel-format=yuv420p --concurrency=4
```

### 1080p preview

Same command with `--scale=0.5`.

### Flags that matter

- **`--gl=angle`** — headless Chromium needs an explicit GL backend. On a
  machine with no usable GPU this falls back to SwiftShader automatically,
  which works but is much slower. `--gl=swangle` and `--gl=swiftshader`
  measured identically here.
- **`--muted`** — without it Remotion writes a silent AAC track. The spec for
  these files is video-only, and this is the right place to fix that rather
  than stripping the track afterwards.
- **`--image-format=png`** — the project's `remotion.config.ts` sets `jpeg`
  for other compositions. These are large smooth gradients and a JPEG
  intermediate adds blocking on top of the banding risk.
- **`--scale`** sets the browser's device pixel ratio, and `VirusScene` passes
  that ratio straight through to react-three-fiber. See *Performance* below —
  this matters more than it looks.

### Stills

```bash
npx remotion still VirusField-PaleMint out/stills/PaleMint_f080.png \
  --frame=80 --scale=1.5625 --gl=angle
```

`--scale=1.5625` against the 3840-wide composition gives **6000×3375**. Each
look's three chosen frames are in its data row as `stillFrames`; they are
picked where the field composes well and are far enough apart that the three
read as different images.

---

## Measured render time

Measured on this machine: 4 vCPU Intel Xeon @ 2.80GHz, 15GB RAM, **no GPU** —
Chromium falls back to software WebGL. A machine with a real GPU will be very
much faster and these numbers are close to a worst case.

| Target                  | Per frame (wall, `--concurrency=4`) | 600 frames | All ten |
|-------------------------|-------------------------------------|------------|---------|
| 1080p (`--scale=0.5`)   | **≈3.5s**                           | ≈35 min    | ≈5.8 h  |
| 4K (`--scale=1`)        | ≈14s (extrapolated, ×4 pixels)      | ≈2.3 h     | ≈23 h   |
| 6000×3375 still         | ≈34s                                | —          | ≈17 min for 30 |

The 4K figure is extrapolated from the 1080p measurement by pixel count, which
held well across the scales actually measured.

### Performance note

react-three-fiber clamps its `dpr` prop to `[1, 2]` by default. Remotion's
`--scale` works by setting the browser's device pixel ratio, so at
`--scale=0.5` the ratio of 0.5 was being clamped back up to 1 and a 4K
composition still drew a full 3840×2160 buffer, three quarters of which was
thrown away on the downscale. `VirusScene` passes `window.devicePixelRatio`
explicitly. That alone took a 1080p frame from 17.2s to 5.5s; rendering the
bokeh and bloom buffers at half resolution took it to 3.5s.

Depth of field is by far the most expensive pass — around 90% of frame cost
under software WebGL. If you need to trim further, `resolutionScale` on
`<DepthOfField>` in `src/virus/VirusField.tsx` is the first dial to reach for.

---

## Adding an eleventh look

One data row in `src/virus/data/looks.ts`. No code change.

Copy an existing entry and change:

- **`id` / `name` / `seed`** — the seed drives every per-particle draw, so
  changing it reshuffles the whole field.
- **`background`** — `radial`, `vertical` or `flat`, two or three colours, the
  gradient centre and falloff, and the dither amplitude.
- **`particles`** — count, radius range, depth range, spread, spikes per
  particle, and the hero's scale, position and depth.
- **`spike.archetype`** — one of `stalk-knob`, `club`, `stalk-teardrop`,
  `cluster`, `mushroom`, `trumpet`, `stub-cone`, plus `scale`, `stalkScale`
  and `capScale`.
- **`colorways`** — one entry for a single-colour field, several (with
  weights) for a mixed one. Each gives a core, stalk and cap colour.
- **`core`** — displacement and the mottle ramp. Low `mottleFreq` with a wide
  `mottleDark`/`mottleLight` spread marbles; high frequency with a narrow
  spread speckles.
- **`post`** — `focusRange` and `bokehScale` are the blur strength;
  `focusDistance: 0` puts the focus plane on the hero automatically.
- **`stillFrames`** — three frames for the stills harvest.

Optional blocks: `flare`, `specks`, `bokeh`, `capAccent`, `rimGlow`.

The new composition registers itself — `src/virus/Root.virus.tsx` maps over
`LOOKS`.

---

## Look 7 is a screen-blend overlay

`VirusField_BlackCyan.mp4` is built on a true `#000000` background so it can
be dropped over other footage with a screen or add blend. To keep the black at
exactly zero in the encoded file, that look alone runs with **dither off and
grain off**, and its bloom threshold is high enough that nothing bleeds into
the corners. There is no gradient in it to band, so it loses nothing.

Its reference clip actually carries a faint navy ambient haze and some dust.
That is deliberately not reproduced — the pure-black requirement wins.

---

## Verifying a render

### 1. Container

```bash
npx remotion ffprobe -v error \
  -show_entries stream=codec_type,width,height,r_frame_rate \
  -show_entries format=duration \
  -of default=noprint_wrappers=1 out/VirusField_PaleMint.mp4
```

Expect 1920×1080 (or 3840×2160 at `--scale=1`), `30/1`, duration `20.0`,
`h264`, `yuv420p`, and **no audio stream**.

For look 7, also sample corner pixels away from any particle and confirm they
are `0,0,0`. If compression has lifted the black, lower the CRF.

### 2. Loop closure

A 600-frame seamless loop means **frame 600 equals frame 0**, not frame 599.
Comparing 0 to 599 shows a one-step difference and is not a failure.

The motion period is the constant `LOOP_FRAMES` in `src/virus/loop.ts`, kept
separate from the composition's `durationInFrames` precisely so this test
works: extend the composition to 601 frames and frame 600 still lands on
`t = 1`.

```bash
# in src/virus/Root.virus.tsx, temporarily:
#   export const VIRUS_DURATION = LOOP_FRAMES + 1;
npx remotion still VirusField-PaleMint /tmp/f000.png --frame=0   --gl=angle
npx remotion still VirusField-PaleMint /tmp/f600.png --frame=600 --gl=angle
sha256sum /tmp/f000.png /tmp/f600.png   # must match
```

If it fails, check in this order: particle rotation counts (all integers),
Lissajous frequencies (all integers), the dust and bokeh drift, then the grain
(must be fed `frame % LOOP_FRAMES`). One fractional rotation on one small
background particle will fail this.

### 3. Determinism

```bash
npx remotion render VirusField-PaleMint /tmp/seq --sequence \
  --frames=280-300 --gl=angle --image-format=png --concurrency=1
npx remotion still VirusField-PaleMint /tmp/alone.png --frame=300 --gl=angle
sha256sum /tmp/seq/element-300.png /tmp/alone.png   # must match
```

A difference means something is reading state that depends on render order.

### 4. Banding

Check the **encoded mp4**, not the studio preview — the preview will look clean
when the encoded file does not. Extract a PNG and inspect the background along
a horizontal and a vertical scanline; stepped plateaus mean banding.

If bands survive, raise `post.grain` on that look toward 0.025, then lower CRF
toward 14. Do not flatten the gradient to hide it.

---

## How the rig works

```
src/virus/
  loop.ts              LOOP_FRAMES — the motion period
  data/types.ts        LookSpec: the contract between data and rig
  data/looks.ts        the ten rows. Pure data, no logic
  lib/rng.ts           mulberry32 + helpers
  lib/noise.ts         seeded 3D simplex + fbm
  lib/geometry.ts      core icosphere, the spike archetypes, Fibonacci placement
  lib/field.ts         build-time particle table
  Background.tsx       gradient, flare and dither, in a shader
  Sprites.tsx          dust specks and background bokeh discs
  Grain.tsx            deterministic film grain as a post effect
  VirusField.tsx       camera, lights, instancing, motion, post chain
  VirusScene.tsx       Remotion composition entry
  Root.virus.tsx       registers one composition per look
```

**Geometry.** Cores are icospheres, not UV spheres — a UV sphere pole-pinches
and the spike distribution shows it. The sphere is indexed before being
displaced so recomputed normals come out smooth; on the non-indexed geometry
three hands back, `computeVertexNormals` gives per-face normals and the
silhouette reads as faceted. Spikes are placed on a Fibonacci spiral, which is
even without being gridded and needs no RNG, and each is seated against the
*displaced* surface radius so no gap opens where a spike meets a dent.

**Instancing.** One `InstancedMesh` per spike part across the entire field, not
one per particle. A field of 40 particles × 90 spikes is 3,600 spikes; as
individual meshes that is 3,600 draw calls. As three instanced meshes (core,
stalk, cap) it is three. Per-instance colour carries the colourways.

**Surface character.** The core geometry carries an `aMottle` attribute that a
patched `MeshStandardMaterial` ramps into a brightness multiplier. One
mechanism covers both the fine speckle of looks 6, 8 and 10 and look 5's
black-and-white marbling — the difference is the width of the ramp, which is a
data-row value.

**Determinism.** Remotion renders frames out of order across threads, so every
value on screen is a pure function of `useCurrentFrame()`. Every per-particle
value — position, axis, frequencies, phases, size jitter, colourway — is drawn
once at build time from a `mulberry32` seeded from the look's `seed`. Instance
matrices are recomputed from `frame` each time and never advanced from the
previous frame. No `useFrame` clock, no `Date.now()`, no `Math.random()` at
render time, no springs or solvers, no state between frames.

**The loop closes by construction.** Each particle travels a closed Lissajous
path with integer frequencies and rotates a whole number of turns over
`LOOP_FRAMES`, so everything returns exactly to its start at `t = 1`. The grain
is fed `frame % LOOP_FRAMES` so frame 600 gets frame 0's grain.

**Post chain.** Depth of field → bloom → ACES tonemapping → grain. All spatial.
Nothing temporal: no TAA, no motion blur, no accumulating AO. Drei's
`AccumulativeShadows` is deliberately not used — it accumulates across frames
and would give different results per frame under out-of-order rendering.

**Shadows.** PCSS soft shadows were tried and removed. Nothing in these scenes
casts or receives a shadow map, the references show no pronounced cast shadows
between particles, and the pass was pure cost under software WebGL. Form comes
from the three-light rig instead.

---

## Notes on the content

These are stylised scientific illustrations. They are not accurate depictions
of any specific pathogen and are not labelled as one anywhere in the project.
No text, watermark, logo or brand mark appears in any frame.
