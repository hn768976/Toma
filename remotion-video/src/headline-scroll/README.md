# HeadlineScroll — 4K AI headline scroll

Blurred newsprint drifting past a sharp centre word. 3840×2160, 30fps,
210 frames (7.0s), seamless loop.

One component, two registered compositions:

```
<Composition id="HeadlineScroll"      … defaultProps={{ variant: "dark",  word: "AI" }} />
<Composition id="HeadlineScrollLight" … defaultProps={{ variant: "light", word: "AI" }} />
```

| | `dark` | `light` |
| --- | --- | --- |
| Ground | pure black | warm off-white `#F4F2ED` — paper, not screen |
| Type | light on dark, `screen` | dark on paper, `multiply` |
| Behind the word | black scrim knocks the text back, white halo lifts the word out | near-white wash bleaches the text, word sits on cleared paper |
| Word finish | bloom | highlight roll-off toward paper white |
| Vignette | edges fall to black | edges lift ~15% toward white |
| Aberration | additive; the pair sums to the text colour | subtractive; the pair multiplies to it — misregistered print |
| Blur ceiling | 30px | 24px — dark type on light smears more |

Everything else is shared: same copy, line count, scroll speeds, drift, glitch
schedule, grain, loop closure.

## Files

| File | What lives there |
| --- | --- |
| `theme.ts` | `THEMES` — **every** colour in the piece, plus the blend modes and the handful of numbers that genuinely differ per variant. No hex literal appears anywhere else, and no renderer code branches on the variant name. |
| `constants.ts` | Scroll speed, blur range, line count, glow strength, chromatic offsets, glitch timings, vignette, grain. |
| `copy.ts` | The fictional newsprint pools. |
| `fonts.ts` | Inter (heavy sans) + Source Serif 4 for the montage, Poppins Black for the centre word, gated with `delayRender()`/`continueRender()`. |
| `lines.ts` | Builds each line's spec and its one pre-blurred, tileable buffer. |
| `effects.ts` | Glitch schedule, centre-word sprites, vignette, grain tiles — all baked once. |
| `HeadlineScroll.tsx` | The per-frame draw. |

## How the loop is exact

Frame 0 and frame 210 are byte-identical PNGs at full 4K. Three things make that
true, and breaking any one of them breaks the loop:

- **Horizontal scroll.** Each line's copy is packed into a tile of integer width
  and the line crosses a whole number of tiles per loop. The per-frame shift is
  written as `cycles * tileWidth * frame / DURATION` rather than `speed * frame`,
  so at frame 210 it lands on an exact multiple of the tile with no
  floating-point drift.
- **Every sine.** Vertical drift periods are drawn from `{210, 105, 70, 42}` and
  the glow pulse is 70 — all divide 210.
- **Everything frame-indexed.** Glitches, grain tile choice and grain offset all
  key off `frame % 210`. The glitch schedule leaves a clean guard band at the
  tail so the wrap point never lands mid-tear.

Check it — the script renders both compositions at full 4K:

```console
npm run verify-loop
```

## Performance

Twelve blurred 4K text lines re-laid-out per frame is the expensive mistake
here. Instead each line is drawn once into an offscreen canvas, blurred once,
and cropped to exactly one tile period; per frame the renderer only blits that
buffer a handful of times with an x offset. The vignette, the grain tiles and
the three centre-word sprites are likewise baked once in a `useMemo`.

The tile crop is why the blur has no seam: the text is drawn past both edges of
a padded canvas, the *whole* canvas is blurred in one pass, and the periodic
interior is cropped out — so tiling the result reproduces an infinite blurred
strip exactly.

## Fonts

The montage uses Inter and Source Serif 4. The centre word uses Poppins Black —
a different face on purpose, so the one sharp thing in the frame separates from
the blurred text by shape as well as by focus.

Family names, weight axes and file URLs all come from `@remotion/google-fonts`,
but the woff2 files are served from `public/fonts/` rather than fetched from
`fonts.gstatic.com` during a render — a render that needs the network is a
render that can fail halfway through a frame range. Re-download them with:

```console
npm run fonts
```

Tile widths come from `ctx.measureText()`, so the composition holds a
`delayRender()` handle until both faces are genuinely drawable; measuring
against a fallback face would silently change every line's scroll speed.

## Copy

All headlines and body copy in `copy.ts` are invented — fictional bodies,
generic claims, no real publication, organisation or person. Nothing in the
frame is a logo, a masthead or a watermark, and the piece has no audio.

## Rendering

```console
# 1080p previews
npx remotion render HeadlineScroll out/headline-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8 --muted
npx remotion render HeadlineScrollLight out/headline-light-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8 --muted

# full 4K
npx remotion render HeadlineScroll out/headline-scroll.mp4 \
  --codec=h264 --crf=12 --concurrency=8 --muted
npx remotion render HeadlineScrollLight out/headline-light.mp4 \
  --codec=h264 --crf=14 --concurrency=8 --muted
```

`--muted` keeps Remotion from attaching a silent AAC track. Lower
`--concurrency` to the machine's core count if the CLI rejects it.

## Why light mode is a data change

Inverting the ground is not a matter of swapping black for white; the
*operations* invert too. Rather than branch on the variant name, each of those
operations is described by a theme value, so the renderer runs one path:

- **The halo is two radial passes**, `wash` then `core`, each with its own
  colour, alpha, radius, falloff and blend. Dark reads that as a black scrim
  under a white halo. Light reads the same two passes as a near-white wash that
  bleaches the text beneath, so the word lands on cleared paper. A dark halo on
  light would read as a drop shadow and float the word above the page, which is
  why this is a pass description and not an inverted colour.
- **Chromatic aberration is two offset impressions** plus a rule for how they
  combine. Additive on dark, where the pair is solved to sum back to the text
  colour; subtractive on light, where the first impression is paper tinted
  toward red and the second is whatever it must be multiplied by to land on the
  ink. Either way the overlap resolves exactly, which is what keeps it reading
  as aberration rather than a coloured shadow.
- **The word finish is a mode, not a strength.** Additive bloom on a light
  ground is always wrong, so light replaces it with a colour-dodge highlight
  roll-off: dividing by `1 - 0.022` clips anything already near paper white to
  it and leaves the dark type alone. The amount sits just inside the headroom
  the warm background has left, so the paper lifts without losing its cream
  cast.
- **Vignette, grain and line stacking** each carry their own colour and blend,
  so they darken on one variant and lighten on the other with no code in
  common changing.

A third variant is one more entry in `THEMES`.
