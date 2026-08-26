# ParticleRain

Vertical streams of glowing dots drifting through dark space. 3840×2160,
300 frames @ 30fps (10.0s), seamless loop.

Two compositions share one component; they differ only by the `variant` prop:

| Composition | Variant | Reads as |
| --- | --- | --- |
| `ParticleRain` | `cyan` | Rain falling away from a light above the top edge. |
| `ParticleRiseGold` | `gold` | Embers rising away from a light below the bottom edge. |

## Files

| File | What lives here |
| --- | --- |
| `themes.ts` | **Every colour.** The `THEMES` object and the colour helpers. No other file in this folder contains a hex literal. |
| `variants.ts` | **Everything that varies per variant:** theme, flow direction, lean, base speed, source-glow position. |
| `constants.ts` | Configuration shared by every variant: stream count, dot density, depth spread, blur ceiling, glow strength, bloom, vignette, grain, drift. |
| `random.ts` | Seeded value helpers over Remotion's `random()`. |
| `field.ts` | Builds the stream/dot/flare set once, seeded, for a given variant. |
| `sprites.ts` | Pre-tinted dot sprites and the grain tile. |
| `draw.ts` | Paints one frame onto the canvas. |
| `ParticleRain.tsx` | The component: memoises the field, draws on each render. |

The split between `variants.ts` and `constants.ts` is the point: a new
variant should be a data change in `variants.ts` (plus its palette in
`themes.ts`), never a code change in `field.ts` or `draw.ts`.

## How it stays deterministic

- Every frame is a pure function of `useCurrentFrame()`. No `Date.now()`, no
  `requestAnimationFrame`, no CSS animation, no component state.
- Every value comes from Remotion's `random()` with a stable string seed,
  never `Math.random()`.
- The field is generated **once** (`useMemo`) and reused for every frame.
  Regenerating it per frame would re-roll each dot's identity every frame and
  the field would boil.

Remotion renders frames out of order across worker processes, so any of the
above would desynchronise the workers.

## Direction

`flowDirection` on a variant is the single signed value that decides which
way the field travels — `1` for down, `-1` for up. Dot motion, wrap
direction and the motion-blur vector all multiply by it; nothing anywhere
assumes a direction. The stream *axis* deliberately does not flip: lean is
geometry, not motion, so reversing the flow does not mirror the field.

The source glow moves with the flow. It has to: a light left at the top
while the particles rise would fight the motion and read as the rain played
backwards.

## How the loop closes

Frame 0 and frame 300 are pixel-identical for **both** variants (verified:
the PNGs are byte-for-byte equal at full 4K), and the 299 → 300 step is the
same size as any other frame step, so there is no jump at the seam.

- **Wrapping.** A stream's dot pattern must travel a whole number of
  pattern-lengths in 300 frames. Rather than quantise the *speed* to achieve
  that — which would collapse the parallax into a handful of discrete speed
  bands — the pattern *length* absorbs the remainder: pick the largest whole
  number of cycles that still leaves the pattern at least a frame-height
  long, then stretch the pattern to fit. Speed stays exactly `z * base`.
- **Twinkle.** Every period in `TWINKLE_PERIODS` divides 300.
- **Flares.** Start frames live in `[0, 300)` and the active test wraps
  modulo the loop, so a flare straddling the seam plays across it unbroken.
- **Grain.** One seeded tile, slid to a new seeded origin per `frame % 300`.
- **Drift.** One revolution of a closed ellipse per loop.

### The speed floor

One wrap cycle per loop needs `speed * 300 >= HEIGHT + 2 * WRAP_MARGIN_PX`,
so `baseFallSpeedPx` has a floor of about **39 px/frame** at these
dimensions. `cyan` runs 42 and clears it. `gold` runs 33.6 (embers rise
slower than rain falls), which leaves the slowest ~4% of its streams — the
dimmest and smallest in the field — unable to fit a whole cycle. There is no
way to keep both an exact speed and a non-repeating pattern for those, so
`wrapGeometry` holds them at the floor speed: at most ~16% faster than
`z * base`, on the least visible streams in the frame. Everything else keeps
its exact speed.

## Rendering

```sh
npx remotion render ParticleRain out/particle-rain-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8 --muted
npx remotion render ParticleRain out/particle-rain.mp4 \
  --codec=h264 --crf=12 --concurrency=8 --muted

npx remotion render ParticleRiseGold out/particle-rise-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8 --muted
npx remotion render ParticleRiseGold out/particle-rise.mp4 \
  --codec=h264 --crf=12 --concurrency=8 --muted
```

`--muted` keeps Remotion from attaching a silent audio track. Lower
`--concurrency` to the number of CPU cores if the renderer rejects it.
