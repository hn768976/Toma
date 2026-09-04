# AI Brain Over Circuit Plane

A glowing brain outline built from dots and fine lines, hovering above a steeply
raked circuit/data plane, with "AI" inside it. 20 seconds, 30 fps, no loop: the
brain draws on and the scene holds.

Two versions, sharing every module and differing only in palette:

| Composition id | Version | Look |
|---|---|---|
| `V1-AIBrainPlaneBlue` | V1 | Deep blue (reference match) |
| `V2-AIBrainPlaneMono` | V2 | Silver/white monochrome, no hue |

Both compositions are **defined at 3840x2160**, so the 4K render is just a
matter of `--scale=1`. Everything in the scene is sized from `useVideoConfig()`
or in world units, so the framing is identical at any output size.

## Requirements

- Node 18+
- Nothing else: no fonts to install, no assets to fetch, no GPU required.

```bash
npm install
npx remotion studio
```

## Rendering

### 4K, the delivery render

```bash
npx remotion render V1-AIBrainPlaneBlue out/V1_AIBrainPlaneBlue.mp4 --scale=1 --crf=16
npx remotion render V2-AIBrainPlaneMono out/V2_AIBrainPlaneMono.mp4 --scale=1 --crf=16
```

Stills:

```bash
npx remotion still V1-AIBrainPlaneBlue out/V1_AIBrainPlaneBlue.png --frame=400 --scale=1
npx remotion still V2-AIBrainPlaneMono out/V2_AIBrainPlaneMono.png --frame=400 --scale=1
```

### 1080p preview

`--scale=0.5` halves the output to 1920x1080. It also halves the browser's
device pixel ratio, which the scene reads to size the WebGL buffer, so a preview
really does render at 1080p rather than rendering 4K and downsampling.

```bash
npm run render:preview
```

### Chromium GL flag (required)

The scene is WebGL, and headless Chromium will hand back black frames unless it
is told which GL backend to use. `remotion.config.ts` already sets it:

```ts
Config.setChromiumOpenGlRenderer("angle");
```

On the CLI the equivalent is `--gl=angle`. On a machine with no GPU, ANGLE falls
through to SwiftShader and renders in software — correct, just slower. `--gl=swiftshader`
forces that path explicitly. If you are rendering on a box with a GPU, `angle`
picks the hardware path and is several times faster.

### Measured render time

Measured on the machine this project was built on — 4 vCPU, **no GPU**, so every
frame went through SwiftShader:

| | 1080p (`--scale=0.5`), 600 frames |
|---|---|
| `V1-AIBrainPlaneBlue` | 303.1 s wall — **0.505 s/frame** |
| `V2-AIBrainPlaneMono` | 303.3 s wall — **0.505 s/frame** |

At `--concurrency=4` that is about 2.0 s of Chromium time per frame per tab;
the four tabs overlap to give the half-second wall figure. Encoding is not the
bottleneck — the software rasteriser is. The resulting previews are 71 MB and
76 MB at `--crf=23`.

4K has four times the pixels and is fill-rate bound in software, so budget
roughly four times the above per frame — around 30 minutes per composition on
hardware like this. That is an extrapolation from the 1080p measurement, not a
measured 4K number; the 4K render is done elsewhere.

Rendering with a real GPU, or on more cores, will be considerably faster; these
numbers are the software-rasteriser floor, not a target.

## What is in the scene

**The plane.** One 2048² tile of circuit detail, one 1024² flow tile and one
2048x1024 tile of binary rows, all generated procedurally to canvases once per
JS context (`src/plane/textures.ts`) and shared by both versions. They carry
*masks*, not colours — the plane shader multiplies each channel by a per-version
colour, which is why one generation pass serves V1 and V2.

- `detail` R/G/B: trace intensity, data-block intensity, pad-and-via mask.
- `flow` R/G: arc length along each trace, and a per-trace id. Together they let
  the shader run a travelling comet along any trace without any CPU work.
- `binary` R/G: glyph coverage and per-glyph brightness. Rows scroll by offsetting
  the sample along `u`, each row at its own speed and direction.

The tiles are drawn wrap-aware so they repeat without a seam, and the large-scale
"dense in bands, sparse elsewhere" variation is applied in the shader from world
position. That is what stops the repeat from reading as a pattern, and it also
decorrelates the pulse timing between tiles.

The far edge fades on *depth into the scene* rather than distance from the
camera. A spherical falloff projects onto a ground plane as an arc and reads as
a dome edge; depth iso-lines are horizontal and read as ordinary aerial haze.
The surface content fades out earlier than the overall brightness, because
otherwise the far mip levels average into a flat bright band that looks exactly
like a horizon.

**The brain.** A hand-authored profile silhouette — frontal pole, temporal lobe,
occipital, cerebellum, stem — smoothed through Catmull-Rom, given a two-harmonic
cortical wobble for the gyri, then sampled into points and wired to near
neighbours (`src/brain/geometry.ts`). Points pack more densely where the folds
are tight. The lateral fissure and central sulcus are placed by hand; the middle
of the profile is deliberately left clear for the "AI".

Nothing is imported from an icon set or a stock graphic, and the "0", "1" and
"AI" glyphs are drawn as geometry rather than as text, so no third-party artwork
or font licence rides along with a clip you are selling — and the output is
identical on any machine.

**Bloom.** On the brain and the contact point only, as the reference has it. The
node sprites carry their own radial falloff and clip to white, and two
screen-blended DOM halos sit over the projected positions of the brain and the
contact point. A global post-process bloom would fog the plane and swallow the
binary strings, which are most of the texture.

**Lines** are quads widened in screen space in the vertex shader, so their
thickness is a constant fraction of frame height. GL's native 1-pixel lines would
have halved in relative weight between 1080p and 4K.

## Determinism

Every element state — camera, brain, pulses, flicker, scroll, grain — is a pure
function of `useCurrentFrame()`. There is no `useFrame` clock and nothing
accumulates, because Remotion renders frames out of order across threads. Every
procedural decision runs through a seeded mulberry32 (`src/lib/random.ts`), so
the same frame is byte-identical on any machine and on any thread.

## Colour

V1 uses the reference palette directly.

V2 is specified as silver/white with "no hue". Its reference palette
(`#050607`–`#101418` background, `#3a4048` traces, `#6a727c` blocks, `#9aa4ae`
binary) is a *cool* grey, and rendering it leaves a measurable blue cast — the
mean blue channel sits several levels above red. `src/theme.ts` uses those same
values converted to their Rec.709 luma equivalents instead: identical tonal
design, genuinely neutral. Verified on the encoded output:

```bash
npm run check:neutral    # asserts R === G === B on every pixel
```

If you would rather have the literal cool-grey hexes, the originals are in the
comment above `V2_MONO`.

## Grain and banding

Grain is a seeded 256² tile, repositioned every frame, at about 2% — see
`GRAIN_OPACITY` in `src/scene/Overlays.tsx`. Because an `overlay` blend does
almost nothing on near-black, the plane shader *also* dithers by ±0.35 of a code
value before the 8-bit write; without that, the long falloff into the far dark
bands badly once it has been through H.264.

To check an encoded file:

```bash
ffmpeg -i out/V1_AIBrainPlaneBlue.mp4 -vf "select=eq(n\,400)" -vframes 1 /tmp/frame.png
node scripts/check-banding.mjs /tmp/frame.png
```

It walks columns through the dark falloff and measures the longest run of a
single luma value. A dithered gradient breaks into short runs; a banded one holds
a value for tens of rows.

## Layout

```
src/
  config.ts              composition size, fps, duration, motion beats
  theme.ts               the two palettes
  AIBrainPlane.tsx       the composition: beats, layout, DOM overlay stack
  Root.tsx               composition registration
  lib/                   seeded PRNG, curve maths, shared GLSL helpers
  plane/
    textures.ts          procedural circuit / flow / binary tiles
    CircuitPlane.tsx     the plane and its shader
  brain/
    geometry.ts          brain profile -> points and edges
    aiTexture.ts         the two letters, drawn as geometry
    Brain.tsx            node sprites, screen-space lines, the "AI" plate
  scene/
    camera.ts            the camera traverse, and world -> screen projection
    Contact.tsx          the contact point and its ray burst
    Overlays.tsx         backdrop, bloom halos, vignette, grain
scripts/                 neutrality and banding checks
```

## Motion beats

| Frames | Beat |
|---|---|
| 0–90 | Plane already present and drifting. The brain draws on: contour points appear in sequence around the profile, connecting lines follow. |
| 80–120 | "AI" fades up inside it. |
| 92–132 | The contact point ignites and fans rays. |
| 120–600 | Steady state: hover and bob, node shimmer, a contour pulse every few seconds, trace pulses, scrolling binary, block flicker. |

The camera is a constant-speed lateral traverse with a very slight descent. It
never returns — this is not an orbit. At 4K it moves about 1.4 px per frame in
the near field, which is meant to be barely perceptible frame to frame.
