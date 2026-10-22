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

## Particle Wave (4K)

A 3D particle-grid surface rolling in slow swells with a shallow depth of
field — crisp dots in the foreground melting into soft glowing ribbons
where the far surface folds. Drawn with raw WebGL 2 shaders
(`src/particle-wave/`), ~200k point sprites in one draw call.

- 30 fps, 600 frames (20 s), seamless loop
- Compositions are authored at **3840×2160**:
  - `ParticleWave4K` — silver/white palette (matches the reference)
  - `ParticleWaveAurora4K` — midnight indigo with cyan → violet → magenta particles
- Palettes live in `src/particle-wave/palettes.ts`; camera/lens in `ParticleWave.tsx`.

```console
npm i

# 1080p delivery (renders the 4K composition at half scale = supersampled)
npx remotion render ParticleWave4K out/ParticleWave-1080p.mp4 --scale=0.5 --codec=h264 --crf=16
npx remotion render ParticleWaveAurora4K out/ParticleWaveAurora-1080p.mp4 --scale=0.5 --codec=h264 --crf=16

# Full 4K
npx remotion render ParticleWave4K out/ParticleWave-4K.mp4 --codec=h264 --crf=16
```
