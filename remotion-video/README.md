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


## Circuit-board hologram compositions

Recreation of the "glowing cloud on a circuit board" stock clip, plus an
"AI chip" variant. 30 fps, 900 frames (30 s), H.264 MP4.

| Composition ID    | Content                        | Resolution  |
| ----------------- | ------------------------------ | ----------- |
| `CloudCircuit`    | Cloud hologram (like reference) | 1920 x 1080 |
| `CloudCircuit4K`  | Cloud hologram                  | 3840 x 2160 |
| `AiChipCircuit`   | AI chip hologram                | 1920 x 1080 |
| `AiChipCircuit4K` | AI chip hologram                | 3840 x 2160 |

The 4K compositions are the same picture scaled 2x (`resolutionScale: 2`),
so the 1080p and 4K renders match frame for frame.

**Render (1080p)**

```console
npx remotion render CloudCircuit out/cloud-circuit-1080p.mp4 --codec=h264
npx remotion render AiChipCircuit out/ai-chip-circuit-1080p.mp4 --codec=h264
```

**Render (4K)**

```console
npx remotion render CloudCircuit4K out/cloud-circuit-4k.mp4 --codec=h264
npx remotion render AiChipCircuit4K out/ai-chip-circuit-4k.mp4 --codec=h264
```

Add `--concurrency=<cores>` to speed things up. Source lives in
`src/circuit-hologram/`; tweak the look in `constants.ts` (colours, board
size, timing) and `CircuitHologram.tsx` (camera drift, board tilt,
hologram placement). All randomness is seeded (`seed` prop) so renders
are reproducible.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
