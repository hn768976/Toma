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

## Financial dashboard motion graphics

Four versions of an abstract financial-data-screen motion graphic, built
from four reference clips. They share one component library
(`src/data-dashboard/`) and differ in layout, palette weighting and
camera move:

| Composition   | Length     | The idea                                                                                                                                                                                                                   |
| ------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DashboardV1` | 10s / 300f | Energy markets. Near-frontal board, full legend, slow pull-back. The most legible of the four.                                                                                                                             |
| `DashboardV2` | 10s / 300f | Household costs. Opens as a long lens on the surface - diagonal drift, rack focus through three depth planes - then pulls back to deep focus.                                                                              |
| `DashboardV3` | 14s / 420f | Asset classes. The deepest blue of the four; the camera crosses the board left to right, easing in through the middle of the shot.                                                                                         |
| `DashboardV4` | 10s / 300f | Macro panel. The busiest layout, and the only board with visible edges - the defocused room shows past them. Shares version 1's move, pushed further in: it opens deep inside the graph and pulls back to the whole panel. |

Every version has a `-4K` twin (`DashboardV1-4K` and so on) at
3840x2160. Both run the same component tree: the scene is drawn into a
single `<svg>` whose viewBox is in resolution-independent "stage units",
and `resolutionScale` only changes the pixel size of that element and the
CSS perspective distance. Nothing is authored twice, and the 4K output is
genuinely resolution-independent rather than an upscale.

All four are 30fps, all four are framed by X and Y rules with tick
marks registered to their value and time labels, and all four end the
same way: the camera resolves wide on the completed graph, with every
trace drawn, every bar grown and every callout placed. Nothing is still
animating on the last frame.

### Rendering

```console
npm run render:dashboards        # 1080p, all four -> out/dashboard-vN-1080p.mp4
npm run render:dashboards:4k     # 3840x2160
node scripts/render-dashboards.mjs --4k v3   # one version
```

Both scripts render H.264 in an MP4 with no audio track, and force PNG
frames on the way in so the output is true `yuv420p`. Remotion's default
mjpeg frame pipeline tags the result `yuvj420p` (full range), which some
editors read back washed out.

### Structure

- `src/data-dashboard/constants.ts` - fps, durations, stage size, palette
- `src/data-dashboard/series.ts` - seeded random-walk series and formatting
- `src/data-dashboard/camera.ts` - keyframed camera, stage units to CSS transform
- `src/data-dashboard/components/` - grid, axis rules and ticks, line
  series, histogram, donut, dial, widgets, chips, markers, atmosphere
- `src/data-dashboard/versions/` - the four films

All generated values derive from an integer seed through `mulberry32`, so
frames stay identical no matter which worker renders them.
