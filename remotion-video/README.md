# Remotion video

Motion-graphics compositions rendered with [Remotion](https://remotion.dev).

## Commands

```console
npm i              # install dependencies
npx remotion studio  # open the preview studio
```

## Compositions

| ID                    | Size      | Length | Notes                                 |
| --------------------- | --------- | ------ | ------------------------------------- |
| `BluetoothExplainer`  | 1920x1080 | 30s    | Hand-drawn explainer                  |
| `ParticleRingHalo`    | 1920x1080 | 8s     | Abstract particle ring                |
| `ParticleRingHalo4K`  | 3840x2160 | 8s     | 4K variant of the above               |
| `PaperRippleWhite`    | 3840x2160 | 10s    | Paper Ripple Relief, V1 — white paper |
| `PaperRippleGraphite` | 3840x2160 | 10s    | Paper Ripple Relief, V2 — graphite    |

---

## Paper Ripple Relief

Concentric raised ridges in a paper-like material, spiralling toward an
off-centre point, lit from the upper left at a grazing angle and turning very
slowly. Two versions share one surface and one motion; only the material and
the light differ.

Both compositions are **authored at 3840x2160** and are 300 frames at 30 fps.

### How it is built

`src/paper-ripple/` — three files:

- `constants.ts` — timing, camera, ridge geometry and motion, all in world
  units so 1080p and 4K are identical framing.
- `shader.ts` — the GLSL. The height field is analytic
  (`A(r) * sin(phase(r) - theta - rotation)`), so the vertex displacement and
  the shading normal come from the same closed-form expression and its exact
  gradient. Nothing is sampled from a displacement texture, so there are no
  stair-stepped normals. The fragment shader re-evaluates the field per pixel,
  which makes shading independent of subdivision — crest faceting, the usual
  failure of a displaced plane, cannot occur.
- `variants.ts` — the two material/light presets.

Per-frame uniforms are written onto the material inside a **layout** effect,
which is load-bearing. react-three-fiber copies the `uniforms` object into the
material when it creates it, and never re-applies a prop whose identity has not
changed — so mutating your own copy reaches the GPU on the first draw and never
again. And it has to be a layout effect specifically, because `<ThreeCanvas>`
issues its manual draw from a passive effect, which React runs after every
layout effect; from a passive effect the write lands a frame late.

Get either detail wrong and `remotion still` still looks perfect — a still
performs only that first draw — while every frame of the rendered video is
frame 0.

**Shadows are ray-marched against the height field in the fragment shader**,
not sampled from a shadow map. At a 13-degree key angle a shadow map would
either alias along the ridge or acne across the flats, and either one destroys
the paper illusion instantly. Marching the analytic field is resolution-
independent, cannot acne, and widens the penumbra with distance for free.

Everything animated is a pure function of `useCurrentFrame()` — no `useFrame`
clock, no accumulated deltas — because Remotion renders frames out of order
across threads.

### Motion

Three periodic terms, each a whole number of cycles across the 300-frame loop:

- **Rotation** — one full turn, sweeping the vortex seam around once.
- **Ripple travel** — 7 ridge periods of outward phase advance.
- **Breath** — one amplitude swell and settle.

Rotation and ripple travel both push the ridges outward, so total travel is
8 ridge spacings across the loop, or **0.8 spacings per second**.

That second term is not decoration, it is the clip. With a single spiral arm,
one turn of rotation drags the ridges outward by exactly _one_ ridge spacing —
0.1 spacings per second, which measures as **zero** frame-to-frame travel and
looks like a still image. Rotation alone cannot carry this composition; the
radial term is what makes it ripple.

Measured by cross-correlating a horizontal brightness profile between frames:

| Clip                                 | Ridge travel      |
| ------------------------------------ | ----------------- |
| Reference (`istockphoto-2227405885`) | ~2.7 spacings/sec |
| This composition                     | 0.82 spacings/sec |
| Rotation only (what this replaced)   | 0.00 spacings/sec |

About a third of the reference's speed, which is the brief's "one calm breath"
rather than the reference's brisker churn.

### The loop

Seamless at 300 frames: every animated term above completes a whole number of
cycles, so frame 300 is frame 0.

Verified rather than asserted. Comparing frames after an 8x8 box average —
which averages the per-pixel grain down far enough to expose the underlying
structure — the loop seam (frame 299 -> 0) differs by 2.886 levels, matching an
ordinary step within the loop (298 -> 299) at 2.883.

Do this check on _blurred_ frames. On raw frames the 2% grain contributes about
1.7 levels of difference all by itself, which is enough to make a completely
motionless clip look like it is moving.

### Rendering

Headless Chromium needs a GL backend — pass `--gl=angle`. On a machine with no
GPU, ANGLE falls back to SwiftShader automatically and still renders correctly,
just slower. (`--gl=swiftshader` also works and is a little slower again.)

**4K masters** (the compositions are already 4K, so `--scale=1`):

```console
npx remotion render PaperRippleWhite out/V1_PaperRippleWhite.mp4 --scale=1 --crf=16 \
  --gl=angle --image-format=png --pixel-format=yuv420p --color-space=bt709 --muted
npx remotion render PaperRippleGraphite out/V2_PaperRippleGraphite.mp4 --scale=1 --crf=16 \
  --gl=angle --image-format=png --pixel-format=yuv420p --color-space=bt709 --muted
```

**1080p previews** — same compositions at half scale:

```console
npx remotion render PaperRippleWhite out/V1_PaperRippleWhite.mp4 --scale=0.5 --crf=16 \
  --gl=angle --image-format=png --pixel-format=yuv420p --color-space=bt709 --muted
npx remotion render PaperRippleGraphite out/V2_PaperRippleGraphite.mp4 --scale=0.5 --crf=16 \
  --gl=angle --image-format=png --pixel-format=yuv420p --color-space=bt709 --muted
```

`--image-format=png` matters more than it looks: the default JPEG intermediate
puts chroma loss into exactly the huge, smooth, near-white gradients V1 is made
of, before x264 ever sees them. `--muted` drops the silent audio track Remotion
would otherwise attach, and `--color-space=bt709` is what makes the output
`yuv420p` rather than full-range `yuvj420p`.

**Stills**:

```console
npx remotion still PaperRippleWhite out/V1_PaperRippleWhite.png --frame=0 --scale=0.5 --gl=angle
npx remotion still PaperRippleGraphite out/V2_PaperRippleGraphite.png --frame=90 --scale=0.5 --gl=angle
```

### Measured render time

On 4 vCPU with no GPU (SwiftShader via ANGLE), using the render commands above
with `--concurrency=1`. Each figure comes from differencing a 12-frame and a
2-frame run, so per-run startup drops out:

| Output                    | Per frame  | 300 frames |
| ------------------------- | ---------- | ---------- |
| 1920x1080 (`--scale=0.5`) | **1.33 s** | ~6m 40s    |
| 3840x2160 (`--scale=1`)   | **3.93 s** | ~19m 40s   |

Raising `--concurrency` does **not** help much here: SwiftShader already
saturates every core inside a single GL context. On a machine with a real GPU,
raise it.

### Banding

A near-white 4K gradient is the worst case for 8-bit output and for H.264 after
it, so the shader dithers with ~2% grain (`grain` in `variants.ts`) after the
sRGB encode. At CRF 16 the encoded 1080p files show no stepping in the soft
falloffs. If a longer or lower-bitrate encode ever does, lower the CRF before
touching the grain.
