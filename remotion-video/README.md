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

| ID | Size | FPS | Length |
| --- | --- | --- | --- |
| `MarketMapBearish` | 1920x1080 | 30 | 360 frames (12.000s) |
| `MarketMapBullish` | 1920x1080 | 30 | 360 frames (12.000s) |
| `MarketMapBearish4K` | 3840x2160 | 30 | 360 frames (12.000s) |
| `MarketMapBullish4K` | 3840x2160 | 30 | 360 frames (12.000s) |
| `ParticleRingHalo` / `ParticleRingHalo4K` | 1920x1080 / 3840x2160 | 25 | 200 frames |
| `BluetoothExplainer` | 1920x1080 | 30 | 900 frames |

### Market map

A global market dot-map: the continents drawn as a lattice of glowing LEDs on
a plane tilted away from the camera, over a receding ground grid, with
percentage readouts floating above it. It comes in two cuts:

- **Bearish** - red, background candlestick series trends down, arrows point
  down.
- **Bullish** - green, and all of that inverted. See `src/market-map/theme.ts`:
  the variants differ in motion and direction, not only in colour.

Everything goes through one pinhole camera in `src/market-map/projection.ts`,
so the dots, grid, candle bodies and label anchors share a single vanishing
point and depth scale. Dot spacing tightens towards the horizon because it is
stepped in plane space and then projected, never faked in screen space.

The 4K compositions differ from their 1080p counterparts only in
`resolutionScale`, so the two stay in visual sync. Note that dot COUNTS stay
fixed across resolutions while sizes scale - the map has a fixed number of
LEDs, so 4K is the same map rendered larger, not a denser one.

All periodic motion uses a period that divides the 360-frame length, so the
clip loops seamlessly.

**Render the deliverables**

```console
npx remotion render MarketMapBearish out/market-map-bearish-1080p.mp4 --codec=h264 --crf=16 --jpeg-quality=100
npx remotion render MarketMapBullish out/market-map-bullish-1080p.mp4 --codec=h264 --crf=16 --jpeg-quality=100
```

**Render 4K**

```console
npx remotion render MarketMapBearish4K out/market-map-bearish-4k.mp4 --codec=h264 --crf=16 --jpeg-quality=100
npx remotion render MarketMapBullish4K out/market-map-bullish-4k.mp4 --codec=h264 --crf=16 --jpeg-quality=100
```

### Regenerating the world map data

`src/market-map/world-dots.ts` is generated, not hand-written. It is baked from
the `world-atlas` land outline so the project needs no geo dependency at render
time:

```console
node tools/gen-world-dots.mjs src/market-map/world-dots.ts
```

The generator runs a land-lookup self-test over 21 known land/ocean
coordinates and fails rather than emitting a bad map. Natural Earth's outlines
are not cut at the antimeridian, so the generator unwraps ring longitudes
before ray-casting; without that, wrapped rings such as Eurasia smear into
bands that mark whole oceans as land.

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
