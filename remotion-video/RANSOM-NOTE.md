# Ransom-note title animation

A cut-out magazine "ransom note" title that crumples in and out, rebuilt in
Remotion from a reference clip. Two versions, both 1920x1080 / 3840x2160,
30 fps, 300 frames (10.000 s) on a pure black background.

- **MenTAL HEalth** follows the reference's two-line layout and tile sizes.
- **PsYChOLOgY** sets the word on one line. Fitting ten letters across means
  noticeably smaller cuttings — tiles run ~170-200 tall against the two-line
  layout's ~230-290 — with per-letter widths set so every glyph keeps a real
  margin inside its cutting.

## Compositions

| Composition ID              | Resolution  | Reads            |
| --------------------------- | ----------- | ---------------- |
| `RansomMentalHealth-1080p`  | 1920 x 1080 | MenTAL HEalth    |
| `RansomMentalHealth-4K`     | 3840 x 2160 | MenTAL HEalth    |
| `RansomPsychology-1080p`    | 1920 x 1080 | PsYChOLOgY       |
| `RansomPsychology-4K`       | 3840 x 2160 | PsYChOLOgY       |

## Rendering

```console
npm i

# 4K masters (H.264 / MP4)
npx remotion render RansomMentalHealth-4K out/mental-health_4k.mp4 --codec=h264 --crf=17
npx remotion render RansomPsychology-4K   out/psychology_4k.mp4   --codec=h264 --crf=17

# 1080p
npx remotion render RansomMentalHealth-1080p out/mental-health_1080p.mp4 --codec=h264 --crf=17
npx remotion render RansomPsychology-1080p   out/psychology_1080p.mp4   --codec=h264 --crf=17
```

Pixel format (`yuv420p`) and colour space (`bt709`) are pinned in
`remotion.config.ts`, so every render is limited-range Rec.709 — full-range
`yuvj420p` gets re-read as limited by most NLEs, which crushes the blacks and
clips the paper whites.

To preview and re-time interactively: `npm run dev`.

## How it is built

`src/ransom/`

- **`constants.ts`** — timing, canvas, background, the cut-paper edge.
- **`words.ts`** — the letter kit: one entry per scissored tile, with its rect,
  resting tilt, paper colour, ink colour and typeface.
- **`crumple.ts`** — the clip-path polygon morph and the crease shading.
- **`RansomLetter.tsx`** — a single animated letter.
- **`RansomNote.tsx`** — the composition.
- **`fonts.ts`** — self-hosted webfaces (see below).

### Resolution

Everything is authored once in a 1920x1080 design space. The 4K compositions
render that same layout at `resolutionScale: 2`, so 1080p and 4K are the same
animation rather than two separately tuned copies — a 4K frame downscaled to
1080p matches the 1080p frame to well under one code value. Because the letters
are live text and CSS rather than bitmaps, 4K is genuinely resolved, not upscaled.

### Stop-motion cadence

The reference holds each pose for three frames before moving — it is shot "on
3s", 10 poses per second. `BOIL_STEP` quantises every animated value to that
step, and a small per-pose jitter keeps running through the hold, so the letters
never freeze perfectly still. This is what makes it read as paper under a camera
instead of a digital tween. Set `BOIL_STEP = 1` for smooth 30 fps motion.

### The unfold

A letter is one element whose `clip-path` polygon is interpolated between two
shapes with the same point count and ordering: a crumpled wad and the flat tile
rectangle. Morphing point-by-point reads as a sheet being pulled open rather
than a shape cross-fade. While it is bunched up, the tile is overlaid with the
blank reverse of the page and a few shaded creases, both of which fade out as it
flattens — a wad of magazine mostly shows white, not print.

### Timing

Letters unfold left to right, all lines in parallel, and crumple away in the
same wave. Edit in `constants.ts`:

- in: `IN_START` 16, `IN_WAVE_SPAN` 25, `IN_DURATION` 16 — settled by frame 57
- hold: to frame 246
- out: `OUT_START` 246, `OUT_WAVE_SPAN` 25, `OUT_DURATION` 14 — clear by frame 285

Per-letter stagger is *derived* from the wave span rather than fixed, so the
wave takes the same time to cross the piece however many letters it has to
cross. The two-line MenTAL HEalth (6 per line) and the single-line PsYChOLOgY
(10) therefore settle and clear on the same frames — and a longer word can
never push its crumple-out past the end of the composition.

### Fonts

The mismatched typefaces are the whole point of a ransom note. All eight faces
are self-hosted in `public/fonts/`, so rendering never depends on a network
fetch and the project renders identically from a fresh clone. Each face holds a
`delayRender()` handle until it is ready, so no frame is ever captured in a
fallback face.

### Changing the text

Edit `src/ransom/words.ts`. Each letter carries its own `size` (glyph size as a
multiple of tile height) and `dy` (optical centring, as a fraction of tile
height); these were calibrated per glyph by measuring rendered ink bounds
against the reference, so adjust them when you swap a character or a typeface.
