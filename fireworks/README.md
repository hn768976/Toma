# Fireworks — 4K night sky, right-clustered

A 4K fireworks loop over a deep blue night sky, with a soft city glow in the
upper left. Every burst is held in the right third of the frame, so the left two
thirds stays open for a title — which is what most firework stock footage does
not give you.

## Composition

| | |
|---|---|
| Composition id | `FireworksBlue` |
| Resolution | 3840 × 2160 (4K UHD) |
| Duration | 420 frames |
| Frame rate | 30 fps (14.0 seconds) |
| Loops | Yes — frame 420 is pixel-identical to frame 0 |
| Audio | None |

## Rendering

4K master:

```
npx remotion render FireworksBlue out/fireworks-blue.mp4 --codec=h264 --crf=12 --concurrency=8
```

CRF 12 is deliberate: fireworks are fine bright points against a dark sky,
which is the worst case for h264. A higher CRF smears the embers into blocks.

1080p preview:

```
npx remotion render FireworksBlue out/fireworks-blue-preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

Studio:

```
npm install
npm run dev
```

## How it is built

Everything is a pure function of `useCurrentFrame()`. There is no
`requestAnimationFrame`, no `Date.now()`, no component state and no CSS
animation, and every random value comes from Remotion's `random()` with a
stable string seed — so a render is deterministic and the loop closes exactly.
Drawing is 2D canvas only: no 3D, no WebGL, no footage.

A burst is not a radial particle spray. Each particle is emitted radially at a
near-uniform speed, loses speed to drag every frame, and accumulates downward
speed from gravity, so the sphere expands fast, slows hard, and then droops
into a weeping-willow shape as it cools from its own colour towards ember and
fades out. Trails sample that same motion at earlier frames, and about a
quarter of the particles flicker irregularly as they fall.

- `src/variants.ts` — the one place any colour is written down, plus sky mode,
  burst placement, burst rate and burst types for both versions.
- `src/physics.ts` — gravity, drag and the per-type shell parameters
  (peony, chrysanthemum, willow, crackle, ring).
- `src/particles.ts` — particle generation and the closed-form motion.
- `src/schedule.ts` — when and where every shell fires, multi-break shells, and
  the loop closure.
- `src/components/` — `NightSky`, `Shell`, `TrailLayer`, `Burst`; each draws
  into the shared canvas once per React render, in tree order.

Both versions live in one project and share every line of the engine; they
differ only by the entry in `VARIANTS`. The other composition in this project
is `FireworksBlack`.
