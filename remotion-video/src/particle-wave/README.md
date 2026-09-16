# Digital particle wave

Abstract blue particle-wave background — a seamless loop of a bowed lattice of
dots rippling under a stack of travelling sine waves, shot through a pinhole
camera with a faked depth of field.

## Compositions

| Composition ID         | Resolution  | Grade      |
| ---------------------- | ----------- | ---------- |
| `ParticleWave4K`       | 3840 x 2160 | blue       |
| `ParticleWave1080p`    | 1920 x 1080 | blue       |
| `ParticleWaveMono4K`   | 3840 x 2160 | monochrome |
| `ParticleWaveMono1080p`| 1920 x 1080 | monochrome |

All four are 30 fps, 450 frames (15.000 s), and loop seamlessly.

The 4K compositions are not a different animation — `resolutionScale: 2` scales
every length in `geometry.ts` by two while the lattice size (`COLS` x `ROWS`)
stays fixed, so 4K is the same frame resampled at twice the density, not a
denser or differently-composed one.

## Rendering

```console
npm i

npm run render:wave:4k          # blue, 3840x2160, H.264/MP4
npm run render:wave:1080p       # blue, 1920x1080
npm run render:wave:mono:4k     # monochrome, 3840x2160
npm run render:wave:mono:1080p  # monochrome, 1920x1080
```

Output lands in `out/`. Each script renders H.264 into an MP4 at CRF 16 with
`--image-format=png`: the frames are almost entirely dark blue gradient, and
intermediate JPEG frames band visibly in those shadows.

Preview and scrub any composition with `npm run dev`.

## How it is built

`ParticleWave.tsx` draws every frame to a canvas — 16k animated dots per frame
is far past what DOM/SVG nodes can push at 4K.

- **Surface.** `particles.ts` lays out a `COLS x ROWS` lattice in normalised
  `(u, v)` coordinates. Each point gets a deterministic brightness variation and
  twinkle phase seeded from its index, never `Math.random()`: Remotion renders
  frames out of order across workers, so anything that is not a pure function of
  `(index, frame)` would flicker.
- **Wave.** Three stacks of sine terms in `constants.ts` displace each point in
  Z (depth — the dominant motion), X and Y. Y displacement is what bunches dots
  along a column so additive blending fuses them into bright dashed strands.
- **Camera.** A pinhole projection at `PLANE_DISTANCE`. The surface bows away
  from the camera towards its edges (`CURVE_X`), and `X_EXTENT` is tuned so the
  silhouette fold — where the bowing surface turns away and columns pile up —
  sits at the frame edge. That fold is the curling, compressed edge.
- **Depth of field.** Distance from `FOCUS_Z` inflates a dot's radius and drains
  its alpha to match, so defocused particles smear instead of turning into fat
  bright blobs.
- **Grade.** `palette.ts` holds both looks and precomputes every
  (colour, alpha) pair as a ready-made `rgba()` string; the hot loop then only
  assigns `fillStyle`. Colour ramp position and opacity are driven off the same
  energy but on separate curves — coupling them directly forces a choice between
  "bright but white" and "blue but invisible".
- **Bloom.** A quarter-size copy of the particle pass, CSS-blurred and screened
  back over the sharp one. Blurring at quarter size looks the same once scaled
  up and keeps 4K out of the blur filter.

## Seamlessness

Every time-varying quantity is a function of
`theta = 2*PI*frame/durationInFrames` with a **whole-number** multiplier — the
`n` in each wave term, and `SHIMMER_CYCLES`. That makes frame 450 identical to
frame 0, so the cut back to the start is invisible. Changing any `n` or
`SHIMMER_CYCLES` to a fraction will visibly break the loop.
