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

---

## Geodata HUD compositions

Three versions of a 4K "geodata HUD dashboard", all 3840 × 2160, 900 frames at
30fps (30.0s), all seamlessly looping.

| Composition | What it is |
| --- | --- |
| `GeoHudBlue` | v1 — flat, frontal, centred layout, geodata readouts, pink accent |
| `GeoHudGreen` | v2 — offset layout (map left, dense data right, full-width trace along the bottom), network readouts, amber accent |
| `GeoHudTilted` | v3 — v1's dashboard re-rendered as a texture on a tilted plane in `@remotion/three`, with a camera moving across it |
| `GeoHudLoopCheck` | QA only — v1 at 901 frames, so frames 0 and 900 can be compared |
| `GeoHudTiltedLoopCheck` | QA only — v3 at 901 frames, same purpose |

The dashboard is a self-contained canvas renderer (`src/geo-hud/dashboard.ts`)
that draws a whole 3840 × 2160 frame into *any* 2D context. v1 and v2 point it
at the composition's own canvas; v3 points it at an offscreen buffer and uploads
that buffer as a `THREE.CanvasTexture`. v3 therefore re-renders v1 rather than
rebuilding it.

`src/geo-hud/variants.ts` is the single source of every palette, layout mode,
readout domain and render mode — no hex literal exists anywhere else.

See `CAMERA-NOTES.md` for v3's plane, camera path, texture pipeline and post
settings.

### Rendering

```console
npx remotion render GeoHudBlue   out/geohud-blue-preview.mp4   --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render GeoHudGreen  out/geohud-green-preview.mp4  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render GeoHudTilted out/geohud-tilted-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=4
```

`--concurrency` must not exceed the machine's core count; `GeoHudTilted` needs a
low value because each worker holds a 4K WebGL context as well as a 4K canvas.

### Standalone deliverables

`node scripts/package-geo-hud.mjs` (from the repository root) builds three
self-contained, independently runnable Remotion projects into `dist/`:
`geo-hud-blue.zip`, `geo-hud-green.zip` and `geo-hud-tilted.zip`. Each contains
only one composition, only the components and dependencies that version needs,
and its own README.

### Map data

Natural Earth 110m country polygons, in `public/geo/countries-110m.json`.
Natural Earth data is public domain — no permission or attribution required.
All on-screen text is invented.
