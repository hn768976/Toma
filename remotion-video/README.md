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

## Compositions in this project

| Composition ID              | Size      | Duration        | Notes                                |
| --------------------------- | --------- | --------------- | ------------------------------------ |
| `TradingFloor-Dark-1080p`   | 1920×1080 | 509f @ 30fps    | Trading terminal wall, dark theme    |
| `TradingFloor-Light-1080p`  | 1920×1080 | 509f @ 30fps    | Same, light theme                    |
| `TradingFloor-Dark-4K`      | 3840×2160 | 509f @ 30fps    | 4K master, dark                      |
| `TradingFloor-Light-4K`     | 3840×2160 | 509f @ 30fps    | 4K master, light                     |
| `ParticleRingHalo`          | 1920×1080 | 200f @ 25fps    | Abstract particle-ring halo          |
| `ParticleRingHalo4K`        | 3840×2160 | 200f @ 25fps    | 4K variant                           |
| `BluetoothExplainer`        | 1920×1080 | —               | Hand-drawn Bluetooth explainer       |

See [`src/trading-floor/README.md`](./src/trading-floor/README.md) for the
trading-floor piece: how it is built, how to render the 4K masters, and
which props tune it.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
