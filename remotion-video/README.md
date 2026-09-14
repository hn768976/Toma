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

| Composition | Size | fps | Length |
| --- | --- | --- | --- |
| `BluetoothExplainer` | 1920x1080 | 30 | 30 s |
| `ParticleRingHalo` / `ParticleRingHalo4K` | 1920x1080 / 3840x2160 | 25 | 8 s (loop) |
| `MarketDownturn4K` / `MarketDownturn1080` | 3840x2160 / 1920x1080 | 30 | 10 s |
| `MarketRally4K` / `MarketRally1080` | 3840x2160 / 1920x1080 | 30 | 12 s |

The two market-arrow pieces have their own notes in
[`src/market-arrow/README.md`](src/market-arrow/README.md), including the
ready-made `npm run render:v1` / `render:v2` / `render:v1:4k` /
`render:v2:4k` commands.

**Packaging the market-arrow hand-off**

```console
bash scripts/package-delivery.sh
```

Zips the git-tracked project plus [`docs/DELIVERY.md`](docs/DELIVERY.md)
into `dist-delivery/` (gitignored — it is a build artifact, rebuildable
from source at any time).

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
