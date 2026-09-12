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

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

## AI data-stream text field (`AiDataStream*`)

A 20s seamless loop of glowing monospace telemetry labels flying through
3D space with depth-of-field blur, bloom, chromatic fringing and a slow
camera drift, modelled on "glowing AI data processing" stock footage.
Source lives in `src/ai-data-stream/`.

| Composition ID       | Theme | Resolution  | Frames / fps |
| -------------------- | ----- | ----------- | ------------ |
| `AiDataStreamDark`   | dark  | 1920 x 1080 | 600 / 30     |
| `AiDataStreamLight`  | light | 1920 x 1080 | 600 / 30     |
| `AiDataStreamDark4K` | dark  | 3840 x 2160 | 600 / 30     |
| `AiDataStreamLight4K`| light | 3840 x 2160 | 600 / 30     |

Everything is designed at 1x and multiplied by the `resolutionScale` prop,
so the 4K compositions are the same picture at twice the pixel density.

```console
# 1080p deliverables
npx remotion render AiDataStreamDark out/AiDataStream-Dark-1080p.mp4 --crf=17
npx remotion render AiDataStreamLight out/AiDataStream-Light-1080p.mp4 --crf=17

# 4K
npx remotion render AiDataStreamDark4K out/AiDataStream-Dark-4K.mp4 --crf=17
npx remotion render AiDataStreamLight4K out/AiDataStream-Light-4K.mp4 --crf=17
```

Tunables (colours, camera speed, depth of field, label pool) are in
`src/ai-data-stream/constants.ts` and `labels.ts`. JetBrains Mono is
self-hosted from `public/fonts/` (SIL Open Font License).
