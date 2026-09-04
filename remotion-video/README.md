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

**Shadows are ray-marched against the height field in the fragment shader**,
not sampled from a shadow map. At a 13-degree key angle a shadow map would
either alias along the ridge or acne across the flats, and either one destroys
the paper illusion instantly. Marching the analytic field is resolution-
independent, cannot acne, and widens the penumbra with distance for free.

Everything animated is a pure function of `useCurrentFrame()` — no `useFrame`
clock, no accumulated deltas — because Remotion renders frames out of order
across threads.

### The loop

Seamless at 300 frames. The pattern has a single spiral arm, so it only maps
back onto itself after a full 360 degrees; the rotation is exactly one turn
across the loop and the amplitude pulse is exactly one cycle, so frame 300 is
frame 0.

Verified rather than asserted: the mean per-channel difference across the loop
seam (frame 299 -> frame 0) is 1.811 levels, identical to an ordinary step
within the loop (frame 298 -> 299).

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
with `--concurrency=1`:

| Output                    | Per frame  | 300 frames                  |
| ------------------------- | ---------- | --------------------------- |
| 1920x1080 (`--scale=0.5`) | **1.11 s** | 5m 38s (measured, full run) |
| 3840x2160 (`--scale=1`)   | **3.67 s** | ~18m 20s (extrapolated)     |

The 1080p number is a full 300-frame render divided by its own frame count. The
4K number comes from differencing a 12-frame and a 2-frame run so per-run
startup drops out; only the 300-frame total is extrapolated from it.

Raising `--concurrency` does **not** help here: SwiftShader already saturates
every core inside a single GL context, and 60 frames took 68s at
`--concurrency=1` versus 70s at `--concurrency=4`. On a machine with a real GPU,
raise it.

### Banding

A near-white 4K gradient is the worst case for 8-bit output and for H.264 after
it, so the shader dithers with ~2% grain (`grain` in `variants.ts`) after the
sRGB encode. At CRF 16 the encoded 1080p files show no stepping in the soft
falloffs. If a longer or lower-bitrate encode ever does, lower the CRF before
touching the grain.
