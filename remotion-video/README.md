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

- **Neural Field** — 3D abstract tech background (three.js + WebGPU via TSL),
  10.000s / 30fps, in two colour treatments at 1080p and 4K.
  See [`src/neural-field/README.md`](src/neural-field/README.md) for the
  composition list, render commands, how the look is built and what to tune.
  - `NeuralFieldAurora` / `NeuralFieldAurora4K` — teal/cyan/green, dense side left
  - `NeuralFieldNebula` / `NeuralFieldNebula4K` — dark blue/violet, mirrored
- **Particle Ring Halo** — `ParticleRingHalo` / `ParticleRingHalo4K`
- **Bluetooth Explainer** — `BluetoothExplainer`

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
