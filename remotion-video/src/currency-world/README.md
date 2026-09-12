# Currency World — 3D global exchange field

A 3D motion graphic in the style of a "global currencies exchange on an
abstract digital world map" stock plate: dot-matrix world maps stacked
in depth, currency tokens and live quotes floating in front of them, and
a camera that tracks sideways while pushing into the field.

Two camera directions ship, each with its own colour grade, at two
resolutions.

| Composition               | Size      | Camera        | Grade      |
| ------------------------- | --------- | ------------- | ---------- |
| `CurrencyWorld-LTR-1080p` | 1920x1080 | left → right  | `steel`    |
| `CurrencyWorld-RTL-1080p` | 1920x1080 | right → left  | `midnight` |
| `CurrencyWorld-LTR-4K`    | 3840x2160 | left → right  | `steel`    |
| `CurrencyWorld-RTL-4K`    | 3840x2160 | right → left  | `midnight` |

All four are 30 fps, 361 frames (12.03 s).

`steel` is the navy/cyan grade matched to the reference plate;
`midnight` is the dark-blue grade. Both are just `defaultProps` — any
composition can be rendered in either grade or either direction from the
Studio sidebar, or on the CLI:

```console
npx remotion render CurrencyWorld-LTR-4K out/ltr-4k.mp4 \
  --codec=h264 --crf=16 --props='{"direction":"ltr","palette":"midnight"}'
```

## Rendering

```console
npm i
npx remotion render CurrencyWorld-LTR-1080p out/ltr-1080p.mp4 --codec=h264 --crf=16
npx remotion render CurrencyWorld-RTL-1080p out/rtl-1080p.mp4 --codec=h264 --crf=16
npx remotion render CurrencyWorld-LTR-4K    out/ltr-4k.mp4    --codec=h264 --crf=16
npx remotion render CurrencyWorld-RTL-4K    out/rtl-4k.mp4    --codec=h264 --crf=16
```

4K takes roughly four times as long as 1080p per frame. Lower
`--concurrency` if a machine runs short of memory.

## How the 3D works

Real perspective, not a fake 2D parallax. The stage sets a CSS
`perspective` and every element is positioned with a `translate3d` into
a depth slab; the browser does the projection, so an element's apparent
size, its lateral travel under a camera pan, and the convergence of the
depth-aligned streaks all fall out of one consistent camera.

- **`camera.ts`** — the only moving part. A lateral track plus a forward
  dolly, with a slow bob and a slight yaw lead. `worldTransform()`
  negates it onto the world container, which is how a camera move is
  expressed in CSS.
- **`depth.ts`** — everything depth-derived: where an element sits this
  frame, its atmospheric fade, and its defocus. Defocus is budgeted in
  *screen* px and then divided by the perspective scale, because CSS
  applies `filter` before the 3D transform.
- **Depth recycling** — tokens, quotes, streaks and HUD parts wrap
  through the slab, so pushing in forever never thins the field out. Both
  ends of the wrap sit inside a fade, so the recycle is invisible.
- **Scaling** — the shot is authored at 1920x1080 and the whole design
  space is scaled by `width / 1920`. The 4K compositions are therefore
  the same framing rasterised larger, never a re-composed shot.
- **Determinism** — every element's identity comes from `random.ts`
  seeded by its index. Remotion renders frames out of order across
  workers; anything seeded by wall-clock or `Math.random()` would
  flicker.

## The map

`world-dots.ts` is generated, not hand-drawn: a 176x68 equirectangular
grid (latitudes -58..82, so Antarctica and the high Arctic are clipped
the way stock plates clip them) tested against Natural Earth land
polygons. Regenerate only if the grid resolution changes:

```console
npm i --no-save d3-geo topojson-client world-atlas
node scripts/generate-world-dots.mjs
```

Three plates carry that grid at different depths, sizes and offsets.
They sit well behind the token field so the tokens read as floating in
front of the map, and each is masked at its edges so the plate's own
rectangle never shows.

## Fonts

`public/fonts/CurrencySans-*.woff2` and `CurrencyMono-Regular.woff2` are
DejaVu subsets (Latin plus $ € £ ¥ ₽ ₹ ¢), self-hosted so a render never
depends on a network fetch and looks identical on any machine.
