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

## Neon light streaks

An abstract neon light-trail loop: a bundle of glowing strands following an
S-curve that travels across frame, rebuilt procedurally so it renders at any
resolution. 30fps, 438 frames (14.6s), seamlessly looping.

Four compositions, two colour grades at two resolutions:

| Composition          | Grade                                  | Size      |
| -------------------- | -------------------------------------- | --------- |
| `NeonStreaksBlue`    | Blue/cyan bundle, magenta-violet accent | 1920x1080 |
| `NeonStreaksBlue4K`  | same                                   | 3840x2160 |
| `NeonStreaksViolet`  | Violet bundle, cyan accent             | 1920x1080 |
| `NeonStreaksViolet4K`| same                                   | 3840x2160 |

Render the 4K masters with:

```console
npx remotion render NeonStreaksBlue4K out/neon-streaks-blue-4k.mp4 \
  --codec=h264 --image-format=png --crf=15 --pixel-format=yuv420p
```

### How it works

`src/light-streaks/` holds the whole piece:

- `constants.ts` — timing, and the straight axis the wave lives on. Everything
  is authored against a 1920x1080 viewBox and scaled by the SVG, so the 4K
  compositions are true vector 4K rather than an upscale.
- `palettes.ts` — the two colour grades. Strand colours are picked per band
  (core / inner / mid / outer) plus a minority accent hue.
- `geometry.ts` — the centreline wave, the strand bundle, and the path sampler.
- `NeonLightStreaks.tsx` — the bloom stack: the same strands drawn four times
  at decreasing blur and increasing sharpness, screen-blended, with a final
  hard white pass down the middle of the bundle.

Two things to keep in mind when editing:

- **It is a loop.** Every temporal term is a sine of an *integer* multiple of
  `2*pi*t`, and every dash offset advances by a whole number of dash patterns
  over the clip. Introduce a non-integer rate and the loop will jump.
- **It is rendered out of order.** Remotion renders frames across parallel
  workers, so strand identity comes from a seeded PRNG keyed by strand index —
  never `Math.random()` or `Date.now()`.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
