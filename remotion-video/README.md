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

| ID | Size | Length | Source |
| -- | ---- | ------ | ------ |
| `BluetoothExplainer` | 1920x1080 @ 30fps | 30s | `src/BluetoothExplainer.tsx` |
| `ParticleRingHalo` | 1920x1080 @ 25fps | 8s (loop) | `src/particle-ring/` |
| `ParticleRingHalo4K` | 3840x2160 @ 25fps | 8s (loop) | `src/particle-ring/` |
| `EditorTimelineA1080` | 1920x1080 @ 30fps | 52.17s | `src/editor-timeline/` |
| `EditorTimelineA4K` | 3840x2160 @ 30fps | 52.17s | `src/editor-timeline/` |
| `EditorTimelineB1080` | 1920x1080 @ 30fps | 52.17s | `src/editor-timeline/` |
| `EditorTimelineB4K` | 3840x2160 @ 30fps | 52.17s | `src/editor-timeline/` |

The editing-timeline shot has its own notes in
[`src/editor-timeline/README.md`](src/editor-timeline/README.md).

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
npx remotion render <composition-id> out/<name>.mp4 --codec=h264
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
