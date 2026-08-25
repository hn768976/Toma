# Crypto Terminal — 4K light-mode macro animation

A 27-second seamless loop: a macro shot of a candlestick chart on a white
trading terminal, shot off-axis with shallow depth of field. Built in Remotion,
rendered to a single `<canvas>`.

```
npm install
npm run dev                       # Remotion Studio
npm run build                     # 4K master, out/crypto-terminal.mp4
```

The full render command:

```
npx remotion render CryptoTerminal out/crypto-terminal.mp4 \
  --codec=h264 --crf=14 --concurrency=8
```

Add `--scale=0.5` for a 1080p preview. The scene is always drawn into a
3840×2160 backing store and downsampled at capture, so a preview and the master
differ only in output resolution. Output is muted in `remotion.config.ts` —
otherwise Remotion muxes a silent audio track into every render.

| | |
|---|---|
| Composition | `CryptoTerminal` |
| Resolution | 3840 × 2160 |
| Frame rate | 60 fps |
| Duration | 1620 frames — 27.0 s, seamless |

## Determinism

Every value on screen is a pure function of `useCurrentFrame()`. There is no
`Date.now()`, no `requestAnimationFrame`, no CSS animation and no component
state; the canvas is redrawn once per React render from a `useLayoutEffect`.
All randomness comes from Remotion's `random()` with fixed string seeds, so the
price series is byte-identical on every machine and every render.

Fonts are self-hosted in `public/fonts` rather than fetched from Google. A
render that reaches the network is a render that can fail — or, worse, silently
fall back to a proportional face, which makes the axis numerals jitter as they
count up. Both files are variable-weight woff2, loaded through the `FontFace`
API and gated with `delayRender()` / `continueRender()`.

## How the loop closes

Three separate cycles all have to land on frame 1620 at once.

**The scroll** covers exactly one series period. The price series is built so
that candle `i` and candle `i + 260` are the same candle, which makes the
translate seamless without any crossfade:

- the *envelope* is the integral of a mean-removed periodic bias, so it returns
  to its starting level by construction;
- the *detail* is a mean-reverting walk over seeded impulses, iterated twelve
  times around the loop until the transient falls below float precision.

Splitting the series in two is what makes it tunable at all: with a single
random walk, shrinking it to keep the trace on screen shrinks the candles with
it. Here `ENVELOPE_SWING` sets how far the trace wanders and `DETAIL_SWING` sets
how tall the candles are, independently.

**The axis rescale** is decoupled from the candle geometry. The candles' pixel
positions come from the tiling series; the displayed prices come from a separate
mapping that ramps 4,000 → 60,000 and eases back over the final 120 frames. Tying
the numbers to the geometry would force either a flat axis or a broken loop —
and behind 30px of blur, nobody can measure the difference. The cost is the one
the spec anticipated: a fast rewind of the numerals in the last two seconds.

**The breathe and the grain** use a period of 540 frames and `frame % 1620`
respectively.

The loop is verified, not assumed: frame 0 and frame 1620 decode to identical
raw RGB. Anything periodic in the scroll has to have a period that *divides* 260
for that to hold — the vertical grid rules are spaced 13 candles apart for
exactly this reason.

## The camera

One affine transform, applied once with `ctx.setTransform()`. The tilt was
measured off the reference footage rather than guessed: horizontal rules and
text run about 3.6° **downhill** to the right, while verticals lean about 11°
with their tops to the right. A single rotation cannot produce both, so the
rotation carries the 3.6° and a horizontal shear carries the rest. Parallel
lines stay parallel — this is a fake, not a projection, and at this blur level
a real one would be indistinguishable.

## Depth of field on a white screen

Everything about defocus inverts here. Nothing is emissive, nothing blooms:
out-of-focus regions wash out toward white and lose contrast instead of fading
to black.

The scene is drawn **once** into a master buffer. That master is copied into
three layer buffers, each masked by a smooth weight field, lifted toward the
background colour with a `source-atop` white fill, and composited far → mid →
sharp with a single `ctx.filter = 'blur(Npx)'` each. Per-element blurring would
be unusably slow at 4K, and hard bucketing would show seams — the weight fields
feather between the three fixed radii instead.

The plane of focus is a diagonal band through the chart's lower-middle. The
upper-left recedes into near-pure white haze; the far-right column is a different
panel of the UI and softens on its own.

## Finish

No bloom pass — additive glow on a white screen would be wrong. Instead a blurred
copy composited with `lighten`, so bright areas creep into their neighbours and
highlights clip gently, the way an overexposed macro shot of a white panel
behaves. Then a warm, very slight vignette, and fine grain seeded on
`frame % 1620`.

## Layout

```
src/CryptoTerminal/
  index.tsx      component; owns the buffers and the per-frame draw
  constants.ts   palette, layout, camera, the geometry/axis split
  series.ts      the seeded, exactly-periodic price series
  scene.ts       everything that draws, in design space
  dof.ts         the three-buffer depth-of-field stack
  finish.ts      haze, breathe, bloom-out, vignette, grain
  fonts.ts       self-hosted tabular figures
```

`scene.ts` draws in a *design space* much larger than the frame — the shot is a
macro crop of a bigger UI, so content is authored well outside the 3840×2160 box
and the camera transform decides what lands in shot.
