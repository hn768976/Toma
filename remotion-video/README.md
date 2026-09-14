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

## Code wall (digital data-screen motion graphic)

A slowly drifting 3D field of translucent code panels and HUD frames, shot
with a shallow depth of field. 20.000s, 30fps, H.264/MP4, no audio —
matching the length of the reference clip it was built from.

Two colourways, each mastered at 4K with a matching 1080p composition:

| Composition ID     | Size        | Look                                            |
| ------------------ | ----------- | ----------------------------------------------- |
| `CodeWallBlue4K`   | 3840 x 2160 | Cyan/teal code on deep navy, orange-red accents |
| `CodeWallBlue1080` | 1920 x 1080 | Same, 1080p                                     |
| `CodeWallGreen4K`  | 3840 x 2160 | Phosphor green on near-black, same accents      |
| `CodeWallGreen1080`| 1920 x 1080 | Same, 1080p                                     |

### Rendering

```console
npm run render:wall:blue      # 1080p blue
npm run render:wall:green     # 1080p green
npm run render:wall:blue4k    # 4K blue
npm run render:wall:green4k   # 4K green
npm run render:wall:all       # all four
```

4K renders roughly 4x the pixels of 1080p and holds ~2x the panel-bitmap
memory. On a machine with little RAM per core, add `--concurrency=2`.

### How it works

Everything lives in `src/code-wall/`:

| File           | Role                                                              |
| -------------- | ----------------------------------------------------------------- |
| `constants.ts` | Timing, projection, depth-of-field, camera path, bloom             |
| `themes.ts`    | The two colourways                                                 |
| `content.ts`   | The code listings and HUD labels the panels are filled with        |
| `field.ts`     | Panel field generation, camera path, circle-of-confusion model     |
| `draw.ts`      | Rasterising one panel to an offscreen bitmap                       |
| `CodeWall.tsx` | Per-frame compositing: backdrop, panels, streaks, bloom, vignette  |

A few decisions worth knowing before editing:

- **It's a canvas, not DOM.** The wall is ~185 panels of up to 26 lines
  each, every one needing its own blur. No browser will lay that out as DOM
  nodes at 30fps.
- **Panels are rasterised once, then blitted.** Each panel is drawn into an
  offscreen canvas at roughly its on-screen size and reused for every frame.
  Re-laying out 10px text at sub-pixel offsets each frame makes the whole
  wall shimmer; this also removes text layout from the per-frame cost.
- **Filtered draws are clipped.** `ctx.filter = "blur(...)"` makes Chrome
  allocate an intermediate layer sized to the *clip region*, so blurring 185
  panels without a clip means 185 full-frame allocations per frame. Clipping
  each one to its own footprint first is a ~5x speedup on the whole render.
- **Panels composite with `source-over`, not `screen`.** Screen-blending a
  hot orange bar over the navy backdrop lifts its blue channel and turns it
  salmon. The additive, everything-glows quality comes from the bloom pass.
- **Resolution independence.** The scene is drawn in 1920x1080 logical units
  on a backing store `resolutionScale` times larger, so 1080p and 4K are the
  same frame at two sizes. `resolutionScale` must always equal
  `width / 1920` — that pairing is set in `Root.tsx`.
- **Nothing is random at render time.** Frames are rendered out of order
  across worker processes, so the field, the streaks and every per-panel
  detail are pure functions of `seed` (see `random.ts`). Changing `seed` in
  a composition's `defaultProps` relays out the whole wall without touching
  the look.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
