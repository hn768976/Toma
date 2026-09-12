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

## Celestial flythrough

A procedural flight through a starfield and nebula, rebuilt from a 5 s
reference plate. Two colour treatments, each in a matched 1080p / 4K pair:

| Composition ID | Look | Size |
| --- | --- | --- |
| `CosmicFlight-Celestial-1080p` | Blue-teal clouds, warm amber knots | 1920x1080 |
| `CosmicFlight-Celestial-4K` | same | 3840x2160 |
| `CosmicFlight-Violet-1080p` | Violet clouds, warm amber knots | 1920x1080 |
| `CosmicFlight-Violet-4K` | same | 3840x2160 |

All four are 30 fps, 150 frames (5.000 s), one-shot (no loop).

**Render the 1080p deliverables**

```console
npx remotion render CosmicFlight-Celestial-1080p out/cosmic-flight-celestial-1080p.mp4 --muted
npx remotion render CosmicFlight-Violet-1080p    out/cosmic-flight-violet-1080p.mp4    --muted
```

**Render 4K**

```console
npx remotion render CosmicFlight-Celestial-4K out/cosmic-flight-celestial-4k.mp4 --muted
npx remotion render CosmicFlight-Violet-4K    out/cosmic-flight-violet-4k.mp4    --muted
```

Codec, CRF, pixel format and colour space come from `remotion.config.ts`
(H.264 / CRF 17 / `yuv420p` limited range / bt709). `--muted` drops the
silent AAC track Remotion adds by default — without it the container
reports 5.056 s instead of 5.000 s. 4K takes roughly 4x as long as 1080p;
there is nothing else to change, the compositions share one component.

### How it is built

`src/cosmos/`

| File | Role |
| --- | --- |
| `constants.ts` | Timing, camera, and the two palettes |
| `noise.ts` | Value noise, fBm and the ridged variant behind the filaments |
| `random.ts` | Seeded PRNG (the layout must be identical in every render tab) |
| `textures.ts` | Bakes the nebula puff and star sprites (cached per tab) |
| `scene.ts` | Deterministic layout of every puff, star and warm knot |
| `draw.ts` | Per-frame canvas render |
| `CosmicFlight.tsx` | The Remotion component |

Two things are worth knowing before editing it:

**Everything is authored in normalised screen units.** A puff or star
records where it sits on screen at frame 0 as a fraction of the frame,
plus a depth `z`. Projection is then a single growth factor
`g = z / (z - camZ)` applied to both its offset from the vanishing point
and its size. That is why the 1080p and 4K compositions cannot drift
apart — there are no pixel values in the layout — and why you can move a
cloud by nudging a number between -0.5 and 0.5.

**The nebula is scattered sprites, not one big texture.** Blowing up a
single full-frame cloud turns to mush at 4K as the camera pushes in.
Instead ~65 individually placed puffs sit at their own depths, so each
one stays near its native resolution and keeps its filaments, and the
depth spread gives real parallax rather than a flat zoom.

### Tuning

- Overall look: `CELESTIAL_PALETTE` / `VIOLET_PALETTE` in `constants.ts`.
  Note the violet tints are deliberately darker than their blue
  counterparts — violet reads much brighter at the same hex value.
- Camera speed: `CAMERA_TRAVEL` (how far the camera moves over the clip).
- Cloud shape: the `layArm` calls in `scene.ts` — each is a bowed curve
  through 3D space with a puff count, size ramp and alpha ramp.
- Cloud texture: `bakePuff` in `textures.ts`. The `body` and `strands`
  terms trade diffuse gas against bright filaments; raising the exponent
  on `strands` makes it wirier, lowering it makes it foggier.
- Star population: `STAR_COUNT` / `CLUSTER_STAR_COUNT` in `constants.ts`,
  or the `starDensity` prop per composition.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
