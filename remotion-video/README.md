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

**CodeGrid** — a 15 s, 30 fps seamless-looping flight over an endless field
of blocks etched with glowing source code. three.js rendered through
WebGPU. Two grades (blue, teal), each at 1080p and 4K. Read
[`src/code-grid/README.md`](./src/code-grid/README.md) before changing it:
the loop, the frame purity and the headless-WebGPU setup all have
constraints that are not obvious from the code.

```console
npm i
npm run render:blue        # 1920 x 1080, H.264
npm run render:teal
npm run render:blue-4k     # 3840 x 2160
npm run render:teal-4k
```

Also in this project: `BluetoothExplainer` and `ParticleRingHalo`, from
earlier work, unrelated to CodeGrid.

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
