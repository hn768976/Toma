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

## Market Trends (3D data-visualisation loop)

`src/market-trends/` renders a 12 s seamless loop of a perspective-tilted
market dashboard: weaving green bars, thin cyan bars, purple and lime
saw-tooth lines, smooth white and red curves, a dotted node grid and
time-stamp labels, with blurred ticker digits and donut charts far behind
and soft bokeh in front. Everything is projected through a real pinhole
camera (`camera.ts`) so parallax and foreshortening are consistent.

Compositions registered in `src/Root.tsx`:

| ID                    | Size      | Theme |
| --------------------- | --------- | ----- |
| `MarketTrendsDark`    | 1920x1080 | dark  |
| `MarketTrendsLight`   | 1920x1080 | light |
| `MarketTrendsDark4K`  | 3840x2160 | dark  |
| `MarketTrendsLight4K` | 3840x2160 | light |

The 4K compositions draw the exact same geometry at `resolutionScale: 2`,
so the 1080p renders are true previews of the 4K output.

Render, for example:

```console
npx remotion render MarketTrendsDark4K out/MarketTrends-Dark-4K.mp4 --codec=h264 --crf=16
npx remotion render MarketTrendsLight4K out/MarketTrends-Light-4K.mp4 --codec=h264 --crf=16
```

Props (editable in Remotion Studio): `theme` (`dark` | `light`),
`resolutionScale` (must match the composition size) and `seed` (changes
the generated data).
