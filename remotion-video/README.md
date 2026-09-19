# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

## Compositions

| ID | Size | Length | Notes |
|---|---|---|---|
| `WovenTexture-01-CanvasWhite-1080p` | 1920x1080 | 10s / 30fps | bright cotton canvas, after reference A |
| `WovenTexture-01-CanvasWhite-4K` | 3840x2160 | 10s / 30fps | same cloth, 4K master |
| `WovenTexture-02-WeaveGrey-1080p` | 1920x1080 | 10s / 30fps | dense grey weave, after reference B |
| `WovenTexture-02-WeaveGrey-4K` | 3840x2160 | 10s / 30fps | same cloth, 4K master |
| `BluetoothExplainer` | 1920x1080 | 30s / 30fps | earlier work, unrelated |
| `ParticleRingHalo` / `-4K` | 1920x1080 / 3840x2160 | — | earlier work, unrelated |

The four `WovenTexture-*` compositions are procedural fabric, generated with
PixiJS v8 and a custom WebGL shader. **See [`src/weave/README.md`](src/weave/README.md)**
for how the cloth is modelled, what was measured off the reference clips, and
why the clips loop seamlessly. Every look parameter is a validated prop, so both
variants can be re-graded live from the Studio sidebar.

Note that these need WebGL. On a machine without a GPU, `remotion.config.ts`
already points Chromium at ANGLE's SwiftShader backend; it renders at roughly
one 1080p frame per second at concurrency 3.

```console
npm i
npm run verify:loop   # assert the seamless-loop properties still hold
npm run dev           # Remotion Studio
./package-project.sh  # rebuild the handoff zip
```

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
