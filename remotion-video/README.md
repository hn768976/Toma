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

| id | size | duration | notes |
|---|---|---|---|
| `ParticleBrain` | 3840x2160 | 600f @ 30fps (20.0s) | Particle brain, seamless loop. See `src/particle-brain/`. |
| `ParticleBrainLoopCheck` | 3840x2160 | 601f @ 30fps | The same composition one frame longer, for verifying the loop. |
| `ParticleRingHalo` | 1920x1080 | 200f @ 25fps | Abstract particle-ring halo. |
| `ParticleRingHalo4K` | 3840x2160 | 200f @ 25fps | 4K variant of the above. |
| `BluetoothExplainer` | 1920x1080 | 30s | Hand-drawn Bluetooth explainer. |

### ParticleBrain

```console
npx remotion render ParticleBrain out/particle-brain.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

Takes a `variant` prop (`teal` | `ice` | `ember`). Every colour lives in
`src/particle-brain/theme.ts`. Reusable, subject-agnostic pieces live in
`src/lib/` and are catalogued in `../remotion-lib/CATALOG.md`.

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
