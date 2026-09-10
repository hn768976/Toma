# Infinite Zodiac Tunnel

Nested zodiac wheels receding inward in an endless zoom — chalk-white line
work on black, rotating as they recede. 3840×2160, 30 fps, 450 frames
(15 s), **seamless loop**.

Two versions:

| Composition id       | Look                          | Deliverable                |
| -------------------- | ----------------------------- | -------------------------- |
| `ZodiacTunnelChalk`  | chalk white `#e8e4dc` on black | `V1_ZodiacTunnelChalk.mp4` |
| `ZodiacTunnelGold`   | gold `#e0b850` on deep navy    | `V2_ZodiacTunnelGold.mp4`  |

---

## The loop: a doubling-scale Droste construction

This is worth understanding before changing anything, because it is the
whole clip and it is exact rather than approximate — no cross-fade, no
blended seam.

The wheel is drawn **once**. It is then stamped at a run of scales, each
exactly **half** the last (`1, ½, ¼, ⅛, …`), all sharing one centre. Over
the 450 frames a single zoom factor travels from **1× to 2×**. By the last
frame every stamp has grown into precisely the slot its larger neighbour
occupied on frame 0 — so frame 450 *is* frame 0.

Rotation rides along on the same trick. Each stamp is pre-rotated by
`360° / 12 = 30°` relative to the one outside it, and the whole set
rotates a further 30° across the loop. At the end each sector has landed
exactly where its neighbour began. (Pre-rotating the copies is what makes
this work: the wheel is *not* 12-fold symmetric — every sector carries a
different sign — so the copies have to be offset by a sector for the
rotation to close.)

Both relationships have to be integers. Get them exactly right and the
loop is invisible; get them approximately right and it visibly jumps.

### Everything is a function of *depth*, never of array index

The code never asks "which copy is this?" — it asks "how deep is it?":

```ts
const depth = index - t;          // t = frame / 450, so 0..1 across the loop
```

Size, rotation, opacity, blur and which mip level gets sampled are all
pure functions of that one number (`constants.ts`). That is the load-bearing
detail. At `t = 1` copy *k* sits at the depth copy *k−1* held at `t = 0`;
because every visual property is keyed to depth, it also *looks* exactly
like copy *k−1* did. Key any of them to the index instead and the seam
comes back.

The two ends of the run then have to vanish, and `opacityForDepth()`
guarantees it: it returns 0 at depth −1 (a copy that has grown past the
frame, which has no counterpart on frame 0) and 0 again at depth
`COPY_COUNT − 1` (a copy still too small to resolve). Between them, six to
seven wheels are visible at once, each dimmer than the one outside it.

Nothing reads wall-clock time or component state — Remotion renders frames
out of order across worker threads, so anything that isn't a pure function
of `useCurrentFrame()` would flicker.

### Verifying the loop

`ZodiacTunnelLoopTest` is the same composition one frame longer, so frame
450 can actually be rendered:

```console
npx remotion still ZodiacTunnelLoopTest out/loop_000.png --frame=0   --scale=0.5
npx remotion still ZodiacTunnelLoopTest out/loop_450.png --frame=450 --scale=0.5
md5sum out/loop_000.png out/loop_450.png     # must match
```

The two PNGs are byte-identical.

---

## Rendering

Install once:

```console
npm i
```

**1080p previews** (what ships as the deliverables — h264, `yuv420p`,
30 fps, no audio track):

```console
npx remotion render ZodiacTunnelChalk out/V1_ZodiacTunnelChalk.mp4 \
  --scale=0.5 --codec=h264 --image-format=png --crf=17 --pixel-format=yuv420p --muted
npx remotion render ZodiacTunnelGold  out/V2_ZodiacTunnelGold.mp4 \
  --scale=0.5 --codec=h264 --image-format=png --crf=17 --pixel-format=yuv420p --muted
```

(The standalone project wraps both in `npm run render:previews`.)

**Full 4K master:**

```console
npx remotion render ZodiacTunnelChalk out/V1_ZodiacTunnelChalk.mp4 --scale=1 --crf=16
npx remotion render ZodiacTunnelGold  out/V2_ZodiacTunnelGold.mp4  --scale=1 --crf=16
```

Add `--muted` to either to keep a silent AAC track out of the container;
Remotion writes one by default. Verify with
`npx remotion ffprobe out/V1_ZodiacTunnelChalk.mp4` — there should be a
single video stream and a duration of exactly `15.000000`.

`--image-format=png` is worth the extra render time here: the default JPEG
intermediates soften the chalk grain and the finest tick marks.

Interactive preview:

```console
npm run dev
```

---

## How it is built

```
src/zodiac-tunnel/
  constants.ts     timing, wheel proportions, palettes, and the depth maths
  glyphs.ts        the twelve zodiac glyphs as hand-authored SVG path data
  chalk.ts         seeded PRNG, jittered stroking, the tileable grain mask
  wheel.ts         draws the wheel once offscreen, then builds a mip chain
  starfield.ts     static seeded stars, twinkling on periods that divide 450
  ZodiacTunnel.tsx composes the frame
```

**The wheel** (`wheel.ts`) is an outer ring of the twelve sign names set on
a curve, a glyph ring inside it, a band of 5° degree ticks, three thin
concentric rings, twelve radial dividers, and a `{12/5}` star polygon
across the interior. All line work, no fills. Its innermost ring sits just
outside `0.5 r` so that the next copy's outer circle — which lands exactly
on `0.5 r` — completes the cluster and the tunnel reads as continuous.

**Chalk texture** is what keeps this from looking like a technical diagram.
Circles and lines are jittered into polylines before stroking, each stroke
is laid down twice at a sub-pixel offset with a wandering width, and the
finished drawing has its alpha channel multiplied by a tileable noise
field so the pigment breaks up along its length. The master is then
composited over a blurred copy of itself for the dust halo around each
stroke. (The noise tile is blurred with a hand-rolled wrap-around box blur
rather than `ctx.filter` — the latter clamps at the canvas edge and leaves
a visible grid once the tile repeats.)

**Colour** comes from alpha, not from tinting: every copy is the version's
one line colour composited over the background at a lower alpha, which is
physically what thinning chalk dust does. `#e8e4dc` at the outermost falls
to roughly `#3a3834` three wheels in and to black past that.

**Anti-aliasing** is the real risk in a piece like this — the deepest
copies are a few dozen pixels across, so their line work is far below one
pixel wide and would crawl. The fix is the mip chain: the wheel bitmap is
halved repeatedly, and each stamp samples the smallest level that is still
at least its own size, so `drawImage` never downsamples by more than 2×.
Pre-averaged lines turn into an even haze instead of shimmering — which is
also what sells the infinite recession. On top of that, opacity fades the
sub-pixel copies out entirely and blur ramps up toward the centre.

The wheel bitmap and its mips are built once per browser tab and cached;
Remotion reuses a tab across many frames, so the cost is paid once per
worker rather than 450 times.
