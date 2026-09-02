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

## 4K HUD dashboard — `HudCentreWifi` / `HudCentreCrypto` / `HudCentreRadar`

Three versions of one 4K (3840x2160) HUD dashboard motion graphic, 450 frames
at 30fps (15.0s), seamlessly looping. 2D canvas only — no 3D, no Three.js.

```console
npx remotion render HudCentreWifi   out/hud-wifi.mp4   --codec=h264 --crf=12 --concurrency=8
npx remotion render HudCentreCrypto out/hud-crypto.mp4 --codec=h264 --crf=12 --concurrency=8
npx remotion render HudCentreRadar  out/hud-radar.mp4  --codec=h264 --crf=12 --concurrency=8
```

`--concurrency` must not exceed the machine's CPU core count.

### One dashboard, three versions

The three versions share an identical surrounding dashboard. That is enforced
structurally rather than by discipline: `<Dashboard>` (`src/hud-centre/components/Dashboard.tsx`)
takes no variant prop at all, so it cannot see which version it is in and the
panels cannot drift. Exactly three values differ between versions, and they
all live in one `VARIANTS` object in `src/hud-centre/variants.ts`:

| | centre element | accent | ID label |
|---|---|---|---|
| `wifi` | three pulsing arcs above a dot | `#3FD4E8` | `BC-344` |
| `crypto` | the Bitcoin mark, filled, chromatic-fringed | `#4FD4F5` | `BC-754` |
| `radar` | a full radar scope filling the stage | `#4FE8C4` | `BC-890` |

Verified by diffing rendered frames: outside the centre stage and the ID
label, the three versions are pixel-identical.

### Determinism and the loop

Every frame is a pure function of its frame number. One `useCurrentFrame()`
call, in `HudCentre.tsx`, wrapped with `loopFrame()` and threaded down as a
plain number — no `requestAnimationFrame`, no component state, no `Date.now()`,
and all randomness through Remotion's `random()` with stable string seeds.

Every periodic motion uses a period that **divides 450**, so the motion is
continuous across the cut, not merely equal at the ends. Frame 450 is
byte-identical to frame 0.

### Performance

Each panel's static chrome — border, corner ticks, label strip, grids, axis
text — is rasterised once into an offscreen canvas (`makeSprite` + `useMemo`)
and blitted. Only values, bars, arcs, the sweeps and the centre element are
redrawn per frame.

### Shared component library

Reusable pieces live in [`../remotion-lib`](../remotion-lib/CATALOG.md) and are
imported through the `@lib` alias, configured in both `remotion.config.ts` and
`tsconfig.json`.

### Standalone distributables

```console
node scripts/package-standalone.mjs
```

Writes `hud-centre-wifi.zip`, `hud-centre-crypto.zip` and
`hud-centre-radar.zip` — one self-contained Remotion project each, with the
library vendored into `src/lib`, and excluding `node_modules/`, `out/` and
`.git/`.
