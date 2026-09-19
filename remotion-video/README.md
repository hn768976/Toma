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

## Cyber-alert spot

This project also contains a 20s cyber-security alert spot — a wall of red
binary code behind a glitching alert plate — in four compositions (`SystemHacked-1080p`, `SystemHacked-4K`, `PhishingAttack-1080p`,
`PhishingAttack-4K`). It uses a three.js / GLSL background pass, so renders on
a machine without a GPU need `--gl=angle`:

```console
npx remotion render SystemHacked-1080p out/system-hacked-1080p.mp4 \
  --gl=angle --codec=h264 --crf=20 --muted
```

See [`src/system-alert/README.md`](src/system-alert/README.md) for the
composition list, the structure, and the constraints to respect when editing
it (resolution independence, determinism across parallel workers).


## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
