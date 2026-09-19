# Abstract gradient backgrounds

Four looping abstract gradient motion backgrounds, each built against one
supplied reference clip. Remotion drives the timeline; PixiJS v8 drives a pair
of custom WebGL2 shaders that draw every pixel.

| Variant | Length | Character |
| --- | --- | --- |
| `V1-MidnightBloom` | 10s / 300f | Near-black plate, deep blue and magenta blooms rising from the lower edge, heavy vignette |
| `V2-HolographicFoil` | 20s / 600f | Saturated iridescent liquid, strong double warp, coarse film grain |
| `V3-CyanDrift` | 15s / 450f | High key: large cream and pale-mint blobs over blue, almost no vignette |
| `V4-DeepCurrent` | 20s / 600f | Dark navy falling away to a turquoise core glowing up from the bottom |

Every variant is registered twice, at `3840x2160` and at `1920x1080`, both at
30fps:

```
V1-MidnightBloom-4K        V1-MidnightBloom-1080p
V2-HolographicFoil-4K      V2-HolographicFoil-1080p
V3-CyanDrift-4K            V3-CyanDrift-1080p
V4-DeepCurrent-4K          V4-DeepCurrent-1080p
```

## Rendering

```bash
npm run render:gradients          # all four at 1080p -> out/1080p/
npm run render:gradients:4k       # all four at 4K    -> out/4K/
npm run check:loop                # prove every variant still loops

node scripts/render-gradients.mjs V2 V4            # just those two
node scripts/render-gradients.mjs --uhd --crf=22   # 4K, smaller files
```

Or drive the CLI directly:

```bash
npx remotion render V2-HolographicFoil-4K out.mp4 \
  --codec=h264 --gl=swangle --crf=18 --pixel-format=yuv420p \
  --color-space=bt709 --muted
```

`--gl=swangle` selects SwiftShader through ANGLE, which is what makes WebGL2
work on a headless machine with no GPU. On a machine with a real GPU, drop the
flag and let Remotion pick.

`--muted` is deliberate. These are background plates, and Remotion's silent
audio track would otherwise pad the file past an exact frame count -- 10.05s
instead of 10.00s -- which is exactly the kind of thing that spoils a loop in
a player that respects container duration.

`--crf` defaults to 18. `V2-HolographicFoil` lands far larger than the others
at any given CRF because full-resolution grain is expensive to encode; raise
the CRF for that one if size matters more than the last of the texture.

### Speed

On a 4-core machine with no GPU (SwiftShader), roughly:

| | per frame | 20s clip |
| --- | --- | --- |
| 1080p | ~0.2s | ~3 min |
| 4K | ~0.7s | ~7 min |

The noise field costs the same at either resolution -- it is evaluated at a
fixed offscreen size -- so 4K only pays more in the finishing pass.

To tweak a variant interactively:

```bash
npm run dev
```

Every parameter below is exposed as a Studio control, so the look can be
redialled without touching the shader.

## How it works

### Seamless looping

A 2D animation made from 2D noise cannot loop without a crossfade. This one
samples **4D** simplex noise instead: the first two dimensions carry screen
space, and the last two trace a circle of radius `loopRadius`:

```glsl
float ang = TAU * uPhase;                       // uPhase = frame / durationInFrames
vec2 loop = vec2(cos(ang), sin(ang)) * uLoopRadius;
vec4 base = vec4(p * uScale + uSeed, loop.x + uSeed, loop.y - uSeed);
```

At `uPhase = 1` the circle closes exactly onto its start, so the last frame
flows into the first with no splice and no dissolve.

Everything else that moves has to close too. `drift` travels an ellipse rather
than a straight ramp for exactly this reason -- a linear ramp in `uPhase` snaps
back at the wrap and puts a visible jump in the loop.

`scripts/check-loop.mjs` measures it: it renders the frames either side of the
wrap and compares that step against a normal frame-to-frame step. A ratio near
1.0 means the seam is indistinguishable from any other frame boundary.

### Two passes

The noise field costs eleven 4D simplex lookups per pixel, which is far too
slow to evaluate 8.3 million times per 4K frame on a software rasteriser. It
is also extremely smooth — the references themselves are only 768x432 — so:

1. **Field pass** renders the palette-mapped gradient into an offscreen
   `rgba16float` texture at `fieldHeight` (default 360, so 640x360). Half
   float matters: an 8-bit field would hand the upscale stair steps instead of
   a gradient.
2. **Composite pass** resamples that texture at full output resolution and does
   the work that has to be per-pixel — vignette, saturation, film grain, and a
   triangular-PDF dither.

The field size is **absolute, not a fraction of the output**, which is why the
4K and 1080p compositions resolve to the same picture rather than the 4K one
carrying four times the detail. Grain is likewise normalised against frame
height, so it reads at the same size in both.

The upscale uses a quintic-warped bilinear tap. Plain bilinear is only C0
continuous, so a 3x or 6x upscale of a smooth field leaves faint diamond
creases along the texel grid; warping the fractional coordinate through
`f*f*f*(f*(f*6-15)+10)` before the hardware tap makes it C2 continuous for a
few instructions.

### Colour

Palette stops are authored as sRGB hex but converted to linear light before
they reach the shader, mixed in linear, and converted back at the end. Mixing
sRGB values directly is what makes hand-rolled gradients go muddy through the
midpoint.

The dither is not optional decoration. These images are mostly wide, flat,
slowly-varying areas, which is the worst case for 8-bit H.264 — without a
sub-LSB triangular dither they band visibly, especially the dark variants.

### Composition stability

The palette coordinate is built as a **standing spatial ramp plus a bounded
noise offset**:

```glsl
float t = f * 0.5 * uFieldAmount;          // noise, scaled
t += uSwirl * (r.x * 0.5 + q.y * 0.25);    // warp field re-indexes the palette
t += uBiasY * (vUv.y - 0.5);               // standing vertical ramp
t = t * uContrast + uOffset;
```

Letting the noise drive the whole palette range is what made early passes swing
from fully lit to fully black over the length of a clip. The references hold
their balance throughout, so `uBiasY`/`uOffset` fix the composition — dark top,
glow along one edge — and `uFieldAmount` caps how far the noise may move it.

## Parameters

| Group | Prop | Meaning |
| --- | --- | --- |
| Field | `scale` | Feature size. Lower = bigger, softer blobs |
| | `warpA`, `warpB` | Domain-warp strength for the two folding passes |
| | `detail` | fBm gain. ~0.15 is nearly pure first octave; 0.5 is classic fBm |
| | `loopRadius` | How far through 4D noise the loop travels; more = faster morph |
| | `drift` | Constant translation across the clip |
| | `seed` | Moves to a different part of the noise field |
| | `fieldHeight` | Offscreen field resolution. Raise for crisper detail at 4K |
| Tone | `fieldAmount` | How much of the palette the noise alone may travel |
| | `offset` | Where the palette sits when the field is zero |
| | `biasX`, `biasY` | Standing spatial ramp across the palette |
| | `swirl` | How much the warp field re-indexes the palette |
| | `contrast`, `gamma`, `exposure` | Tone curve on the palette coordinate |
| Colour | `palette` | Six sRGB hex stops, low field to high |
| | `iridescence` | Blend toward a cosine palette (V2 only) |
| | `iridescenceA..D`, `iridescenceFreq` | Cosine palette coefficients |
| Finish | `vignette`, `vignetteSoft` | Edge falloff amount and softness |
| | `saturation` | Post-grade saturation |
| | `grain`, `grainSize` | Film grain amount and cell size |

## Files

```
shaders/noise4d.ts    4D simplex noise (Ashima / Gustavson, MIT)
shaders/gradient.ts   full-screen vertex quad, field pass, composite pass
variants.ts           zod schema + the four tuned parameter sets
GradientCanvas.tsx    PixiJS v8 app, two-pass render, Remotion frame sync
GradientComposition.tsx  opaque backdrop wrapper
Compositions.tsx      registers all eight compositions
```

## Notes

- Rendering is deterministic. Pixi's ticker is off and every draw is a pure
  function of `useCurrentFrame()`, so parallel render workers cannot disagree
  and re-rendering a range reproduces the same pixels.
- WebGL2 is required. WebGPU would run these shaders too, but headless Chromium
  has no dependable WebGPU adapter, so the renderer is pinned to `webgl`.
- The 4K and 1080p compositions were checked against each other: rendering the
  same frame from both and comparing them downscaled gives a mean difference of
  0.4/255 and a maximum of 2/255, which is the grain and dither and nothing
  else. They are the same picture at two densities.
