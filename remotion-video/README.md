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

## Code Grid (glass-cube code wall)

A lattice of glowing glass cubes, each holding a scrolling code screen,
with light rays, dust and bloom. three.js (WebGL2) + `UnrealBloomPass`,
driven frame-by-frame by Remotion. Source: `src/code-grid/`.

| Composition       | Size      | FPS | Length            | Palette                 |
| ----------------- | --------- | --- | ----------------- | ----------------------- |
| `CodeGrid4K`      | 3840x2160 | 30  | 447 frames, 14.9s | Cyber Blue (reference)  |
| `CodeGridEmber4K` | 3840x2160 | 30  | 447 frames, 14.9s | Ember Gold (alternate)  |

Render (H.264 MP4):

```console
npm run render:codegrid:1080p   # 4K compositions downscaled to 1920x1080
npm run render:codegrid:4k      # full 3840x2160
```

On a machine without a GPU (servers, containers) swap `--gl=angle` for
`--gl=swangle` (software WebGL; ~2-3 s per frame).

Palettes live in `src/code-grid/palettes.ts`; add one there and to the
`palette` enum in `CodeGrid.tsx` to make another colorway.
