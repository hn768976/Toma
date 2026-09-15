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


## Data grid field (`DataGrid*`)

A "big data visualisation" motion background: a field of glowing nodes,
numeric readouts and data dashes flowing outward over a bowed perspective
grid. Built to match a 20.00s / 30fps / 16:9 reference clip.

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
# 1080p H.264 (the delivered files)
npx remotion render DataGridBlue1080  out/data-grid-blue-1080p.mp4  --codec=h264 --image-format=png --crf=16
npx remotion render DataGridGreen1080 out/data-grid-green-1080p.mp4 --codec=h264 --image-format=png --crf=16

# 4K H.264
npx remotion render DataGridBlue4K  out/data-grid-blue-4k.mp4  --codec=h264 --image-format=png --crf=16
npx remotion render DataGridGreen4K out/data-grid-green-4k.mp4 --codec=h264 --image-format=png --crf=16
```

`--image-format=png` overrides the project-wide JPEG frame capture in
`remotion.config.ts`. Worth it here: the field is all soft glows and fine
gradients, which pick up visible blocking if frames are JPEG'd before
being handed to the encoder.

4K renders are roughly 4x the cost of 1080p. Add `--concurrency=<n>` to
tune for your machine.

### How it works

Everything lives in `src/data-grid/`:

| File             | Role                                                          |
| ---------------- | ------------------------------------------------------------- |
| `constants.ts`   | Timing, camera rate, field extents, element counts, value pool |
| `theme.ts`       | The two colourways — add a third here and nothing else changes |
| `field.ts`       | Seeds the field once at module load                            |
| `projection.ts`  | Zoom-band camera, barrel bow, fades, culling                   |
| `random.ts`      | Deterministic PRNG                                             |
| `loop.ts`        | Oscillators that close exactly over the clip                   |
| `layers/`        | Atmosphere, grid, dashes, readouts, nodes                      |

Three things are worth knowing before changing it:

**The camera is a uniform zoom, not a perspective fly-through.** The
reference's motion was measured by scale-space cross-correlation between
frames 0.5s-2.0s apart: a uniform radial zoom about frame centre of
**1.032x per second**, consistent to within 0.5% across every interval
tested. `ZOOM_PER_SECOND` in `constants.ts` is that number. Elements ride
a logarithmic zoom band, entering small at the centre and fading out as
they reach the edge.

**It loops seamlessly.** Frame 600 lands back exactly on frame 0: the zoom
band is crossed a whole number of times (`ZOOM_CYCLES`), every oscillator
goes through `loopSin` which completes whole periods over the clip, and
readout values only change on periods that divide 600. Measured seam
delta is 1.12 mean absolute vs 0.93 for an ordinary frame step —
indistinguishable. Keep that property in mind when adding motion.

**Sizes are resolution-independent.** Every dimension is authored against
a virtual 1920x1080 frame and multiplied by `s = width / BASE_WIDTH` at
render time. The 4K compositions are therefore true 2x renders — text and
dots are rasterised at 4K — rather than an upscale of the 1080p output.

Element identity (position, size, tier, phase) is a pure function of
index via the seeded PRNG, never `Math.random()`: Remotion renders frames
out of order across workers, so anything else would flicker.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
