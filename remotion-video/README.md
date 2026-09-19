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

| ID                   | Size      | Length          | What it is                                                                                      |
| -------------------- | --------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `CyberAttack`        | 1920×1080 | 20.000s @ 30fps | Broken-signal "Cyber Attack / System Hacked" glitch piece. [Docs](./src/cyber-attack/README.md) |
| `CyberAttack4K`      | 3840×2160 | 20.000s @ 30fps | The same edit at 4K — one source, scaled, not a second build                                    |
| `ParticleRingHalo`   | 1920×1080 | —               | Abstract particle-ring halo                                                                     |
| `ParticleRingHalo4K` | 3840×2160 | —               | 4K variant of the above                                                                         |
| `BluetoothExplainer` | 1920×1080 | 30s @ 30fps     | Hand-drawn "How Bluetooth Works" explainer                                                      |

Render any of them by ID:

```console
npx remotion render CyberAttack   out/CyberAttack_1080p.mp4 --codec=h264 --muted
npx remotion render CyberAttack4K out/CyberAttack_4K.mp4    --codec=h264 --muted
```

`--muted` matters for the glitch piece: it is a picture-only element, and
without the flag Remotion attaches a silent audio track that pushes the
file past its nominal 20.000s.

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
