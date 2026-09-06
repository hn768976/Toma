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

## Monochrome System Dashboard

Two variants of a dense white-on-black technical interface, 20s at 30fps.
Both compositions are defined at **3840x2160** so they can be rendered at 4K.

| Composition ID | Variant |
|---|---|
| `SystemDashboardMono` | V1 - monochrome white/grey |
| `SystemDashboardCyan` | V2 - pale cyan on steel blue |

**Render at 4K**

```console
npx remotion render SystemDashboardMono out/V1_SystemDashboardMono.mp4 --scale=1 --crf=16
npx remotion render SystemDashboardCyan out/V2_SystemDashboardCyan.mp4 --scale=1 --crf=16
```

**Render a 1080p preview** (exact half-scale of the 4K render)

```console
npx remotion render SystemDashboardMono out/V1_SystemDashboardMono.mp4 --scale=0.5 --crf=18
npx remotion render SystemDashboardCyan out/V2_SystemDashboardCyan.mp4 --scale=0.5 --crf=18
```

**Stills**

```console
npx remotion still SystemDashboardMono out/V1_SystemDashboardMono.png --frame=500 --scale=0.5
npx remotion still SystemDashboardCyan out/V2_SystemDashboardCyan.png --frame=500 --scale=0.5
```

### How it is built

- `src/system-dashboard/` - everything for this clip.
  - `constants.ts` - the 3840x2160 design space, frame rate, duration and stroke weights.
  - `theme.ts` - the two palettes, supplied through a context so one component tree serves both variants.
  - `random.ts` - mulberry32, seeded. Table contents, meter targets, waveform data and flicker schedules all come from here, so every render is identical.
  - `anim.ts` - build-in ramps, drifting meter values, blink and flicker schedules and ticking digits. Every one is a pure function of the current frame; there is no state and no timer, because Remotion renders frames out of order across threads.
  - `primitives.tsx` / `modules/` - the module library (table, meter, waveform, scanner, paragraph block, bar row and the rest). The layout is many instances of these with different props.
  - `SystemDashboard.tsx` - the layout itself.
- Structure is SVG, text is DOM, in one absolutely-positioned layout, so the small type stays crisp at any scale.
- The whole layout is authored in design units and scaled by `width / 3840`, so the 1080p preview is a pixel-exact half of the 4K render. A `HAIRLINE` of 2 design units is 1px at 1080p and 2px at 4K.
- Fonts (Barlow Semi Condensed, Roboto Mono) are self-hosted in `public/fonts` and registered behind `delayRender()`, so no frame is captured with a substituted face. Both are licensed under the SIL Open Font License 1.1.
- Text is Latin filler plus invented short codes. No brand names, product names, hostnames, addresses or file paths appear anywhere in the frame.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
