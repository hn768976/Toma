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

## Compositions

| ID | Size | Length |
| --- | --- | --- |
| `CyberAttack-1080p` / `CyberAttack-4K` | 1920x1080 / 3840x2160 | 210f @ 30fps (7.00s) |
| `SecurityBreach-1080p` / `SecurityBreach-4K` | 1920x1080 / 3840x2160 | 210f @ 30fps (7.00s) |
| `BluetoothExplainer` | 1920x1080 | 900f @ 30fps (30s) |
| `ParticleRingHalo` / `ParticleRingHalo4K` | 1920x1080 / 3840x2160 | 200f @ 25fps (8s) |

### Cyber alert (`src/cyber-alert`)

A dot-matrix LED wall running a hex dump, with a red alert badge cut into
it, shot on a drifting camera and torn apart by signal glitches. Two
variants share one component and differ only in their entry in `VARIANTS`
(`src/cyber-alert/constants.ts`): the icon sprite and the two headline
words.

Everything geometric is expressed in **dot units** — one unit is one LED
pitch — and converted to pixels once per frame by the projection. The 4K
compositions are therefore the same picture sampled finer, not a
separately tuned video, and a change to the layout moves both.

Render the deliverables:

```console
npm run render:cyber-attack-1080p
npm run render:cyber-attack-4k
npm run render:security-breach-1080p
npm run render:security-breach-4k
```

All four are H.264 in an MP4 and muted (the piece has no audio track).

To re-skin, edit `VARIANTS` for the words and `src/cyber-alert/icons.ts`
for the badge; sprites are authored as text, one character per LED, so a
new icon needs no asset pipeline. Glitch hit points live in `BURSTS`
(`src/cyber-alert/glitch.ts`) and the camera move in `cameraAt`
(`src/cyber-alert/camera.ts`).

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
