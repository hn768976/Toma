# LedTicker — 4K LED stock ticker board

A macro shot of a physical dot-matrix ticker panel: six bands of financial data
scrolling at an angle across a tilted LED grid. 3840×2160, 60fps, 1200 frames
(20.0s), seamless loop.

```
npx remotion render LedTicker out/led-ticker.mp4 \
  --codec=h264 --crf=12 --concurrency=8 --image-format=png
```

The low CRF is not optional: the dot grid is high-frequency detail that smears
badly at default settings. `--image-format=png` matters for the same reason —
the project's default JPEG intermediates soften the lattice before x264 ever
sees it. Drop `--concurrency` to your core count if the renderer complains.

## How the look is built

**The lattice is the whole thing.** Glyphs are not text with a dot pattern laid
over them — each band's content sequence is drawn once into an offscreen strip
at full board resolution, then one pixel is read at every LED centre
(`strip.ts`). An emitter lights where that sample's coverage clears a
threshold. That is what makes curves break into visible stair-steps and what a
screen-door overlay can never produce. The strip is drawn on a transparent
canvas so the alpha channel *is* glyph coverage, which thresholds all three
emitter colours identically; a luminance read would thin the reds, whose peak
luminance is a third of white's.

**Two coordinate systems.** Everything — lattice, bands, glyphs, dead emitters —
is laid out in *board space*, the flat plane the panel occupies. A single
affine (`transform.ts`: rotate −9°, horizontal shear, squeeze, scale) tilts that
plane into the 3840×2160 frame. Because the lattice is defined in board space it
tilts *with* the panel. The board extent is derived by pulling the four screen
corners back through the inverse, so the panel is exactly as large as the frame
needs and no larger.

**Depth of field is three buffers, not per-element blur.** Bands are bucketed
sharp / mid / far, each bucket drawn into its own full-frame canvas and blurred
exactly once, then composited far → mid → sharp. A fourth pass blurs the
assembled frame and masks it back in with a gradient that dissolves toward the
lower-right and the edges, so focus falls off smoothly *within* a band as well
as between bands. Per-element blurring at 4K is not viable.

**Performance.** A 4K board holds ~78,000 lattice cells. The unlit grid is a
`createPattern` fill (one `fillRect` per band); lit emitters are pre-baked
core+halo sprites stamped with `lighter` (`sprites.ts`). Each band's sampled
lattice is computed once and cached for the whole loop — scrolling is just an
offset into it.

## What closes the loop

`durationInFrames` is 1200 and every periodic quantity divides into it:

- **Scroll.** Each band's content sequence is exactly `cols × PITCH` board px
  wide, and the band travels exactly one sequence over 1200 frames. Speed falls
  out of `cols` (110–172 px/s across the six bands). The gap between entries is
  *solved for* rather than fixed, so the sequence lands on the lattice multiple
  the loop needs without stretching the entries themselves.
- **Breathe.** ±3% brightness on a sine of period 400 frames.
- **Grain.** Reseeded from `frame % 1200`.

Verified: frames 0 and 1200 render to byte-identical PNGs, and the 1199→0 pixel
delta matches an ordinary frame-to-frame delta, so the seam is continuous and
not just closed.

## Determinism

Every value comes from Remotion's `random()` with a stable string seed, and the
canvas is repainted once per React render straight from `useCurrentFrame()` — no
`requestAnimationFrame`, no `Date.now()`, no component state driving motion. All
render workers agree frame for frame.

## Known trade-off: content tiling

A 20s seamless loop at 90–170 px/s means a band travels less than one screen
width, so a band's content sequence is necessarily *narrower* than the frame and
tiles within it. The two fastest bands (longest sequences) never show a repeat
on screen; the slower ones show one near the frame edges. The slowest bands are
therefore assigned to the far focus bucket, where the repeat dissolves into the
blur. Widening the sequences any further would mean scrolling faster than the
brief allows.
