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

| ID                    | Size        | Length          | Notes                                       |
| --------------------- | ----------- | --------------- | ------------------------------------------- |
| `AiGeneratingDark`    | 1920 × 1080 | 8s @ 30fps      | "AI · Generating" loader, tilted code plane |
| `AiGeneratingDark4K`  | 3840 × 2160 | 8s @ 30fps      | 4K master of the above                      |
| `AiGeneratingLight`   | 1920 × 1080 | 8s @ 30fps      | Light editorial layout of the same piece    |
| `AiGeneratingLight4K` | 3840 × 2160 | 8s @ 30fps      | 4K master of the above                      |
| `ParticleRingHalo`    | 1920 × 1080 | 8s @ 25fps      | Abstract particle-ring halo                 |
| `ParticleRingHalo4K`  | 3840 × 2160 | 8s @ 25fps      | 4K master of the above                      |
| `BluetoothExplainer`  | 1920 × 1080 | 30s @ 30fps     | Hand-drawn "How Bluetooth Works" explainer  |

See [`src/ai-generating/README.md`](src/ai-generating/README.md) for the
loader piece: how it scales from 1080p to 4K, and the exact render commands.

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
