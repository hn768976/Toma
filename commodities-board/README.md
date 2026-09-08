# Commodities Ticker Board

A scrolling commodities board raked away from the camera, over a faint world map
with network lines. Two versions, both defined at **3840x2160, 30 fps, 480
frames (16 s)** and built to loop seamlessly.

| Composition id | Look |
| --- | --- |
| `V1-CommoditiesBoardDark` | Dark terminal |
| `V2-CommoditiesBoardLight` | Light broadcast |

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering

4K, one command per composition:

```bash
npx remotion render V1-CommoditiesBoardDark out/V1_CommoditiesBoardDark.mp4 --scale=1 --crf=16
npx remotion render V2-CommoditiesBoardLight out/V2_CommoditiesBoardLight.mp4 --scale=1 --crf=16
```

1080p preview (what ships alongside this project):

```bash
npx remotion render V1-CommoditiesBoardDark out/V1_CommoditiesBoardDark.mp4 \
  --scale=0.5 --codec=h264 --crf=18 --pixel-format=yuv420p
```

Stills:

```bash
npx remotion still V1-CommoditiesBoardDark out/V1_CommoditiesBoardDark.png --frame=67 --scale=0.5
npx remotion still V2-CommoditiesBoardLight out/V2_CommoditiesBoardLight.png --frame=67 --scale=0.5
```

## How it holds together

**The loop is exact, not eased into place.** One cycle is 20 instrument rows at
156 px plus 4 section bars at 180 px = 3840 px, and the list scrolls 8 px per
frame for 480 frames — exactly one cycle. Frame 480 renders pixel-for-pixel
identical to frame 0 (verified, zero differing pixels). Every tick period
divides 480 and every map pulse runs a whole number of cycles per loop, so the
numbers and the background wrap with the scroll.

**Nothing accumulates.** The scroll offset and every quoted value are pure
functions of `useCurrentFrame()` — a CSS `translateY`, never a real scroll
container — so Remotion can render frames out of order across threads.

**One value per row.** Price, percentage and direction marker are all read off a
single underlying percentage change (`src/data/quote.ts`), so a price can never
move while its percentage sits still.

**Depth of field is sliced in plane space, not screen space.** `rotateZ` tilts
the rows on screen but does not change their depth, so a constant-depth slice is
a tilted stripe; cutting horizontal screen bands would put the focus edge across
the rows at the wrong angle. Each slice carries only the rows that fall inside
it, blurred and cross-faded into its neighbours (`src/board/DepthOfField.ts`).
Slice radii are fractions of the frame width and are divided by the local
perspective scale, so the rendered softness is the same at 1080p and 4K.

**Text stays text.** Real DOM under one `perspective` container; SVG only for
the icons and the map. Nothing is rasterised.

## Where this departs from the brief

Three places, all deliberate and all one-line changes if you want them back:

1. **Z tilt is -2.5 deg, not -8.** The name and percentage columns are ~1940
   board px apart; at -8 a row drops more than two row heights across its own
   width, so reading right from GOLD lands you on the row above's price. The
   reference clip is itself tilted only about 2-3 deg — the rake that sells the
   shot is the `rotateX` recession, not the roll. `ROTATE_Z` in
   `src/constants.ts`. Rows also carry a barely-there alternating tint
   (`rowBand` in `src/theme.ts`) so a row still reads as one unit across the
   gap.

2. **Four section headers, not six.** The 20 approved instrument names partition
   cleanly into ENERGY / METALS / AGRICULTURE / CRYPTO. Adding COMMODITIES and
   INDICES would have meant either repeating rows under a second heading or
   inventing index names — and the brief rules out venue-tied tickers, which is
   what a credible index row would need. Add sections in
   `src/data/instruments.ts`.

3. **One row every ~19.5 frames, not 25-35.** These three constraints cannot all
   hold at once: 480 frames, a seamless loop, and all 20 instruments on screen
   within one cycle. A seamless loop needs the scroll to cover a whole number of
   cycles, and the shortest cycle holding 20 rows plus its headers is 24 slots —
   so 480 / 24 = 20 frames per slot is the *slowest* a 16-second loop can run
   without dropping instruments. It reads as a steady board rather than a fast
   one. A 20-second version at 600 frames would land inside the band; change
   `DURATION_IN_FRAMES` and `CYCLE_HEIGHT` stays as is.

## Assets and licensing

- **Map:** land outlines derived from **Natural Earth** 1:110m "land"
  (`naturalearthdata.com`), which is in the **public domain**. The geometry is
  baked into `src/map/land.ts` as SVG paths, so no basemap is fetched at render
  time and no third-party map imagery is embedded.
- **Icons:** every glyph in `src/icons/Icons.tsx` is drawn by hand as SVG paths.
  No icon library is used.
- **Font:** Roboto Condensed (Apache License 2.0), self-hosted in
  `public/fonts/`. It is used for the numbers as well as the names because its
  figures are genuinely tabular — every digit is 1035/2048 em at weight 700
  while the comma is 501 — so ticking digits never shift the column.
- **Data:** every price and percentage is invented and generated from a seeded
  function. There is no date, no timestamp, no exchange, no broker, no
  venue-specific ticker symbol and no logo anywhere in the frame.

## Where to change things

| What | Where |
| --- | --- |
| Rake, tilt, row heights, column positions | `src/constants.ts` |
| Palettes for both versions | `src/theme.ts` |
| Instruments, sections, price behaviour | `src/data/instruments.ts` |
| Depth-of-field slices | `src/board/DepthOfField.ts` |
| Icons | `src/icons/Icons.tsx` |
| Map markers and network links | `src/map/WorldMap.tsx` |
