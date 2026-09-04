# Data Rack Curtains

A looping 3D motion graphic: aisles of tall dotted panels standing in a hazy
blue space like server racks, with shafts of light falling between them and the
camera drifting slowly on a closed path.

Two versions share the same geometry and motion:

| Composition ID           | Look             |
| ------------------------ | ---------------- |
| `V1-RackCurtainsCyan`    | Cyan / blue      |
| `V2-RackCurtainsMagenta` | Magenta / violet |

Both are defined at **3840x2160, 30fps, 300 frames (10s)** and loop seamlessly.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are authored at 4K, so a full-size render needs no changes:

```bash
npx remotion render V1-RackCurtainsCyan    out/V1_RackCurtainsCyan.mp4    --scale=1 --crf=16
npx remotion render V2-RackCurtainsMagenta out/V2_RackCurtainsMagenta.mp4 --scale=1 --crf=16
```

For a 1080p preview, add `--scale=0.5`.

Stills:

```bash
npx remotion still V1-RackCurtainsCyan out/V1_RackCurtainsCyan.png --frame=90 --scale=1
```

### Chromium GL flag

The scene is WebGL, so the headless browser needs a real GL backend.
`remotion.config.ts` already sets it:

```ts
Config.setChromiumOpenGlRenderer("angle");
```

`angle` uses the GPU when one is available and falls back to SwiftShader
(software) when it isn't. To pass it on the command line instead, use
`--gl=angle`. On a machine with no GPU, `--gl=swiftshader` is equivalent but
slower.

### Measured render time

Measured on a 4-core Intel Xeon @ 2.80GHz, 15 GB RAM, **no GPU** - so Chromium
fell back to SwiftShader (software GL) and Remotion chose a concurrency of 2:

| Composition | Output          | 300 frames | Per frame  |
| ----------- | --------------- | ---------- | ---------- |
| V1 cyan     | 1080p (`--scale=0.5`) | 6m 30s | **1.30 s** |
| V2 magenta  | 1080p (`--scale=0.5`) | 6m 42s | **1.34 s** |

Note that the composition is 4K, so a `--scale=0.5` render still shades every
frame at 3840x2160 and downsamples - which is where the supersampled edge
quality comes from, and most of the cost. A machine with a real GPU (ANGLE
picking it up instead of SwiftShader) is dramatically faster; a 4K render on
this same box would be roughly 4x the per-frame figures above.

## How it works

- **Panels** are one instanced draw call. The dot grid is evaluated in a
  fragment shader from the panel's instance id rather than drawn into canvas
  textures, so the dots stay resolution-independent (1080p and 4K read
  identically) and there are no per-frame texture uploads.
- **Depth of field** is bucketed per instance (`DOF_BUCKETS`, default 5) from
  view-space depth: a sharp band in the mid-distance softening toward the
  camera and into the far aisles. Bucketing per instance rather than per
  fragment keeps a panel from carrying a blur gradient across its own face.
- **Bloom** is a `backdrop-filter` pass that blurs what has already been drawn
  and screens it back over the top, with a contrast step first so the glow
  gathers on the bright dots and shafts instead of lifting the whole frame.
  That avoids a second WebGL render.
- **Light shafts** are stacked transparent planes with a soft gradient, yawed
  to face the camera - far cheaper than a true volumetric pass and, at this
  softness, indistinguishable.
- **Looping.** The camera path and every pattern state is a pure function of
  `useCurrentFrame()` - no `useFrame` clock and no delta accumulation, since
  Remotion renders frames out of order across threads. Time reaches the shaders
  as `uTime`, running 0 -> 1 across the composition; `fract()` terms advance by
  whole cycles and `sin()` terms use integer frequencies, so frame 300
  reproduces frame 0 exactly. Panel brightness clustering and pattern seeds come
  from a seeded mulberry32 PRNG.

Tunables (grid size, spacing, dot density, focus distance) live in
`src/constants.ts`; the two palettes are in `src/palette.ts`.
