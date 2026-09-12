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

| ID | Size | FPS | Length | Notes |
| --- | --- | --- | --- | --- |
| `FinanceDashboard` | 1920x1080 | 30 | 10 s (300 frames) | Financial AI analytics dashboard, reference red/blue/green palette |
| `FinanceDashboard4K` | 3840x2160 | 30 | 10 s | Same piece at 4K (`resolutionScale: 2`) |
| `FinanceDashboardCyan` | 1920x1080 | 30 | 10 s | Dark-cyan palette |
| `FinanceDashboardCyan4K` | 3840x2160 | 30 | 10 s | Dark-cyan palette at 4K |
| `ParticleRingHalo` / `ParticleRingHalo4K` | 1080p / 4K | 25 | 8 s loop | Abstract particle-ring halo |
| `BluetoothExplainer` | 1920x1080 | 30 | 30 s | Hand-drawn explainer |

Render the dashboard, for example:

```console
npx remotion render src/index.ts FinanceDashboard out/FinanceDashboard-1080p.mp4 --codec=h264 --crf=16
npx remotion render src/index.ts FinanceDashboard4K out/FinanceDashboard-4K.mp4 --codec=h264 --crf=16
npx remotion render src/index.ts FinanceDashboardCyan4K out/FinanceDashboardCyan-4K.mp4 --codec=h264 --crf=16
```

The dashboard source lives in `src/finance-dashboard/`: `constants.ts` holds
timing, camera path and both palettes (`REFERENCE_THEME`, `DARK_CYAN_THEME`),
`board.ts` draws the dashboard onto a canvas, and `FinanceDashboard.tsx` adds
the 3D camera, bloom and depth-of-field layers. All motion is a pure function
of the frame, so renders are deterministic across parallel workers.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
