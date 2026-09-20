# Remotion video

## Liquid Blobs

The loopable 3D liquid-droplet piece lives in [`src/liquid-blobs`](src/liquid-blobs/README.md)
— four colourways, 30fps, 358 frames (11.93s), seamless loop, with both
1920×1080 and 3840×2160 compositions.

```console
npm i
./render-liquid-blobs.sh 4K          # all four colourways at 3840x2160
./render-liquid-blobs.sh 1080p       # all four at 1920x1080
npm run dev                          # open the Studio and scrub
```

`render-liquid-blobs.sh` defaults to SwiftShader (`--gl=swangle`) so it works
on a machine with no GPU. On real hardware set `REMOTION_GL=angle` — it is by
far the biggest cost in the render. The composition itself prefers WebGPU and
falls back to WebGL2 on its own; see the module README for how that is chosen.

Read [`src/liquid-blobs/README.md`](src/liquid-blobs/README.md) for the
rendering backend, the shader, the loop construction, and how to check a
choreography change before spending a render on it.

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
