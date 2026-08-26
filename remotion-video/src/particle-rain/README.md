# ParticleRain

Vertical streams of glowing dots falling through dark space. 3840×2160,
300 frames @ 30fps (10.0s), seamless loop.

## Files

| File | What lives here |
| --- | --- |
| `themes.ts` | **Every colour.** The `THEMES` object and the colour helpers. No other file in this folder contains a hex literal. |
| `constants.ts` | All tunable configuration: stream count, dot density, fall speed, lean angle, blur ceiling, glow strength, flow direction. |
| `random.ts` | Seeded value helpers over Remotion's `random()`. |
| `field.ts` | Builds the stream/dot/flare set once, seeded. |
| `sprites.ts` | Pre-tinted dot sprites and the grain tile. |
| `draw.ts` | Paints one frame onto the canvas. |
| `ParticleRain.tsx` | The component: memoises the field, draws on each render. |

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

## How the loop closes

Frame 0 and frame 300 are pixel-identical (verified: the two PNGs are
byte-for-byte equal at full 4K), and the 299 → 300 step is the same size as
any other frame step, so there is no jump at the seam.

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

## Reversing the flow

`FLOW_DIRECTION` in `constants.ts` is the single signed value that decides
which way the field travels — `1` for down, `-1` for up. Every position,
wrap and motion-blur calculation multiplies by it; nothing anywhere assumes
downward motion. A new palette is a new entry in `THEMES` plus its name in
`THEME_NAMES`, reached through the `variant` prop.

## Rendering

```sh
npx remotion render ParticleRain out/particle-rain-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8 --muted

npx remotion render ParticleRain out/particle-rain.mp4 \
  --codec=h264 --crf=12 --concurrency=8 --muted
```

`--muted` keeps Remotion from attaching a silent audio track. Lower
`--concurrency` to the number of CPU cores if the renderer rejects it.
