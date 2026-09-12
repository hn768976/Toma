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

## Compositions

| ID | Size | Notes |
| --- | --- | --- |
| `DataChartsDark` | 1920x1080, 30 fps, 10 s | Digital data charts dashboard, dark colorway (matches the reference footage) |
| `DataChartsLight` | 1920x1080, 30 fps, 10 s | Same scene, light colorway |
| `DataChartsDark4K` | 3840x2160, 30 fps, 10 s | 4K render of the dark scene |
| `DataChartsLight4K` | 3840x2160, 30 fps, 10 s | 4K render of the light scene |
| `ParticleRingHalo` / `ParticleRingHalo4K` | 1080p / 4K | Abstract particle-ring halo |
| `BluetoothExplainer` | 1080p | Hand-drawn Bluetooth explainer |

The data-charts scene lives in `src/data-charts/`. It is authored at 1080p and
scaled 2x for the 4K compositions, so every chart stays vector-crisp. Colors
for both colorways are in `src/data-charts/themes.ts`; the panel grid and
which chart sits where is in `src/data-charts/layout.ts`; camera drift is in
`src/data-charts/Board.tsx`.

Render examples:

```console
npx remotion render DataChartsDark out/DataCharts-Dark-1080p.mp4
npx remotion render DataChartsDark4K out/DataCharts-Dark-4K.mp4
npx remotion render DataChartsLight4K out/DataCharts-Light-4K.mp4 --codec=h264 --crf=16
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
