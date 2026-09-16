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

| Composition                | What it is                                              |
| -------------------------- | ------------------------------------------------------- |
| `BlockchainChain1080p`     | 3D blockchain data chain, reference layout (20s, 30fps) |
| `BlockchainChain4K`        | The same, at 3840x2160                                   |
| `BlockchainChainHero1080p` | Alternate layout: hero cube, chain across frame          |
| `BlockchainChainHero4K`    | The same, at 3840x2160                                   |
| `BluetoothExplainer`       | Hand-drawn Bluetooth explainer                           |
| `ParticleRingHalo`         | Abstract particle-ring halo motion graphic               |
| `ParticleRingHalo4K`       | The same, at 3840x2160                                   |

The blockchain compositions are three.js WebGPU scenes. See
[`src/blockchain/README.md`](./src/blockchain/README.md) for how they
are built, how to render them, and the WebGPU constraints they work
around -- read that before changing them or bumping `three`.

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
