# LED Dot Matrix Wall

A fixed grid of square LED dots over a slow-drifting glow, in three colour
versions. 3840x2160, 30fps, 600 frames (20s), seamless loop, no audio.

| Composition id      | Version          | Output file             |
| ------------------- | ---------------- | ----------------------- |
| `V1-DotMatrixBlue`  | Blue (reference) | `V1_DotMatrixBlue.mp4`  |
| `V2-DotMatrixAmber` | Amber / gold     | `V2_DotMatrixAmber.mp4` |
| `V3-DotMatrixMono`  | Monochrome white | `V3_DotMatrixMono.mp4`  |

## Rendering

The compositions are defined at **4K**. The 1080p deliverables are the same
composition rendered at half scale:

```bash
# 1080p preview (what ships as the deliverable)
npx remotion render V1-DotMatrixBlue out/V1_DotMatrixBlue.mp4 \
  --scale=0.5 --image-format=png --crf=16 --muted

# full 4K
npx remotion render V1-DotMatrixBlue out/V1_DotMatrixBlue.mp4 \
  --scale=1 --crf=15 --image-format=png --muted

# a still
npx remotion still V1-DotMatrixBlue out/V1_DotMatrixBlue.png \
  --frame=150 --scale=0.5
```

`--muted` matters too: without it Remotion muxes a silent AAC track, and these
are meant to ship with no audio track at all. Verify with
`npx remotion ffprobe out/V1_DotMatrixBlue.mp4` — there should be no audio
stream, and the duration should be exactly 20.000s.

`--image-format=png` matters. The project's `remotion.config.ts` sets JPEG
intermediate frames, which is right for the other compositions here but wrong
for this one: JPEG chroma subsampling rings around every hard dot edge and
softens the grid, which is the whole subject. Always pass it for these three.

## The whole-pixel pitch requirement

**The grid must never move, and its pitch must land on whole pixels at every
resolution it is rendered at.** If the pitch lands on a fraction, cells round
unevenly against the pixel raster and the static grid shimmers — very obvious,
and fatal to the panel read.

Since the deliverables are produced at both 4K and 1080p, the 1080p pitch must
divide **both 1920 and 1080** exactly. That admits only 10, 12, 15, 20, 24, 30
and 40 px.

The reference sits at roughly 120 columns, which is **not reachable**:
1920 / 120 = 16, and 1080 / 16 = 67.5. The closest grid that satisfies the
constraint is a pitch of 15px:

|            | 1080p                | 4K      |
| ---------- | -------------------- | ------- |
| grid       | 128 x 72 (9216 dots) | same    |
| cell pitch | 15 px                | 30 px   |
| dot sizes  | 4–9 px               | 8–18 px |

Every dot size is even and every cell inset is even **at 4K**, so each dot's
edges sit on even 4K pixels and the 2:1 downscale to 1080p is exact — the
square edges stay perfectly hard rather than resampling to a soft ramp.
`assertWholePixelGrid()` in `constants.ts` checks all of this at render time
and throws rather than silently shipping a shimmering grid.

If you change `COLS`, `ROWS` or `SIZE_LADDER`, that assertion is the contract
to satisfy.

## How it is built

`DotMatrixWall.tsx` draws four stacked canvases per frame:

1. **haze** — the broad glow mass, painted from the same `exp()` falloff the
   dots sample, so haze and dots read as one light source.
2. **bloom** — hot dots only, at 1/4 resolution and CSS-blurred. Bloom on
   anything else merges neighbouring dots and destroys the panel read.
3. **dots** — the grid, screen-blended so dots always _add_ light instead of
   punching dark squares into the bright part of the haze.
4. **grain** — ~2% additive dither from pre-built tiles, without which the
   smooth glow gradient bands in H.264.

Dot brightness is four layers: a base level, the broad glow, cluster patches
driven by a looping 3D value-noise field, and sparse flickering hot dots.
Dots are drawn batched one `fillStyle` per brightness bucket (48 buckets) via
a counting sort — at ~9200 dots the `fillRect`s are cheap but per-dot style
changes are not.

Everything is a pure function of `useCurrentFrame()`, drawn in
`useLayoutEffect`. No `Math.random()` at render time and no state between
frames: Remotion renders frames out of order across worker threads.

## The loop

Every periodic term has a period that divides 600 frames, and the noise
field's time axis is a wrapping lattice, so frame 600 is bit-identical to
frame 0. The glow drift and cluster migration use `sin(t)` paired with
`(1-cos(t))/2`, which traces a closed path back to its start.
