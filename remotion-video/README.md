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

## Shield status HUD (4K)

Two 30-second 4K compositions built entirely on a 2D `<canvas>` — no 3D, no
Three.js, no WebGL. They share one component tree and one `VARIANTS` object;
the variant decides palette, status wording, shield render mode, outline mode,
panel behaviour and glitch profile.

| Composition | Variant | Looks like | Loops? |
| --- | --- | --- | --- |
| `ShieldActive` | `active` | cyan; a glowing outlined shield with a dot-textured interior; steady panels | Yes — frame 0 and frame 900 are pixel-identical |
| `ShieldBreach` | `breach` | magenta; the shield inverted into a solid dark void with a burning exclamation; a fragmented boundary; panels that progressively fail | No — one-shot by design |

Both are 3840x2160, 900 frames at 30 fps.

```console
# 1080p previews (the compositions stay 4K; --scale only changes the capture)
npx remotion render ShieldActive out/shield-active-preview.mp4 --codec=h264 --crf=18 --scale=0.5
npx remotion render ShieldBreach out/shield-breach-preview.mp4 --codec=h264 --crf=18 --scale=0.5

# full 4K
npx remotion render ShieldActive out/shield-active.mp4 --codec=h264 --crf=12 --concurrency=8
npx remotion render ShieldBreach out/shield-breach.mp4 --codec=h264 --crf=12 --concurrency=8
```

Source lives in `src/shield/`. `scripts/make-zips.mjs` splits it into two
standalone, independently runnable projects — each carrying only its own
variant, with its own `Root.tsx` and README — and writes `shield-active.zip`
and `shield-breach.zip` to `build/`.

```console
node scripts/make-zips.mjs
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
