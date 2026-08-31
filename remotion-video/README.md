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

| Id | Size | Duration | Notes |
| --- | --- | --- | --- |
| `BluetoothExplainer` | 1920 x 1080 | 30s | Hand-drawn Bluetooth explainer. |
| `ParticleRingHalo` | 1920 x 1080 | 8s | Abstract particle-ring halo, seamless loop. |
| `ParticleRingHalo4K` | 3840 x 2160 | 8s | The same halo at 4K. |
| `CandleCloseBlue` | 3840 x 2160 | 13s | Candlestick close-up, `neonBlue` — volatile and range-bound on deep navy. Seamless loop. |
| `CandleCloseAmber` | 3840 x 2160 | 13s | Candlestick close-up, `amberDark` — a steady climb, warm throughout. Seamless loop. |
| `CandleCloseLight` | 3840 x 2160 | 13s | Candlestick close-up, `monoLight` — a sharp decline, light mode. Seamless loop. |

The three `CandleClose*` compositions share one component and differ only by
the `variant` prop, which keys into `VARIANTS` in
`src/candle-close/variants.ts` — palette, series character, floating-label
config and treatment flags all live there.

`tools/build-standalone.py` emits a self-contained, runnable single-variant
project for each of them:

```console
python3 tools/build-standalone.py dist-standalone
```

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
