# Ticker Board — 4K

A macro shot of a market data screen: five columns of numbers scrolling
upward behind shallow depth of field, shot slightly off-axis. 3840×2160,
60fps, 1160 frames (19.33s), seamless loop.

Built with [Remotion](https://remotion.dev) 4. Everything is drawn to a single
`<canvas>` from `useCurrentFrame()`.

## Running it

```bash
npm install

npm start          # Remotion Studio
npm run render     # 4K ProRes 422 HQ  -> out/ticker-board.mov
npm run render:mp4 # 4K H.264          -> out/ticker-board.mp4
```

Both pass `--muted`. The piece has no audio, and without it Remotion writes a
silent PCM track into the container.

If Remotion cannot download its own Chromium (no egress to `remotion.media`),
point it at a local one — it needs the *headless shell* build, since current
full Chrome no longer supports the old headless mode Remotion launches with:

```bash
export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell
```

## How it is put together

| File | What lives there |
| --- | --- |
| `src/board/constants.ts` | Every tunable number, and why it has that value |
| `src/board/geometry.ts` | The camera matrix, column layout, focus model |
| `src/board/data.ts` | Seeded value lists and the reroll schedule |
| `src/board/draw.ts` | The per-frame renderer |
| `src/board/buffers.ts` | Offscreen surface allocation |
| `src/board/grain.ts` | Grain tiles and the LCD pixel-grid tile |

### Determinism

Every frame is a pure function of the frame number. There is no
`requestAnimationFrame`, no `Date.now()`, no CSS animation and no animation
state; the canvas is cleared and redrawn on each React render. All values come
from Remotion's `random()` with fixed string seeds, never `Math.random()`.

Verified: rendering frame 777 twice produces byte-identical PNGs.

### The loop

Frame 0 and frame 1160 are byte-identical. Every periodic quantity divides
evenly into 1160:

- **Scroll.** Each column owns a cyclic list of N rows and advances exactly one
  full list per loop, so its period is `1160 / N` frames per row. With N of
  16, 18, 15, 17 and 16 that is 72.5, 64.4, 77.3, 68.2 and 72.5 frames per row
  — a mean of ~70 as specified, spread ±9.5%, so the columns drift out of
  alignment through the loop and re-converge exactly at the seam.
- **Rerolls** are scheduled off `frame % 1160`, with the minimum gap between
  two changes to the same cell enforced *cyclically* — including across the
  seam — so no cell can reroll while it is still mid-flash.
- **Breathe** is two sine cycles per loop; the **refresh band** makes two
  crossings; the **grain** seed is `frame % 1160`.

### Depth of field

Three offscreen planes — sharp, mid, far — each blurred exactly once and
composited far to near. Per-cell blurring at 4K is not viable.

Cells are not bucketed into one plane. Each is split by linear weight across
the two planes that bracket its focus distance, which interpolates between blur
radii instead of snapping to one of three and is what keeps the buckets from
banding. Compositing is additive, which is both physically right for emissive
text on near-black and what makes a split cell sum back to full strength.

The mid and far planes render at 0.5× and 0.34× frame resolution. They are
blurred well past the point where their own pixel grid could show, so their
size costs nothing visually and saves most of the frame time.

### Reading the reference

The brief specified ~52px glyphs. The reference plate is a macro shot whose cap
height measures ~100px at 4K, so `COL_FONT` keeps the brief's exact size
*ratios* between columns and scales them to match the shot. Three other details
were taken from the plate rather than the brief: column 2 is strictly
descending, column 4 is red and teal with almost no white, and column 5 shadows
column 4's values with a fraction of a percent of drift — a last/close pair,
walking a row at a time as the two columns scroll at different speeds.

Live updates *tick* off the current value rather than redrawing it. A uniform
redraw scrambles both the column 2 ranking and the 4/5 pairing within a couple
of seconds, and the board stops reading as a board.

## Performance

~0.8s per 4K frame at concurrency 4; the full 1160-frame render takes about 15
minutes on four cores. Three plane blurs and one bloom blur per frame, all at
reduced resolution; the value lists and grain tiles are built once behind
`useMemo`.
