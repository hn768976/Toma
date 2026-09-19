# Toma — Abstract Motion Backgrounds

Four seamless-looping abstract motion backgrounds, built with
**Remotion 4 + PixiJS v8** driving **custom GLSL fragment shaders**.

Compositions are authored at **3840×2160 (4K)**. The 1080p deliverables are the
same compositions rendered at `--scale=0.5`.

---

## The four looks

| Composition | Look | Duration | Frames @ 30fps |
|---|---|---|---|
| `SilkWeaveNavy` | Silk Weave — deep navy satin drape | 15.000 s | 450 |
| `SilkWeaveMagenta` | Silk Weave — magenta / violet | 15.000 s | 450 |
| `CausticBloomRose` | Caustic Bloom — rose ↔ indigo | 20.000 s | 600 |
| `CausticBloomAzure` | Caustic Bloom — azure ↔ violet | 20.000 s | 600 |

All four are **seamless loops**: frame *N* is exactly frame 0, so they can be
cut end-to-end indefinitely with no visible seam.

### Note on frame rate

The brief specified 30 fps. The two Silk Weave references are 29.97 fps
(450 frames / 15.015 s); the two Caustic Bloom references are exactly 30.00 fps
(600 frames / 20.000 s).

Frame counts here match the references exactly (450 and 600). At a flat 30 fps
that makes the Silk pair 15.000 s rather than 15.015 s — a 15 ms difference,
and the only way to keep an integer frame count at 30 fps. If you need a literal
29.97 fps match instead, set `FPS = 30000/1001` in `src/Root.tsx`.

---

## Usage

```bash
npm install

# Interactive preview / scrubbing
npm run studio

# 1080p deliverables  -> out/1920x1080/
npm run render:1080p

# Full 4K masters     -> out/3840x2160/
npm run render:4k

# A single composition
node scripts/render-all.mjs --scale=0.5 --only=SilkWeaveNavy
```

Output is H.264 in an MP4 container, `yuv420p`, CRF 16.

---

## How it works

### `src/ShaderStage.tsx` — the Remotion ↔ PixiJS bridge

A fullscreen PixiJS `Filter` is driven from Remotion's frame clock. Two details
carry the whole thing:

- **Pixi's ticker is never started.** The renderer is invoked by hand once per
  Remotion frame, with every uniform derived purely from `useCurrentFrame()`.
  Nothing reads wall-clock time, so a given frame renders identically no matter
  when or in what order it is produced — which is what makes distributed and
  resumed renders safe.

- **The canvas backing store is sized in _device_ pixels.** Remotion's `--scale`
  maps onto `devicePixelRatio`, so a 4K composition rendered at `--scale=0.5`
  runs the shader at exactly 1920×1080 rather than shading 4K and downsampling.
  One set of compositions, native rendering at every delivery size.

`preserveDrawingBuffer: true` is required — without it the framebuffer may be
cleared before Remotion screenshots the page, giving black frames.

### Seamless looping

Every time-dependent term in both shaders is a `sin`/`cos` of
`TAU * n * uPhase`, where `n` is an **integer** and `uPhase` runs 0 → 1 across
the composition. That makes the entire field exactly 1-periodic by
construction. Phase is `frame / durationInFrames` (not `durationInFrames - 1`),
so frame *N* lands exactly where frame 0 started.

No crossfade, no mirror-and-reverse — the loop is closed by the maths.

### `src/shaders/silkWeave.ts` — Silk Weave

A height field is built from a sum of directional travelling waves whose
directions are **clustered around one dominant diagonal** rather than spread
evenly. That clustering is what makes it read as draped cloth (long,
parallel-ish folds) instead of isotropic turbulence. A gentle single-stage
domain warp bends the folds without shattering them.

Surface normals come from central differences of the height. Two Blinn-Phong
lobes — one moderately tight for the fold ridge, one very broad for the falloff
either side — produce the satin specular. A luminance-gated 45° screen supplies
the weave texture, and a heavy elliptical vignette closes the corners down.

### `src/shaders/causticBloom.ts` — Caustic Bloom

Polar coordinates are taken around a focus point drifting on a closed Lissajous
path. An angular harmonic series generates the ray lobes, each carrying a
**radial phase term** — that radial term is what turns a flat starburst into
folded light sheets, shearing each lobe as it travels outward.

The angular structure is faded out below `r = 0.4`. `atan()` is undefined at the
origin and every harmonic collapses there, which otherwise shows up as a hard
pinwheel artifact at the focus; fading it leaves the soft fold a real caustic
cusp actually has.

Softness here is intrinsic rather than a blur pass — everything is built from
low-frequency terms, which is both cheaper and cleaner than blurring after the
fact.

### Banding

These are large, flat gradients, which is the worst case for H.264
quantisation. Both shaders apply a triangular-PDF dither at roughly ±1.6/255
before output, and rendering uses CRF 16 with `yuv420p`. Without the dither the
ramps posterise into visible steps.

---

## Rendering on a restricted host

If the host cannot download Remotion's bundled Chromium, point it at an
existing install:

```bash
export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell
```

Use `chrome-headless-shell`, not a full `chrome` binary — Remotion launches in
old-headless mode, which modern Chrome builds have removed.

`remotion.config.ts` sets the OpenGL renderer to `swangle` (SwiftShader via
ANGLE), the software backend that is reliably available on headless Linux. On a
machine with a real GPU, `angle-egl` is considerably faster.

---

## Project layout

```
src/
  index.ts                    registerRoot
  Root.tsx                    composition registry, 4K master dimensions, fps
  ShaderStage.tsx             Remotion <-> PixiJS bridge
  compositions/looks.ts       the four looks: colourways, durations, uniforms
  shaders/
    common.ts                 dither, tonemap, gamma helpers
    silkWeave.ts              Silk Weave fragment shader
    causticBloom.ts           Caustic Bloom fragment shader
scripts/
  render-all.mjs              batch render via the Remotion CLI
```

To add a colourway, add an entry to `LOOKS` in `src/compositions/looks.ts` —
it is picked up by `Root.tsx` automatically and needs no new shader.
