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

| Composition id        | Size        | fps | Length | Piece                                            |
| --------------------- | ----------- | --- | ------ | ------------------------------------------------ |
| `CyberShieldNavy`     | 1920 x 1080 | 30  | 25s    | Cyber shield, version A — cyan emblem on navy    |
| `CyberShieldNavy4K`   | 3840 x 2160 | 30  | 25s    | Version A at 4K                                  |
| `CyberShieldCyan`     | 1920 x 1080 | 30  | 25s    | Cyber shield, version B — dark blue on cyan      |
| `CyberShieldCyan4K`   | 3840 x 2160 | 30  | 25s    | Version B at 4K                                  |
| `ParticleRingHalo`    | 1920 x 1080 | 25  | 8s     | Abstract particle-ring halo (seamless loop)      |
| `ParticleRingHalo4K`  | 3840 x 2160 | 25  | 8s     | Particle-ring halo at 4K                         |
| `BluetoothExplainer`  | 1920 x 1080 | 30  | 30s    | Hand-drawn Bluetooth explainer                   |

Render any of them by id, for example the two 4K cyber-shield masters:

```console
npx remotion render CyberShieldNavy4K out/cyber-shield-v1-navy-4k.mp4 --codec=h264 --crf=17
npx remotion render CyberShieldCyan4K out/cyber-shield-v2-cyan-4k.mp4 --codec=h264 --crf=17
```

See [`src/cyber-shield/README.md`](src/cyber-shield/README.md) for how that
piece is built and which knobs change its look.

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
npx remotion render <composition-id> out/video.mp4 --codec=h264
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
