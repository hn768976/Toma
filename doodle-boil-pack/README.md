# Doodle Boil Pack

Hand-drawn doodle overlays that **boil**: each drawing is redrawn slightly differently every
3 frames, like classic hand animation. They're on green screen or black, ready to key over
footage.

Remotion · 30 fps · 16:9 · every composition is defined at **3840×2160**.

| Composition id (CLI) | Output file | Look | Background | Length |
|---|---|---|---|---|
| `DoodleFrame-Crayon` | `DoodleFrame_Crayon.mp4` | 40 crayon doodles around the edges, empty centre | green `#00FF00` | 10 s loop |
| `DoodleFrame-ChalkBlack` | `DoodleFrame_ChalkBlack.mp4` | the same frame in white chalk | black | 10 s loop |
| `BoilArrow-Cream` | `BoilArrow_Cream.mp4` | chunky cream arrow, thick black outline, hatching | green | 10 s loop |
| `ChalkArrow-Curved` | `ChalkArrow_Curved.mp4` | white chalk arrow curving up and right | green | 10 s loop |
| `ChalkHearts` | `ChalkHearts.mp4` | chalk heart with scribble fill and two small hearts | green | 10 s loop |
| `ChalkArrows-Down` | `ChalkArrows_Down.mp4` | three chalk arrows fanning in and pointing down | green | 10 s loop |
| `BrushArrowPack-Black` | `BrushArrowPack_Black.mp4` | 12 brush-ink arrows draw on, then boil | black | 8 s |
| `BrushArrowPack-Green` | `BrushArrowPack_Green.mp4` | the same pack in black ink | green | 8 s |

Remotion ids can't contain `_`, so the ids use `-`. The commands below write the files with
`_` names.

## Setup

```bash
npm ci          # or: npm install (versions are pinned exactly in package.json)
npm run dev     # Remotion Studio, to preview any composition
```

## Render at 4K

```bash
for id in DoodleFrame-Crayon DoodleFrame-ChalkBlack BoilArrow-Cream ChalkArrow-Curved \
          ChalkHearts ChalkArrows-Down BrushArrowPack-Black BrushArrowPack-Green; do
  npx remotion render "$id" "out/4k/${id/-/_}.mp4" \
    --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
done
```

One at a time:

```bash
npx remotion render DoodleFrame-Crayon out/4k/DoodleFrame_Crayon.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
```

- **PNG frames are on purpose.** JPEG intermediates put compression noise into the flat key
  colour. `remotion.config.ts` already sets PNG, H.264, CRF 16 and yuv420p.
- **ProRes 4444 for editing:** `--codec=prores --prores-profile=4444`.
- **720p previews** like the ones delivered: add `--scale=0.3333333333333333`. The drawing is
  identical; it's rasterised at 1280×720.
- **Loops:** for a seamless repeat, the 10 s loops are exactly 300 frames, and frame 300 equals
  frame 0. To render the 301-frame check version, pass `--props='{"loopCheck":true}'`.

## Keying

- **Green clips** (`DoodleFrame_Crayon`, `BoilArrow_Cream`, the three chalk clips,
  `BrushArrowPack_Green`): the background is exactly `#00FF00`. It is flat, with no grain,
  vignette or shadow. No ink uses green, lime, teal or cyan; every ink colour, including sky
  blue `#48B8F0`, stays fully opaque under `chromakey=0x00FF00:0.12:0.05`.
  - Use any keyer (Keylight, Ultra Key, Resolve's 3D keyer) with **spill suppression on**. With
    a bare key and no spill suppression, the 1–2 px antialiased rim of each stroke keeps a green
    tint. In ffmpeg, add `despill`:
    ```bash
    ffmpeg -i ChalkHearts.mp4 -i background.mp4 -filter_complex \
      "[0:v]format=yuva444p,chromakey=0x00FF00:0.12:0.05,despill=type=green[k];[1:v][k]overlay" out.mp4
    ```
- **Black clips** (`DoodleFrame_ChalkBlack`, `BrushArrowPack_Black`): the background is
  exactly (0,0,0). Set the layer's blend mode to **Screen** (or Add/Lighten). White ink stays
  white and black disappears.

## Changing ink colours

All colours live in one file, `src/inks.ts`. Each look is one row:

```ts
export const CHALK = "#F4F4F0";                    // clips 2, 4, 5, 6
export const CRAYON = { orange: "#F0A030", ... };  // clip 1 palette
export const CREAM = { fill: "#F2E2B0", outline: "#141414", speckle: "#C9B27A" }; // clip 3
export const BRUSH_WHITE = "#F5F5F5";              // clip 7
export const BRUSH_BLACK = "#141414";              // clip 8
export const BRUSH_BLACK_STREAK = "#5A5A5A";       // clip 8 dry-brush streaks
```

Change a value and re-render. On green clips, keep inks away from green, lime, teal and cyan,
or they will key out.

## Changing the boil speed

Edit `src/lib/boil.ts`:

```ts
export const HOLD_FRAMES = 3; // frames each drawing is held: 2 = livelier, 4 = calmer
export const VARIANTS = 4;    // number of different drawings cycled through
```

For a seamless 300-frame loop, `HOLD_FRAMES × VARIANTS` must divide 300: 3×4 = 12, 2×5 = 10,
5×4 = 20 and 3×5 = 15 all work. The boil size (how far each redraw moves) is set per doodle,
at about 0.8–1% of the doodle's size. Search `singleDoodle(` in `src/doodles/` for the clips
3–6 values, or `d.size * 0.01` in `src/doodles/doodleFrame.ts` for the frames.

## Timings

**Loops (clips 1–6), 300 frames each:**
- The drawing changes every 3 frames: 4 drawings × 3 frames = a 12-frame cycle, 25 cycles per
  loop.
- Drift on top of the boil:
  - each doodle bobs ±0.5% of frame height (±10.8 px at 4K) and tilts ±1°;
  - it runs on cosines with whole cycles per loop, with a different phase per doodle;
  - it steps on the same 3-frame holds as the boil, so the picture changes only every 3 frames.

**Arrow packs (clips 7–8), 240 frames:**

| Time | Frames | What happens |
|---|---|---|
| 0–4 s | 0–119 | The 12 arrows draw on in a fixed seeded order. A new arrow starts about every 0.3 s and takes 0.4–0.7 s (12–21 frames): shaft first, then a 3-frame pen lift, then the head. The easing starts slowly, speeds up through the middle and slows a little at the end. |
| 4–8 s | 120–239 | All 12 boil in place. |

The arrows boil while they draw on, too. Each arrow sits in its own 960×720 cell of a 4×3 grid,
with no divider lines, so it can be cropped out on its own.

## How it's built

- **perfect-freehand:** pressure-shaped stroke outlines (tapers, heavier starts, swollen chalk
  ends) and the draw-on, which grows a stroke along its points.
- **Rough.js:** the heart's scribble fill, the cream arrow's hatching and the crayon scribble
  doodle, all seeded.
- **@remotion/paths:** path lengths, used to sample every centre line at even spacing.
- **Boil:** each stroke gets a fixed hand tremor and pressure wobble. Each of the 4 variants
  then moves the line by a smooth seeded offset field and slightly changes width and pressure.
  The texture offset is also different per variant.
- **Edges:** each mark is blurred and its alpha is compared with a fixed noise field. The edge
  bites in and bulges out like chalk, crayon or a dry brush, but the inside of a stroke never
  opens up.
- **Grain inside strokes:** painted on as tone, not transparency, so nothing inside a stroke
  keys out.
- **Crayon overlaps:** where a stroke crosses earlier wax, the overlap gets slightly darker.
- **Determinism:**
  - every value comes from `useCurrentFrame()`;
  - randomness is `mulberry32`, seeded from the composition id, doodle, stroke and variant;
  - `Math.random()`, `Date.now()` and `useState` are never used for visuals;
  - textures are generated once per browser tab from fixed seeds;
  - a cold-start render of any frame matches the same frame in a full render byte for byte.

`tools/verify.py` runs the checks used during development (format, loop seam, background
levels, key test, boil cadence, determinism). It expects 720p previews in `out/previews/` and
a bundle in `out/bundle/` (`npx remotion bundle --out-dir=out/bundle`).
