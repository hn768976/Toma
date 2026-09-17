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

## Compositions

| Composition                                     | Size      | fps | Length  |
| ----------------------------------------------- | --------- | --- | ------- |
| `FlightGridV1-4K` / `FlightGridV1-1080p`        | 4K / HD   | 30  | 16.00 s |
| `FlightGridV2-4K` / `FlightGridV2-1080p`        | 4K / HD   | 30  | 16.00 s |
| `ParticleRingHalo` / `ParticleRingHalo4K`       | HD / 4K   | 25  | 8.00 s  |
| `BluetoothExplainer`                            | HD        | 30  | 30.00 s |

The two `FlightGrid` pieces are three.js scenes — an airliner over a
wireframe globe, authored at 4K and delivered at 1080p. See
[`src/flight-grid/README.md`](./src/flight-grid/README.md) for the shot
breakdown, render commands and how the scene is built.

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

**Render the flight-grid deliverables**

```console
npm run render:deliverables   # both 1080p MP4s
npm run render:v1-4k          # 4K master, version 1
npm run render:v2-4k          # 4K master, version 2
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
