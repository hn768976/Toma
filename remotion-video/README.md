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

## The AI search bar

Three versions of a 4K (3840x2160), 480-frame, 30 fps seamless loop of a search
bar typing a term, holding it, deleting it and starting again.

| Composition | Term | Treatment |
| --- | --- | --- |
| `SearchBarCyan` | `AI AGENTS` | Deep navy, glowing cyan pill, square columns |
| `SearchBarGreen` | `MACHINE LEARNING` | Terminal: square corners, monospace, live result count |
| `SearchBarLight` | `HOW DOES AI` | Light mode: drop shadow, autocomplete panel |
| `SearchBarOverview` | `AI OVERVIEW` | Pure black: a pointer drives the search, a results panel opens |
| `SearchBarClean` | `NEURAL NETWORK` | Pure white: a pointer, then a blue circle wipe |
| `SearchBarCleanAlt` | `DEEP LEARNING` | The clean variant against a second term |

All three are the same component and the same typing engine; a variant key in
`src/search-bar/variants.ts` selects the palette, the term, the bar style, the
background mode and the extras. That file is the only place a colour value or a
search string appears.

The last three are staged rather than looping: `stages.ts` resolves an
interactive timeline — a bar entrance, a mouse pointer, a click, a panel, a
wipe — as a pure function of the frame, so they stay as deterministic as the
rest.

Everything is drawn to canvases from `useCurrentFrame()` alone, so a render is
deterministic and frame 480 is byte-identical to frame 0.

`scripts/regression-frames.mjs` renders a fixed set of frames from the original
three compositions and hashes them, so a change to the shared engine can be
proven not to have altered any existing output.

```console
npx remotion render SearchBarCyan out/searchbar-cyan.mp4 --codec=h264 --crf=14 --concurrency=8
```

To package each version as its own standalone project:

```console
node scripts/build-variant-zips.mjs      # writes dist-zips/search-bar-*.zip
```

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
