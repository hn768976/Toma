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

### Formula field (4K, 20s, seamless loop)

Three versions of a field of scientific notation drifting through a dark
volume. All three are 3840×2160, 600 frames at 30fps, and loop seamlessly —
frame 600 renders pixel-identical to frame 0.

| Composition | Version | Motion |
| --- | --- | --- |
| `FormulaFieldBlue` | Chemistry — skeletal structures and balanced equations | Approaching: far to near, spreading outward from frame centre |
| `FormulaFieldGreen` | Mathematics — integrals, matrices, built-up fractions | Receding: near to far, drawing inward to a vanishing point above centre |
| `FormulaFieldAmber` | Physics — equations mixed half and half with diagrams | Lateral: horizontal drift at constant scale, depth as parallax only |

Palette, notation set, motion mode and depth range for all three live in
`src/formula-field/variants/`; nothing else in the project contains a colour
or a formula. `NotationSheet` is a proofing composition that lays a version's
whole notation set out on one frame so the science can be checked:

```console
npx remotion still NotationSheet out/sheet.png --props='{"variant":"chem"}'
```

`LoopCheck` is the same component over 601 frames, for verifying that frame 0
and frame 600 are identical.

Render a 1080p preview of any of them by adding `--scale=0.5`; render at 4K by
leaving it off.

**Ship a single version.** `npm run build-packages` writes three
self-contained, independently runnable projects to `packages/` and zips each
one — `formula-field-chem.zip`, `formula-field-math.zip`,
`formula-field-physics.zip`. Each contains only its own composition and its
own variant data.

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
