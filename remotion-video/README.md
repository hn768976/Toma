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

| Id | What it is |
|---|---|
| `PodiumDisc4K` / `PodiumDisc1080` | White-studio podium backplate — thin disc, warm greige studio, 7.40s |
| `PodiumSlab4K` / `PodiumSlab1080` | White-studio podium backplate — square plinth, cool white studio, 16.80s |
| `PodiumCylinder4K` / `PodiumCylinder1080` | White-studio podium backplate — cylinder, cool white studio, 16.80s |
| `BluetoothExplainer` | Hand-drawn "How Bluetooth Works" explainer, 30s |
| `ParticleRingHalo` / `ParticleRingHalo4K` | Abstract particle-ring motion graphic |

The podium compositions are a Remotion + three.js + **WebGPU** (TSL node
materials) build — see [`src/studio/README.md`](./src/studio/README.md) for how
the look was derived from the reference clips, and
[`tools/reference-match/`](./tools/reference-match/README.md) for the harness
that keeps those numbers checkable.

```console
npm run render:all       # three 1080p H.264 MP4s
npm run render:all-4k    # the same three at 3840x2160
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
