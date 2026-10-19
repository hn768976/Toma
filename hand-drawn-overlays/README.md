# Hand-Drawn Overlays

10 overlay clips and 12 clip-art sheets, built in code with Remotion,
**perfect-freehand**, **Tegaki**, **Rough.js** and **@remotion/paths**.
All are 2D, 30 fps and 16:9. Compositions are defined at **3840×2160**.

| Output file | Composition id | Look | Background | Length |
|---|---|---|---|---|
| `DoodlePack_WhiteOnBlack.mp4` | `DoodlePack-WhiteOnBlack` | 12 doodles draw on, then fade out in a stagger | pure black | 12 s |
| `DoodlePack_InkOnGreen.mp4` | `DoodlePack-InkOnGreen` | same doodles in dark ink | `#00FF00` | 12 s |
| `ScribbleWipe_Marker.mp4` | `ScribbleWipe-Marker` | yellow marker scribble wipe | `#00FF00` | 3 s |
| `ScribbleWipe_Ink.mp4` | `ScribbleWipe-Ink` | black ink scribble wipe | `#00FF00` | 3 s |
| `Handwritten_Hello.mp4` | `Handwritten-Hello` | "Hello" + underline | pure black | 6 s |
| `Handwritten_ThankYou.mp4` | `Handwritten-ThankYou` | "Thank you" + heart | pure black | 6 s |
| `Handwritten_Welcome.mp4` | `Handwritten-Welcome` | "Welcome" + flourish | pure black | 6 s |
| `Handwritten_Subscribe.mp4` | `Handwritten-Subscribe` | "Subscribe" + arrow | pure black | 6 s |
| `NotebookPage_Loop.mp4` | `NotebookPage-Loop` | notebook margin doodles (seamless loop) | paper | 20 s |
| `InkFlourish_Black.mp4` | `InkFlourish-Black` | abstract calligraphic flourish + ink dot | pure black | 5 s |

> **Ids use `-`, not `_`.** Remotion only allows `a-z A-Z 0-9 -` in
> composition ids, so `DoodlePack_WhiteOnBlack` is registered as
> `DoodlePack-WhiteOnBlack`. The output file names keep the `_` names.

Clip-art stills (transparent PNG): `ClipArt-C1-Arrows-Black`, `ClipArt-C2-Arrows-White`,
`ClipArt-C3-Circles-Frames`, `ClipArt-C4-Underlines`, `ClipArt-C5-Banners`, `ClipArt-C6-Stars`,
`ClipArt-C7-Bubbles`, `ClipArt-C8-Checks`, `ClipArt-C9-Brackets`, `ClipArt-C10-Hearts` (red `#D8343A`),
`ClipArt-C11-Dividers`, `ClipArt-C12-Emphasis`.

## Setup

```bash
npm ci            # exact versions are pinned in package.json / package-lock.json
npm run dev       # Remotion Studio
```

Node 18+ is needed. Remotion downloads its own Chrome Headless Shell on first
render. `remotion.config.ts` only points at a local headless shell if one
exists at a sandbox-specific path. On a normal machine it does nothing.

## Rendering at 4K

```bash
npx remotion render DoodlePack-WhiteOnBlack out/4k/DoodlePack_WhiteOnBlack.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render DoodlePack-InkOnGreen   out/4k/DoodlePack_InkOnGreen.mp4   --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render ScribbleWipe-Marker     out/4k/ScribbleWipe_Marker.mp4     --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render ScribbleWipe-Ink        out/4k/ScribbleWipe_Ink.mp4        --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render Handwritten-Hello       out/4k/Handwritten_Hello.mp4       --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render Handwritten-ThankYou    out/4k/Handwritten_ThankYou.mp4    --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render Handwritten-Welcome     out/4k/Handwritten_Welcome.mp4     --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render Handwritten-Subscribe   out/4k/Handwritten_Subscribe.mp4   --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render NotebookPage-Loop       out/4k/NotebookPage_Loop.mp4       --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render InkFlourish-Black       out/4k/InkFlourish_Black.mp4       --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

For the green-screen clips, a less lossy master keys even more cleanly:
add `--codec=prores --prores-profile=4444`, or use `--pixel-format=yuv444p`
with h264.

**`--gl=angle` is not needed.** Nothing uses WebGL. Everything is SVG, plus
Tegaki's 2D canvas.

The 720p previews were rendered with `scripts/render-previews.sh`, using
`--scale=0.3333333333333333`, CRF 16 and `yuv420p`.

## 6K transparent clip-art sheets (6000×3375)

The stills are defined at 3840×2160; `--scale=1.5625` gives exactly 6000×3375.

```bash
for s in C1-Arrows-Black C2-Arrows-White C3-Circles-Frames C4-Underlines C5-Banners C6-Stars \
         C7-Bubbles C8-Checks C9-Brackets C10-Hearts C11-Dividers C12-Emphasis; do
  npx remotion still "ClipArt-$s" "out/6k/ClipArt-$s.png" --image-format=png --scale=1.5625
done
```

`--image-format=png` keeps the alpha channel, so the background is
transparent. `scripts/render-sheets.sh` renders the 720p review set and tiles
it into `out/ClipArtSheet.png`; it needs ImageMagick. The white-ink C2 sheet
goes on a dark checkerboard there, because white on a light one is invisible.

## Render times (measured)

Machine: 4-core cloud container, 15 GB RAM, Remotion default concurrency (2 tabs).

| Clip | 720p frames | 720p wall time | per frame |
|---|---|---|---|
| DoodlePack_WhiteOnBlack | 360 | 45.9 s | 0.13 s |
| DoodlePack_InkOnGreen | 360 | 54.0 s | 0.15 s |
| ScribbleWipe_Marker | 90 | 17.2 s | 0.19 s |
| ScribbleWipe_Ink | 90 | 15.2 s | 0.17 s |
| Handwritten_Hello | 180 | 66.9 s | 0.37 s |
| Handwritten_ThankYou | 180 | 70.4 s | 0.39 s |
| Handwritten_Welcome | 180 | 72.6 s | 0.40 s |
| Handwritten_Subscribe | 180 | 72.8 s | 0.40 s |
| NotebookPage_Loop | 600 | 192.1 s | 0.32 s |
| InkFlourish_Black | 150 | 11.4 s | 0.08 s |

Wall time includes browser start-up and the H.264 encode.

**One 4K frame** (`remotion still`, cold, a single tab): DoodlePack frame 180
took **2.9 s** and NotebookPage frame 300 took **5.1 s**. The same command at
720p takes 2.4–2.7 s, almost all of it browser start-up. So the 4K frame itself
costs about **0.6 s** (doodles) and **2.4 s** (notebook: paper grain filters at
full resolution). Expect roughly 4–10× the 720p per-frame times for full 4K renders.

## Add a handwritten word (one data row)

Edit `src/data/words.ts` and add a row:

```ts
{ id: "Handwritten_LikeShare", text: "Like & share", mark: "arrow", seed: 53 },
```

`mark` is `underline`, `heart`, `flourish`, `arrow` or `none`. The word is
centred and sized automatically, so its cap height is 22% of the frame. Render
it as `Handwritten-LikeShare` (underscores become hyphens). Caveat covers
Latin letters, digits and common punctuation.

## Change ink colours

All colours live in `src/theme.ts`:

- `INK.white`: lines on the black clips.
- `INK.dark`: doodles on green.
- `INK.marker` / `INK.markerStreak`: the yellow wipe.
- `INK.ink` / `INK.inkStreak`: the black wipe.
- `INK.ballpoint`: the notebook doodles.
- `INK.sheetBlack` / `sheetWhite` / `sheetRed`: the clip-art sheets.
- `PAPER.*`: the notebook paper.

On green-screen clips, keep inks free of green: a neutral or warm colour keys cleanly.

## Using the clips

**Black clips** (Doodle Pack White, Handwritten ×4, Ink Flourish): put them
above your footage and set the blend mode to **Screen** (Premiere: *Opacity →
Blend Mode → Screen*; Resolve: *Composite Mode → Screen*; After Effects:
*Mode → Screen*). The background is exactly RGB (0,0,0), with no grain,
vignette or glow, so it vanishes completely. The ink has a slight grain in
its opacity, which reads as marker or chalk texture once screened.

**Green clips** (Doodle Pack Ink, Scribble Wipes): apply a **chroma key** on
`#00FF00` (Premiere *Ultra Key*, Resolve *3D Keyer*, AE *Keylight*). With
`yuv420p` H.264 the antialiased edge of dark ink picks up a thin dark-green
rim, so turn on **spill suppression / despill**. In ffmpeg:

```bash
ffmpeg -i DoodlePack_InkOnGreen.mp4 -i your_footage.mp4 -filter_complex \
 "[0:v]chromakey=0x00FF00:0.15:0.04,despill=type=green[k];[1:v][k]overlay" out.mp4
```

Keep the similarity low (about 0.15). Very high similarity starts eating the
dark ink. The scribble wipes fully cover the frame from 1.2 s to 1.6 s: cut
between your two shots there.

**Notebook page:** a normal background. It loops seamlessly at 600 frames
(frame 600 = frame 0), and the centre ~60% stays empty for your content.

## How it is built

- `src/lib/pen.ts` is the pen engine. Each stroke draws on with a hand-like
  ease (slow start, fast middle, slight slow-down at the end). Duration grows
  as length^0.55, because long strokes are faster. There is a seeded 2–5 frame
  pen lift between strokes. Pressure is simulated from speed (fast = thin),
  ink pools where the pen lands, and size and exit taper vary per stroke.
  Strokes are rendered with perfect-freehand (`thinning` ≈ 0.6, tapered ends).
  After a stroke finishes it boils: the points get a tiny seeded offset that
  changes every 3 frames.
- `src/lib/geometry.ts`: `@remotion/paths` (`getSubpaths`, `getLength`,
  `getPointAtLength`) samples SVG paths into pen polylines. Rough.js op sets
  (seeded) are converted into pen strokes the same way.
- `src/lib/shapes.ts`: about 120 shape generators and helpers (arrows, circles, stars,
  bubbles, hearts and more), all with deliberate imperfections.
- `src/clips/TegakiWord.tsx`: Tegaki made frame-driven (see below).
- **Determinism.** There is no `Math.random`, `Date.now`, `useState` or rAF
  driving visuals. Randomness comes from `mulberry32` seeded by string hashes
  of the composition id, the element id and `floor(frame / 3)`. A cold render
  of any frame matches the full render byte for byte.

### What Tegaki needed in Remotion

Tegaki 1.1.0 already has a controlled-time mode (`time: { mode: 'controlled', value }`),
which its Remotion example uses. In uncontrolled mode it advances with
`requestAnimationFrame`. The wrapper (`TegakiWord.tsx`) changes these things:

1. **The engine is created in `useLayoutEffect`, not `useEffect`.** Tegaki's
   React component creates its engine and pushes time in passive effects.
   Driving `TegakiEngine` directly from layout effects paints the canvas
   synchronously in the same commit as the frame.
2. **Time always comes from the frame.** Tegaki's natural timeline is squeezed
   into 0.5–3.5 s. After that, time keeps running in real seconds, so the
   `boil` plugin (10 drawings/s = every 3 frames) continues through the hold.
3. **The font loads once, behind `delayRender`.** `TegakiEngine.preload()`
   runs at module level, and `continueRender` fires one animation frame after
   it resolves. Tegaki's own font loading is async and not tied to `delayRender`.
4. **`seed` is a fixed number.** Tegaki's `'random'` seed uses `Math.random()`.
5. **Layout comes from the bundle's glyph data.** Advances and the cap height
   are measured on the H strokes, so placement never depends on whether the
   browser has loaded the font yet.
6. **Hand rhythm** comes from `strokeEasing` and `glyphGap: 0.1` (3 frames).
   The `variation` plugin adds per-letter lean and baseline drift.

## Licences

- Code dependencies: Remotion (Remotion licence: free for individuals and
  small companies; larger companies need a company licence, see remotion.dev/license).
  perfect-freehand, Tegaki, Rough.js and @remotion/paths are MIT.
- **Caveat** font: © 2014 The Caveat Project Authors, SIL Open Font
  License 1.1. A copy of the font and its licence is in `fonts/caveat/`
  (`Caveat.ttf`, `OFL.txt`). At render time the font is loaded from Tegaki's
  bundle (`tegaki/fonts/caveat`). Tegaki's own font-licence summary is in
  `fonts/caveat/TEGAKI-FONTS-LICENSE.md`.
