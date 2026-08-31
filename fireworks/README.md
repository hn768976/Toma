# Fireworks — 4K Remotion composition

A 4K fireworks animation drawn entirely on a 2D canvas. No 3D, no WebGL, no
video footage.

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
which is the worst case for h264. A higher CRF smears the embers.

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

- `src/variants.ts` — the one place any colour is written down, plus sky mode,
  burst placement, burst rate and burst types per version.
- `src/physics.ts` — gravity, drag and the per-type shell parameters.
- `src/particles.ts` — particle generation and the closed-form motion.
- `src/schedule.ts` — when and where every shell fires, and the loop closure.
- `src/components/` — `NightSky`, `Shell`, `TrailLayer`, `Burst`; each draws
  into the shared canvas once per React render, in tree order.
