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

## Container yard

Six 3D shipping-container shots (Remotion + three.js), each recreating one of
the supplied reference clips at its original duration, at 30fps. Registered at
both 1080p and 4K.

    ./scripts/render-all.sh          # six 1080p H.264 MP4s -> out/deliverables
    ./scripts/package-project.sh     # zip the project for handoff
    npm run build:lods               # rebuild the container LOD chain

Full notes, including the renderer tier fallback and how the supplied mesh is
decimated, are in [`src/yard/README.md`](src/yard/README.md).
