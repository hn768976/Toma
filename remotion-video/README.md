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

| ID | What it is | Size | Length |
|---|---|---|---|
| `BluetoothExplainer` | Hand-drawn Bluetooth explainer | 1920x1080 | 30s |
| `ParticleRingHalo` | Abstract particle-ring halo | 1920x1080 | 8s |
| `ParticleRingHalo4K` | The same, at 4K | 3840x2160 | 8s |
| `V1-StarryTreeline` | Starry night over a conifer treeline | 3840x2160 | 30s, loops |
| `V2-StarryTreelineMoonrise` | The same sky with a moonrise glow | 3840x2160 | 30s, loops |

**Render at 4K**

```console
npx remotion render ParticleRingHalo4K out/ParticleRingHalo4K.mp4 --scale=1 --crf=16
npx remotion render V1-StarryTreeline out/V1_StarryTreeline.mp4 --scale=1 --crf=16 --image-format=png --muted
npx remotion render V2-StarryTreelineMoonrise out/V2_StarryTreelineMoonrise.mp4 --scale=1 --crf=16 --image-format=png --muted
```

Halve to 1080p with `--scale=0.5`. The starry-treeline compositions need
`--image-format=png` — the project default is JPEG, which bands on their large,
smooth, very dark sky gradients — and `--muted` to drop the silent audio track.
See [`src/starry-treeline/README.md`](src/starry-treeline/README.md) for detail
on that pair, including how to swap in different tree artwork.

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
