# Satin Fabric Folds

Three seamlessly looping 4K satin textures, built in [Remotion](https://remotion.dev)
with `@remotion/three` / react-three-fiber.

| Composition id     | Delivery name          | Look                    |
| ------------------ | ---------------------- | ----------------------- |
| `V1-SatinCharcoal` | `V1_SatinCharcoal.mp4` | Charcoal / blue-grey    |
| `V2-SatinCrimson`  | `V2_SatinCrimson.mp4`  | Deep crimson            |
| `V3-SatinIvory`    | `V3_SatinIvory.mp4`    | Ivory / pearl           |

All three are **3840x2160, 30 fps, 600 frames (20 s)** and loop perfectly.

## Quick start

```console
npm install
npx remotion studio
```

## Rendering at 4K

`--crf=14` is lower than you would normally reach for. That is deliberate: this
piece is nothing but huge, smooth, near-black gradients, which is the worst case
H.264 has. If you still see stepping in the troughs, lower the CRF further rather
than reducing the grain.

```console
npx remotion render V1-SatinCharcoal out/V1_SatinCharcoal.mp4 --scale=1 --crf=14
npx remotion render V2-SatinCrimson  out/V2_SatinCrimson.mp4  --scale=1 --crf=14
npx remotion render V3-SatinIvory    out/V3_SatinIvory.mp4    --scale=1 --crf=14
```

Stills:

```console
npx remotion still V1-SatinCharcoal out/V1_SatinCharcoal.png --frame=90 --scale=1
```

### Chromium GL flag

Headless Chromium needs an OpenGL backend before it will give Remotion a WebGL
context. `remotion.config.ts` sets `angle`, which is the right choice on a machine
with a GPU. On a headless box **without** a GPU, override it per call:

```console
npx remotion render V1-SatinCharcoal out/V1_SatinCharcoal.mp4 --scale=1 --crf=14 --gl=swangle
```

`swangle` is ANGLE over SwiftShader: it works with no GPU at all, and is markedly
slower.

### Measured per-frame render time

Measured in this project's own container: 4 workers, no GPU, `--gl=swangle`
(ANGLE over SwiftShader). A machine with a real GPU and `--gl=angle` will be
substantially faster.

| Run                                  | Per frame | 600 frames |
| ------------------------------------ | --------- | ---------- |
| `--scale=0.5` (1080p preview)        | 1.53 s    | ~15 min    |
| `--scale=1` (4K)                     | ~1.83 s   | ~18 min    |

The two are closer than the 4x pixel ratio suggests, and the reason is worth
knowing before you plan a 4K run: **`--scale` does not change the resolution
the WebGL canvas renders at.** The canvas is always the composition size,
3840x2160; `--scale` only downsamples the screenshot Remotion takes of it.

Verified three ways on a matched frame: the 1080p output matches a 2x2 box
downsample of the 4K render to within 0.476/255; their per-pixel deltas are
identical (1.967 vs 1.967, against 3.423 for native 4K); and the weave detail
still contributes at 1080p, which it could not if the canvas were 1080p and
the sampling guard had zeroed it.

Two consequences:

- The 1080p previews are effectively 4x supersampled, so they are cleaner
  than a native 1080p render would be.
- Going from the preview to 4K costs only the extra H.264 encoding, not extra
  shading. Almost all of the difference above is x264 on 4x the pixels.

## How it works

The fabric is a single heavily subdivided plane. Everything else is the material.

- **`src/shader/field.ts`** is the height field: a set of directional waves whose
  wave vectors run mostly *across* the fold axis, so their crests are elongated
  ridges lying *along* it. A two-component low-frequency **domain warp** displaces
  position (not phase), which is what turns parallel corrugations into the curving,
  gathering folds of draped cloth. Separate spatial envelopes give broad flat folds
  in the upper region and tighter gathered ones toward the lower left.
- Every term returns its **analytic gradient** alongside its value, so shading
  normals are exact. Normals differenced from a displacement texture stair-step,
  and on a specular surface that shows up immediately as banded highlights.
- **`src/shader/material.ts`** shades it with an **anisotropic GGX** lobe whose
  tangent follows the fold axis. Roughness along the tangent is much higher than
  across it, which stretches the highlight into a long streak down each crest
  instead of a round hotspot. A sheen term adds the fabric rim response.
- Lighting is a low grazing key from the upper left plus a dim cool fill from the
  opposite side. The low key angle is what makes shallow relief throw long
  highlights. There is no environment map, so nothing recognisable can be
  reflected in the satin.
- **Looping:** every temporal phase is an integer multiple of `2*pi*t` with
  `t = frame / durationInFrames`, so frame 600 is identical to frame 0. All phases
  are pure functions of `useCurrentFrame()` -- Remotion renders frames out of
  order across threads, so no clock or delta accumulation is involved anywhere.
- The camera is completely locked. No drift, no push.

## Project layout

```
src/
  index.ts              registerRoot
  Root.tsx              the three compositions
  palettes.ts           per-version colour, lighting and material settings
  SatinFabric.tsx       canvas, camera, geometry, uniforms
  shader/field.ts       height field + analytic gradients (shared vert/frag)
  shader/material.ts    vertex displacement and the anisotropic shading
remotion.config.ts
```
