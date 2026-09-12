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

| ID | Size | Length |
| --- | --- | --- |
| `PlexusTunnelLight` | 1920x1080 | 18s @ 30fps |
| `PlexusTunnelLight4K` | 3840x2160 | 18s @ 30fps |
| `PlexusTunnelDark` | 1920x1080 | 18s @ 30fps |
| `PlexusTunnelDark4K` | 3840x2160 | 18s @ 30fps |
| `ParticleRingHalo` / `ParticleRingHalo4K` | 1920x1080 / 3840x2160 | 8s @ 25fps |
| `BluetoothExplainer` | 1920x1080 | 30s @ 30fps |

### Plexus tunnel

A camera flight through a hollow-cored cloud of nodes joined by hairline
edges, with distance fog and depth-of-field bokeh. `light` is the
near-white studio look; `dark` is the midnight-navy inversion with
glowing ice-blue nodes.

The animation is a **seamless loop**: node depths wrap modulo
`TUNNEL_DEPTH`, the camera travels exactly one `TUNNEL_DEPTH` over the
540 frames, and the camera sway and per-node wiggle both complete a whole
number of cycles, so frame 540 reproduces frame 0.

Geometry in `src/plexus/constants.ts` is authored in world units at 1080p.
`PlexusTunnel` derives its scale from the composition width, so the 4K
compositions are the same framing at higher resolution — there is nothing
to keep in sync by hand when adding another output size.

**Render 4K:**

```console
npx remotion render PlexusTunnelLight4K out/plexus-tunnel-light-4k.mp4 --codec=h264 --crf=18
npx remotion render PlexusTunnelDark4K out/plexus-tunnel-dark-4k.mp4 --codec=h264 --crf=18
```

Swap in `--codec=prores --prores-profile=4444` for an edit-ready master.

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
