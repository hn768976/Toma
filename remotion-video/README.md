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

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

## Warped grid plane ("spacetime fabric")

A wireframe ground plane receding to a high horizon over a starfield, with
a slow forward travel and a gentle warp. Built on `@remotion/three` /
react-three-fiber with a real perspective camera — the non-linear cell
compression toward the horizon and the converging vertical lines are what
sell the effect, and neither is reachable with 2D projection maths.

Two versions:

| Composition | Look |
| --- | --- |
| `GridPlaneBlue` / `GridPlaneBlue4K` | Cool white-blue lines, calm swell. Matches the reference. |
| `GridPlaneSynthwave` / `GridPlaneSynthwave4K` | Magenta/cyan, a horizon glow band, and 2x the displacement. |

The 1080p compositions are the same image as the 4K ones at a quarter of
the pixels — every pixel-denominated value (line width, glow radius, star
size) is authored at 4K and rescaled from the real output height — so the
preview is a faithful proxy for the render.

Rendering the deliverables (8s, 3840x2160, 30fps, H.264 `yuv420p`):

```console
npx remotion render GridPlaneBlue4K out/V1_GridPlaneBlue.mp4 \
  --codec=h264 --crf=17 --pixel-format=yuv420p --image-format=png --muted
npx remotion render GridPlaneSynthwave4K out/V2_GridPlaneSynthwave.mp4 \
  --codec=h264 --crf=17 --pixel-format=yuv420p --image-format=png --muted
npx remotion still GridPlaneBlue4K out/V1_GridPlaneBlue_frame120.png --frame=120
npx remotion still GridPlaneSynthwave4K out/V2_GridPlaneSynthwave_frame120.png --frame=120
```

### How the loop closes

Over the 240 frames the grid slides toward the camera by exactly
`CELLS_PER_LOOP` whole cells; only the sub-cell remainder is applied to the
mesh, so frame 240 puts the geometry back where frame 0 had it. The
displacement is two layers of 4D simplex noise whose extra two dimensions
trace a circle in time, which returns to itself at `t = 1`.

The noise is sampled in **world** space rather than in the grid's own
scrolling frame. A field that scrolled with the travel would have to be
periodic along z with period `CELLS_PER_LOOP * CELL_SIZE`, and an 8-unit
repeat across a 120-unit deep plane is glaringly obvious; anchoring the
field instead leaves the swell in place while the wireframe travels
through it, which is what the reference does too.

### Line rendering

Grid lines are screen-space-expanded quads, not GL lines: WebGL caps line
width at 1px nearly everywhere, which would make the 1080p preview four
times heavier than the 4K render. Each segment carries its two endpoints
and a side/end selector, and the vertex shader pushes the corners apart
perpendicular to the line's own screen-space direction, so widths are exact
in pixels at any resolution. Depth drives per-line width, opacity and the
exponential fog; a second pass over the same buffers draws wider quads with
a gaussian falloff for the near-line bloom.
