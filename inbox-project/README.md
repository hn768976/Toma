# Spam & Phishing Inbox — Remotion project

Four seamless 14-second loops of a light/dark webmail inbox auto-scrolling
upward, every row flagged as spam or phishing. One `<InboxList>` component,
parameterised four ways.

| Composition id           | Content  | Theme | Framing                          |
| ------------------------ | -------- | ----- | -------------------------------- |
| `V1-SpamInboxLight`      | Spam     | Light | Flat, straight-on                 |
| `V2-PhishingInboxLight`  | Phishing | Light | Perspective skew + focus falloff |
| `V3-SpamInboxDark`       | Spam     | Dark  | Flat, straight-on                 |
| `V4-PhishingInboxDark`   | Phishing | Dark  | Perspective skew + focus falloff |

All four are defined at **3840×2160, 30 fps, 420 frames (14 s)**.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering

### 4K masters (what to run for delivery)

```bash
npx remotion render V1-SpamInboxLight     out/V1_SpamInboxLight.mp4     --scale=1 --crf=16
npx remotion render V2-PhishingInboxLight out/V2_PhishingInboxLight.mp4 --scale=1 --crf=16
npx remotion render V3-SpamInboxDark      out/V3_SpamInboxDark.mp4      --scale=1 --crf=16
npx remotion render V4-PhishingInboxDark  out/V4_PhishingInboxDark.mp4  --scale=1 --crf=16
```

### 1080p previews

```bash
npx remotion render V1-SpamInboxLight out/V1_SpamInboxLight.mp4 --scale=0.5 --crf=18
```

### Stills

```bash
npx remotion still V1-SpamInboxLight out/V1_SpamInboxLight.png --frame=0 --scale=0.5
```

`remotion.config.ts` already pins H.264, `yuv420p` and overwrite-on-render, so
those flags do not need repeating on the command line. It also pins the colour
space to `bt709`: Remotion's intermediate frames are full-range JPEGs, and
without that pin x264 tags the output `yuvj420p` / `color_range=pc`.

## How the loop works

The list never scrolls; a single CSS `translateY` on the row strip is a pure
function of `useCurrentFrame()`:

```
offset(frame) = frame / 420 * (14 rows × 190 px) = frame × 6.333 px
```

Over 420 frames that is exactly **14 row heights**, and each content set holds
exactly **14 subjects**, so frame 420 is pixel-identical to frame 0. 14 is even,
so the alternating row tint keeps its parity across the wrap too. One row every
30 frames.

Two things this depends on, worth knowing before editing:

- **Every layout metric in `src/constants.ts` is an even number of design px.**
  The compositions are authored at 4K and previewed at `--scale=0.5`; an odd row
  height would land on a half pixel at one of the two scales and the loop would
  drift.
- **The strip has no `will-change: transform`.** Promoting it to its own
  composited layer makes the tile grid land differently at different scroll
  offsets, which perturbs icon antialiasing by a point or two — enough to break
  the bit-exact loop.

Rows are clipped at the frame boundary, never faded; the only softening is a
very subtle fade band directly under the toolbar.

## Layout / style notes

- `src/data.ts` holds both content sets — swap or edit them there. Keep each set
  at 14 subjects or the loop period changes.
- Subject lines only: no sender names, no addresses, no brands, no logos, no
  links.
- Fonts are self-hosted in `public/fonts` (Inter + Roboto Mono, Google Fonts
  `latin` subset of each variable font) so a render never touches the network.
  The subset covers U+2212 MINUS SIGN and U+2026 ELLIPSIS, both used in the spam
  subjects.
- Palette lives in `src/theme.ts`. One deliberate deviation from a strict
  `#9aa0a6`-for-all-chrome reading: the references draw the outline icons (row
  checkbox and star, toolbar trash and overflow) noticeably darker than the
  search-field chrome, so those follow the flag-label colour and `chrome` is
  used for the search field's border, magnifier and placeholder.
- The skewed compositions lay the screen out into a box *larger* than the frame
  (`SKEW_BLEED`) rather than scaling it up. A `scale()` overfill big enough to
  hide the rotated corners also crops the toolbar and the checkbox column; the
  bleed keeps the tilt without losing either. The band left above the toolbar is
  page-coloured, and the toolbar carries only a bottom border, so it is
  invisible.
- The focus falloff is three stacked copies of the screen at blur 0 / 9 / 22 px,
  each revealed in a horizontal band — discrete slices, not a gradient blur. The
  masks only soften the joins.

## Layout

```
src/
  index.ts        registerRoot
  Root.tsx        the four <Composition> wirings
  InboxList.tsx   <InboxList>: toolbar, rows, scroll, skew, blur slices
  Icons.tsx       inline SVG icons
  constants.ts    composition + layout metrics (all even design px)
  data.ts         both content sets
  theme.ts        light / dark palettes
  load-fonts.ts   self-hosted webfont registration
public/fonts/     Inter + Roboto Mono woff2
```
