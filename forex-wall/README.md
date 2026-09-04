# Forex Ticker Wall

A wall of currency-pair quotes seen at a steep angle, rows receding toward a
vanishing point off the left of the frame. Two versions, same geometry and
same data:

| Composition id       | Look                                            |
| -------------------- | ----------------------------------------------- |
| `V1-ForexWallDark`   | Dark trading terminal — glow, grain, vignette    |
| `V2-ForexWallLight`  | Light broadcast board — white ground, no effects |

Both are defined at **3840 × 2160, 30 fps, 480 frames (16 s)** and loop
seamlessly: frame 480 is byte-identical to frame 0.

## Render

```bash
npm install
npx remotion studio          # interactive preview
```

4K masters — one command per composition:

```bash
npx remotion render V1-ForexWallDark  out/V1_ForexWallDark.mp4  --scale=1 --crf=16 --muted
npx remotion render V2-ForexWallLight out/V2_ForexWallLight.mp4 --scale=1 --crf=16 --muted
```

Also available as `npm run render:v1` / `npm run render:v2`, and
`npm run still:v1` / `npm run still:v2` for 4K PNG stills.

1080p preview (what ships alongside this project):

```bash
npx remotion render V1-ForexWallDark out/V1_ForexWallDark.mp4 \
  --scale=0.5 --crf=18 --codec=h264 --pixel-format=yuv420p --muted
```

`--scale` changes only the raster density, never the layout, so the preview
and the master are the same picture at two resolutions. `--muted` matters:
without it Remotion attaches a silent audio track that runs slightly longer
than the video, and a player looping the file stalls on the overhang.

## How it is built

**The board is real DOM text.** One `perspective` container per depth slice,
each holding a `preserve-3d` plane rotated `rotateX(6deg) rotateY(-38deg)`.
Nothing is rasterised to a texture, so the numerals stay type at any output
size. `src/projection.ts` reproduces the browser's projection maths in JS so
each block's on-screen scale is known up front — that is what drives culling,
the brightness falloff and the depth slices.

**Depth of field is per-slice, in screen space.** `DOF_SLICES` in
`src/constants.ts` defines six depth bands; each is a full-frame layer with
its own `filter: blur()`, and only the blocks at that depth are drawn into
it. Blurring the *layer* rather than the *block* matters: a filter on a
3D-transformed element makes the browser rasterise that element and then
magnify the raster, which visibly softens the type. A lens blurs the image
rather than the object, so the screen-space radius is also the physically
correct model. The mid-distance band is sharp; near and far soften.

**Every figure is a pure function of `useCurrentFrame()`.** Remotion renders
frames out of order across threads, so `src/quote.ts` holds no state: a
quote's value is `base * (1 + drift(pairIndex, frame))`, its absolute change
is `base * drift` and its percentage is `drift * 100` — three printed figures
from one underlying number, so they cannot disagree. The drift is a sum of
sinusoids at integer harmonics of the loop, sampled at a per-pair tick
quantum that divides 480, so it returns exactly to its starting value.

**The scroll is a 2D lattice shift**: three block pitches and one row pitch
per loop. Seamlessness therefore requires
`pairIndexFor(row, col) === pairIndexFor(row - 1, col - 3)`, which
`pairIndexFor` satisfies by construction. The one-row vertical component is
what buys the slow, reference-matched horizontal pace — with a purely
horizontal scroll the quote sequence would have to repeat every three
blocks, three times over in every row.

**Resolution independence.** Every length in the source is in *reference
pixels* — the pixels of the 3840 × 2160 master. Components multiply by
`u = width / 3840`, so font sizes, translations, the perspective distance and
the blur radii all track the composition size. Verified by rendering the
board at a native 1920 × 1080 composition and diffing it against the 4K
render downsampled to 1080p: mean absolute difference 1.7 / 255, i.e. nothing
but resampling noise.

**Type.** Roboto, subset to Latin and self-hosted in `public/fonts`, loaded
through a `delayRender()` so no frame is captured before the face is
available — a substituted font would break the numeric columns. Digits are
laid out in fixed-width columns *and* rendered with `tabular-nums`; the
embedded file carries the `tnum` feature and its digit advances are already
uniform, so ticking digits cannot shift the layout.

## Content

Every rate, change and percentage in `src/pairs.ts` is invented. Nothing is
dated, and no broker, exchange, venue or logo appears anywhere. ISO 4217
currency codes are not trademarks; `YEN` is used in place of `JPY` to match
the informal styling of a public quote board.

## Layout

```
src/
  constants.ts    composition size, plane geometry, lattice, depth slices
  projection.ts   the CSS perspective projection, in JS
  pairs.ts        the quote universe and its decimal-place rules
  quote.ts        frame -> value / change / percentage / flash
  theme.ts        the two palettes
  load-fonts.ts   self-hosted Roboto
  QuoteBlock.tsx  one quote — pair, rate, triangle, change, percentage
  ForexWall.tsx   the plane, the depth slices, the overlays
  overlays.tsx    grain, screen glow, vignette, horizon haze
  Root.tsx        the two compositions
```

## Notes

The board is mirrored relative to the written brief: the near edge is on the
**right** and the vanishing point sits off the **left** of frame, matching
the reference clip rather than the brief's prose. To mirror it, flip the sign
of `ROT_Y_DEG` and set `ORIGIN_X` to `1 - 0.62` in `src/constants.ts`.
