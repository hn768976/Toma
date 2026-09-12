# Satin waves

A seamless abstract loop of soft satin / milky-water folds, in a light and a
dark colourway. Built to match a reference clip: **10.000 s, 30 fps, 16:9**.

## Compositions

| Composition ID      | Resolution  | Look              |
| ------------------- | ----------- | ----------------- |
| `SatinWavesLight`   | 1920 × 1080 | Cool near-white   |
| `SatinWavesDark`    | 1920 × 1080 | Charcoal + silver |
| `SatinWavesLight4K` | 3840 × 2160 | Cool near-white   |
| `SatinWavesDark4K`  | 3840 × 2160 | Charcoal + silver |

All four are 300 frames at 30 fps.

## Rendering

```console
npm i
npx remotion render SatinWavesLight4K out/satin-waves-light-4k.mp4 --codec=h264 --crf=14
npx remotion render SatinWavesDark4K  out/satin-waves-dark-4k.mp4  --codec=h264 --crf=14
```

`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("swangle")`.
That is the software GL backend and it is what makes the render work on a
machine with no GPU, at the cost of speed. **If you are rendering 4K on a
machine that has a real GPU, switch it to `"angle"`** — the shader is heavily
fragment-bound, so this is worth a large multiple in render time.

For an editing master rather than a delivery file:

```console
npx remotion render SatinWavesLight4K out/satin-waves-light-4k.mov --codec=prores --prores-profile=hq
```

## How it works

The image is a single full-screen WebGL2 fragment shader — there is no
geometry and no texture. Each pixel evaluates a height field, derives a
surface normal from it analytically, and shades that normal.

**The height field** (`waves.ts`) is a sum of eight travelling sine waves
under a travelling two-term domain warp. The warp is what turns regular
ripples into organic crumples. Wave directions sit in a narrow fan, so the
folds read as one coherent drape instead of isotropic noise, with a single
cross-cutting layer to break up the corduroy.

**The loop is seamless by construction**, not by crossfade. Every
time-dependent term advances by a whole number of cycles per loop
(`Wave.cycles` is an integer), so the field at `t = 1` is bit-identical to the
field at `t = 0`. Frame 299 → frame 0 is exactly as large a step as frame 0 →
frame 1.

**Normals are analytic.** The shader accumulates `dh/dp` alongside `h`, then
pushes it through the Jacobian of the domain warp. That avoids the three
extra field evaluations that finite differencing would cost, and it stays
exact at any resolution.

**Depth of field is free.** The lower-left of the frame is treated as further
away, and its high spatial bands are attenuated (`uBandFocus`). Attenuating
the high bands of a band-limited field _is_ a defocus blur, so this buys lens
softness with no blur pass.

**Grain is not decoration.** At this contrast — the light version lives
within about 12 code values — an 8-bit output bands visibly. The per-pixel
dither in the last line of the shader is what prevents that, and it matters
more after H.264 than it does on screen.

## Resolution independence

The shader works in units of _frame height_ (`uv = (frag - 0.5 * res) /
res.y`). The 4K compositions therefore frame the identical image as the 1080p
ones at twice the sample density — not a crop, and not an upscale. A 1080p
still and a 4K still downscaled to 1080p are the same picture.

## Tuning

`palette.ts` holds both looks. The two dials worth touching first:

- `bump` — apparent depth of the folds.
- `specular` / `specPower` — the sheen. The dark version clips to bare white
  very easily; keep its gain low and its falloff broad.

`depthScale` is exposed as a composition prop, so fold depth can be dialled
in the Studio without editing the palette.
