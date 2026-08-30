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

## Breathing Lungs

Two 4K (3840 × 2160) flat-vector breathing-lungs loops, 420 frames at 30fps
(14.0s), registered as `LungsHealthy` and `LungsStrained`. Source lives in
`src/lungs/`; everything that differs between the two versions — palette,
breath rhythm, particle behaviour, tree density — is in `src/lungs/variants.ts`.

1080p previews:

```bash
npx remotion render LungsHealthy  out/lungs-healthy-preview.mp4  --codec=h264 --crf=18 --scale=0.5 --muted
npx remotion render LungsStrained out/lungs-strained-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --muted
```

Standalone, independently runnable single-version projects are built with:

```bash
node scripts/package-variants.mjs   # -> dist-variants/lungs-{healthy,strained}.zip
```
