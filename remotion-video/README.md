# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```


## 3D data field (`DataGrid*`)

A "big data visualisation" motion background: a volume of glowing nodes,
numeric readouts and data dashes that the camera flies forward through.
20.00s / 30fps / 16:9, matching the reference clip's timing.

### Compositions

| ID                  | Resolution  | Colourway              |
| ------------------- | ----------- | ---------------------- |
| `DataGridBlue4K`    | 3840 x 2160 | Navy / blue (reference)|
| `DataGridBlue1080`  | 1920 x 1080 | Navy / blue (reference)|
| `DataGridGreen4K`   | 3840 x 2160 | Matrix terminal green  |
| `DataGridGreen1080` | 1920 x 1080 | Matrix terminal green  |

All four are 600 frames at 30fps (20.00s exactly) and share one component,
`src/data-grid/DataGridField.tsx`, differing only in size and the `theme`
prop (`"blue"` / `"green"`).

### Rendering

```console
# 1080p H.264, no audio track (the delivered files)
npx remotion render DataGridBlue1080  out/data-grid-blue-1080p.mp4  --codec=h264 --image-format=png --crf=16 --muted --enforce-audio-track=false
npx remotion render DataGridGreen1080 out/data-grid-green-1080p.mp4 --codec=h264 --image-format=png --crf=16 --muted --enforce-audio-track=false

# 4K H.264
npx remotion render DataGridBlue4K  out/data-grid-blue-4k.mp4  --codec=h264 --image-format=png --crf=16 --muted --enforce-audio-track=false
npx remotion render DataGridGreen4K out/data-grid-green-4k.mp4 --codec=h264 --image-format=png --crf=16 --muted --enforce-audio-track=false
```

`--image-format=png` overrides the project-wide JPEG frame capture in
`remotion.config.ts`. Worth it here: the field is all soft glows and fine
gradients, which pick up visible blocking if frames are JPEG'd before
being handed to the encoder. Without `--enforce-audio-track=false`
Remotion muxes in a silent AAC track, which also pushes the container
duration to 20.05s.

4K renders are roughly 4x the cost of 1080p. Add `--concurrency=<n>` to
tune for your machine.

### How it works

Everything lives in `src/data-grid/`:

| File             | Role                                                          |
| ---------------- | ------------------------------------------------------------- |
| `constants.ts`   | Timing, camera geometry, field extents, counts, value pool     |
| `theme.ts`       | The two colourways — add a third here and nothing else changes |
| `field.ts`       | Seeds the field once at module load                            |
| `projection.ts`  | Perspective camera, depth recycling, haze, fades, culling      |
| `random.ts`      | Deterministic PRNG                                             |
| `loop.ts`        | Oscillators that close exactly over the clip                   |
| `layers/`        | Atmosphere, dashes, readouts, nodes                            |

Three things are worth knowing before changing it:

**The camera is a true perspective fly-through.** Elements are seeded
uniformly through a depth slab (`Z_NEAR`..`Z_FAR`) and projected through
a pinhole camera; the camera travels forward at a constant rate and
elements that pass it are recycled to the back. Depth is real, so the
radial expansion rate varies with distance — across the visible depth
window it spans 1.76x/s at the near edge to 1.11x/s at the far edge, a
1.59x parallax spread. A flat zoom would be 1.00x. Aerial haze
(`hazeAt`) sinks distant elements back toward the ground, which is most
of what sells the depth.

**It loops seamlessly.** Frame 600 lands back exactly on frame 0: the
camera crosses the depth slab a whole number of times
(`DEPTH_CROSSINGS`), every oscillator goes through `loopSin` which
completes whole periods over the clip, and readout values only change on
periods that divide 600. Measured seam delta is 1.281 mean absolute vs
1.270 for an ordinary frame step — indistinguishable. Keep that property
in mind when adding motion.

**Sizes are resolution-independent.** Every dimension is authored against
a virtual 1920x1080 frame and multiplied by `s = width / BASE_WIDTH` at
render time. The 4K compositions are therefore true 2x renders — text and
dots are rasterised at 4K — rather than an upscale of the 1080p output.

Element identity (position, depth, size, tier, phase) is a pure function
of index via the seeded PRNG, never `Math.random()`: Remotion renders
frames out of order across workers, so anything else would flicker.

To change the pace, adjust `DEPTH_CROSSINGS` (whole numbers only, or the
loop breaks). To let elements sweep closer to the camera before they
vanish, lower `FADE_OUT`.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
