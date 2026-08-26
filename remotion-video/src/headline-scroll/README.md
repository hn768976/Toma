# HeadlineScroll — 4K AI headline scroll

Blurred newsprint drifting past a sharp, glowing centre word. 3840×2160, 30fps,
210 frames (7.0s), seamless loop.

```
<Composition id="HeadlineScroll" durationInFrames={210} fps={30}
             width={3840} height={2160}
             defaultProps={{ variant: "dark", word: "AI" }} />
```

## Files

| File | What lives there |
| --- | --- |
| `theme.ts` | `THEMES` — **every** colour in the piece, plus blend modes. No hex literal appears anywhere else. |
| `constants.ts` | Scroll speed, blur range, line count, glow strength, chromatic offsets, glitch timings, vignette, grain. |
| `copy.ts` | The fictional newsprint pools. |
| `fonts.ts` | Inter (heavy sans) + Source Serif 4, gated with `delayRender()`/`continueRender()`. |
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

Check it:

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
# 1080p preview
npx remotion render HeadlineScroll out/headline-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8 --muted

# full 4K
npx remotion render HeadlineScroll out/headline-scroll.mp4 \
  --codec=h264 --crf=12 --concurrency=8 --muted
```

`--muted` keeps Remotion from attaching a silent AAC track. Lower
`--concurrency` to the machine's core count if the CLI rejects it.

## Variants

`variant` selects a palette out of `THEMES`, which currently holds `dark`.
Adding a light mode is a data change: one more entry in `THEMES` (its blend
modes included — a light variant multiplies grain and vignette down where the
dark one screens them up). No renderer code needs to move.
