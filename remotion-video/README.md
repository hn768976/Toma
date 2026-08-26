# Particle Burst — two versions

A 4K "particle burst" built in Remotion: **one component, two variants**. Both
run 189 frames at 30fps (6.3s), one-shot, no loop. They share a palette, a
particle count, a gradient background and every drawing routine — what
separates them is motion and timing.

| Composition        | Variant       | Resolution  | Duration           | FPS |
| ------------------ | ------------- | ----------- | ------------------ | --- |
| `ParticleBurst`    | `"burst"`     | 3840 × 2160 | 189 frames (6.3 s) | 30  |
| `ParticleImplosion`| `"implosion"` | 3840 × 2160 | 189 frames (6.3 s) | 30  |

## Render

Previews (half scale, 1920 × 1080):

```console
npx remotion render ParticleBurst     out/particle-burst-preview.mp4     --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render ParticleImplosion out/particle-implosion-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

Full 4K:

```console
npx remotion render ParticleBurst     out/particle-burst.mp4     --codec=h264 --crf=12
npx remotion render ParticleImplosion out/particle-implosion.mp4 --codec=h264 --crf=12
```

`--concurrency` must not exceed the number of CPU cores on the rendering
machine; drop it (or lower the value) on a machine with fewer than 8.

Install and preview in the studio:

```console
npm i
npm run dev
```

## The two versions

**v1 — the burst.** Empty background for 20 frames, with a faint brightening at
the centre over the last five. Detonation at frame 20: particles appear at a
tight central point and accelerate outward on a decelerating curve, reaching
~30% of frame height by frame 45 — the brightest moment in the piece. They keep
expanding and slowing to a ring ~90% of frame width across by frame 130, the
clean ring loosening into a ragged annulus as angular positions drift apart.
From 130 they thin, fade and drift past the edges, back to the empty field with
a few stragglers holding on until near the end.

**v2 — the implosion.** Not the burst reversed. Particles are simply *there* at
the frame edges by frame 15, faint and scattered. From 15 to 120 they converge
inward while **accelerating** — the opposite curve from v1's detonation, which
is what stops the two reading as one event and its rewind — tightening to ~25%
of frame height and gathering angularly into a cleaner ring as they close. The
final rush runs 120–140, fastest at the very end, brightness spiking as the
crowding concentrates light. Then the payoff v1 has no equivalent for: a single
white-cyan radial flash at 140–155, blooming hard and decaying. The afterglow
ends on the same empty background v1 opens with.

## How it is built

Everything is a pure function of `useCurrentFrame()` — no `Date.now()`, no
`requestAnimationFrame`, no CSS animation, no component state. All random values
come from Remotion's `random()` with stable string seeds, so a particle's
identity is identical in every render worker and on every re-render.

```
src/particle-burst/
  theme.ts            THEMES — the only colour literals in the piece
  config.ts           per-variant timeline config, keyed by variant
  motion.ts           radius / angle / alpha / motion-blur maths
  particles.ts        the seeded 2200-grain swarm
  textures.ts         offscreen background, glow sprites, grain tiles
  GradientBackground.tsx  static background layer
  ParticleSwarm.tsx   the swarm layer
  CoreGlow.tsx        the central glow / flash layer
  ParticleField.tsx   the composition component (takes `variant`)
```

Three stacked canvases, each drawn once per React render through a ref:

- **`<GradientBackground>`** — a plain royal-blue gradient, brighter toward the
  top-left, with a large soft dark radial vignette slightly above frame centre.
  No texture of its own: the smooth field is what lets the grains read.
  Completely static, so it is rendered once into an offscreen canvas in a
  `useMemo` and blitted every frame.
- **`<ParticleSwarm>`** — ~2200 grains drawn as small squares (4–14px at 4K),
  snapped to an 8px grid so they fall into faint rows and columns. Weighted
  ~55% cyan / 20% white / 17% blue / 8% magenta, each with a pre-rendered glow
  sprite (the white ones bloom hardest), a seeded twinkle and a staggered
  death. Drawn additively into a transparent layer that composites normally
  over the field, so a lone cyan grain stays cyan and only genuinely dense
  clusters blow out toward white. Fine grain at 4% closes the layer.
- **`<CoreGlow>`** — the faint pre-detonation brightening in v1, the climax
  flash in v2. A soft gradient upscales perfectly, so this layer is drawn at
  quarter resolution and stretched.

### One signed value decides direction

`radialDirection` in the variant config is `+1` for the burst and `-1` for the
implosion, and every position runs through it:

```ts
radius = startRadius + radialDirection * distanceTravelled
```

`distanceTravelled` is never negative — it comes from the variant's travel
curve, which is a decelerating `drag` ease-out for the burst and an
accelerating `expo` ease-in for the implosion. The motion-blur trail, the
tangential drift and the ring's growth all fall out of the same value, so
nothing in the project hardcodes outward or inward motion.

Multi-draw motion blur follows the speed: 4 passes along the radial vector at
the burst's detonation, tapering to a single draw by frame 90 once the swarm
has slowed, and rising to 6 passes through the implosion's collapse, where
everything is moving fast inside a small area and strobes worse.

## Other compositions in this project

`BluetoothExplainer` (1920×1080, 900 frames @ 30fps) and `ParticleRingHalo`
(1920×1080, 200 frames @ 25fps) are unrelated pieces that live in the same
Remotion project.

## Remotion

- [Fundamentals](https://www.remotion.dev/docs/the-fundamentals)
- [Discord](https://discord.gg/6VzzNDwUwV) · [Issues](https://github.com/remotion-dev/remotion/issues/new)
- Note that for some entities a company license is needed.
  [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
