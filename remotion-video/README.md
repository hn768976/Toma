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

## Newspaper headline shot (4K)

Two 4K (3840x2160), 30 fps, 10 s (300 frames) compositions in `src/newspaper/`:

| Composition ID | Camera |
| --- | --- |
| `NewspaperHeadline4K` | V1, matches the reference: low-angle close-up, slow truck right along the headline, gentle push-in |
| `NewspaperHeadlineOrbit4K` | V2: starts high on the body copy, cranes down and orbits to a low angle, racks focus onto the headline, then pushes in |

Both open with a defocus + RGB-split glitch-in and use shallow depth of field, paper texture, light leaks, film grain and a warm grade. The headline text is editable in Studio (props panel) or via `--props`.

```console
# 4K master
npx remotion render NewspaperHeadline4K out/v1-4k.mp4 --codec=h264 --crf=16
npx remotion render NewspaperHeadlineOrbit4K out/v2-4k.mp4 --codec=h264 --crf=16

# 1080p deliverable from the same 4K composition
npx remotion render NewspaperHeadline4K out/v1-1080p.mp4 --scale=0.5 --codec=h264 --crf=16
npx remotion render NewspaperHeadlineOrbit4K out/v2-1080p.mp4 --scale=0.5 --codec=h264 --crf=16
```

Camera moves live in `src/newspaper/camera.ts`, page layout in `src/newspaper/Page.tsx`. Fonts (Montserrat, PT Serif) are self-hosted under SIL OFL in `public/fonts`; textures in `public/textures` were generated with ffmpeg.
