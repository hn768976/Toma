# Hex Dump / Cyber Alert Screen

A full-frame wall of scrolling hexadecimal data with highlighted blocks and red
alert phrases. Built with [Remotion](https://remotion.dev) as **real DOM text**
in an embedded monospace webfont — no canvas, no 3D — so every glyph stays crisp
at 4K.

Three compositions, all **3840×2160 · 30fps · 720 frames (24s) · seamless loop**:

| Composition id      | Look                                                      |
| ------------------- | --------------------------------------------------------- |
| `V1-HexAlertsCyan`  | Grey-white field, cyan + amber highlight blocks, red alerts |
| `V2-HexAlertsGreen` | Green phosphor field, red alerts                           |
| `V3-HexDataPlate`   | Clean data plate — the scrolling field only, no alerts      |

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are authored at 3840×2160, so a 4K master is just `--scale=1`:

```bash
npx remotion render V1-HexAlertsCyan  out/V1_HexAlertsCyan.mp4  --scale=1 --crf=16
npx remotion render V2-HexAlertsGreen out/V2_HexAlertsGreen.mp4 --scale=1 --crf=16
npx remotion render V3-HexDataPlate   out/V3_HexDataPlate.mp4   --scale=1 --crf=16
```

H.264 / `yuv420p` come from `remotion.config.ts`. For a 1920×1080 preview pass
`--scale=0.5` instead; for a still, `npx remotion still <id> out/<name>.png
--frame=600 --scale=0.5`.

`deliverables/` holds one 1080p still per version and `hex-alert-project.zip`,
a clean copy of this project (no `node_modules`, no `.git`, no render output).
The 1920×1080 preview mp4s are not committed — they are render output and come
back in about 90 seconds a piece with the `--scale=0.5` command above.

## How the loop closes

Everything on screen is a pure function of `useCurrentFrame()`, periodic over
`durationInFrames`. There is no state between frames and no `Math.random()` at
render time — the hex pools and row skeletons are built once at module level
from a seeded PRNG.

- The field scrolls **exactly one row every 40 frames**: 18 rows over the 720
  frame loop, which is 720px — a third of the frame height — at 4K.
- Row content is keyed on `dataRow % 18`, the scroll period, so after a full
  loop every row lands back on the content it started with.
- Churn (characters, highlight flicker, row re-layout) is keyed on the loop
  invariant `u = 40 * dataRow - frame`, which is unchanged by
  `(dataRow + 18, frame + 720)`. That makes the churn repeat exactly at the
  wrap while still differing between rows one scroll-period apart, so the
  18-row period never reads as a visible vertical repeat.

The field loop is pixel-exact: rendering `V3-HexDataPlate` at frame *n* and at
frame *n + 720* produces byte-identical PNGs.

The alert set is the one thing that cannot loop continuously — the phrases
accumulate through the clip and have to be gone again at frame 0. They are held
complete for the last 250 frames and the reset is covered by a four-frame
glitch straddling the wrap (frames 718, 719, 0, 1). `V3-HexDataPlate` has no
alerts and therefore no glitch at all.

## Layout

`fontSize`, row height and character cell all derive from the frame height via
`useVideoConfig()`, and the ratios are chosen to land on whole pixels at both
resolutions:

|              | 4K   | 1080p |
| ------------ | ---- | ----- |
| row height   | 40px | 20px  |
| font size    | 30px | 15px  |
| char advance | 18px | 9px   |

54 rows fill the frame. The character advance is JetBrains Mono's 0.6em —
the font is **embedded** in `public/fonts/`, because a substituted fallback
would change the cell width and break the integer scroll.

## Source map

```
src/constants.ts   geometry, cadences, the loop invariant
src/random.ts      seeded hash + PRNG, pre-built hex string pools
src/field.ts       row skeletons (token widths, gaps, highlight tiers)
src/alerts.ts      alert phrases, positions and entrance frames
src/themes.ts      the cyan and green palettes
src/HexField.tsx   the scrolling field
src/AlertLayer.tsx alert labels, scrolling with the field
src/Overlays.tsx   grain, scanlines, vignette, glow, wrap glitch
src/HexScene.tsx   composition body
src/Root.tsx       the three compositions
```

Font: JetBrains Mono, SIL Open Font License 1.1 (see
`public/fonts/JetBrainsMono-LICENSE.txt`).
