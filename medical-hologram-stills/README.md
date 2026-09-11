# Medical Hologram — stills template (Remotion)

A **stills** template, not a video project. It renders **PNG images** of a glowing,
translucent subject centred on a deep blue field, wrapped in a hexagonal mesh,
ringed by a HUD circle with tick marks, with a horizontal light streak, soft
points of light and drifting particles.

The subject is **swappable**: drop in a monochrome SVG, add one data row, and the
template produces a finished stock still in the house style — no per-subject code.

- Output: **6000 × 3375 px** (16:9), **PNG**, no text, no watermark.
- Batch limits: **max 30 stills per project**, **max 2 colourways per subject**
  (`blue` and `violet`). Both limits are enforced by the prepare step.
- Same tooling as the video work (Remotion 4, rspack), different render command:
  `npx remotion still`.

## Quick start

```console
npm install
npx remotion studio          # preview; pick a composition on the left
npm run render               # every subject × colourway -> out/<subject-id>_<colourway>.png
```

`npm run dev` / `npm run build` / `npm run render` all run the prepare step first
(`npm run prepare-subjects`), which validates the SVGs and generates
`src/subjects/manifest.generated.json`. `npx remotion studio` on its own works too,
as long as the manifest exists (it is committed).

## Rendering a single still

Composition ids are `<subject-id>-<colourway>` (Remotion does not allow `_` in ids);
the deliverable file name is `<subject-id>_<colourway>.png`:

```console
npx remotion still heart-blue out/heart_blue.png
npx remotion still heart-violet out/heart_violet.png
node scripts/dither-png.mjs out/heart_blue.png      # optional: ±1/255 dither pass (see below)
```

`npx remotion still` writes the raw 6000 × 3375 render. The batch renderer
(`npm run render`) additionally applies the dither pass, so prefer it for
deliverables:

```console
npm run render                              # all
npm run render -- --subject heart           # one subject, both colourways
npm run render -- --colourway violet        # one colourway of everything
npm run render -- --scale 0.25              # quick 1500 × 844 previews
npm run render -- --skip-existing           # resume an interrupted batch
npm run render -- --no-dither               # skip the dither pass
```

### Why the dither pass

Chrome renders the big smooth gradient field in 8-bit without dithering, so the
deep blue falloff can show faint banding when inspected at 100%. PNG is lossless,
so banding comes from the render, not compression. `scripts/dither-png.mjs` adds
a seeded ±1/255 noise per channel (¼ of pixels −1, ¼ +1) which breaks the bands up
without visible grain, and writes an opaque RGB PNG. Re-renders are byte-identical.

## Adding a new subject (step by step)

1. **Prepare the SVG** (requirements below) and save it as
   `assets/subjects/<subject-id>.svg`.
2. **Append a row** to `src/subjects/subjects.json`:

   ```json
   { "id": "large-intestine", "name": "Large Intestine", "svg": "intestine.svg",
     "scaleOverride": null, "colourways": ["blue", "violet"] }
   ```

   - `id` — lowercase slug, used for the composition id, the file name and the
     PRNG seed for sparkle/particle placement.
   - `svg` — file name inside `assets/subjects/`.
   - `scaleOverride` — `null` for the default auto-fit (longest side of the
     artwork = 52% of frame height), or a fraction of frame height to use instead.
   - `colourways` — one or two of `"blue"`, `"violet"`.
3. **Run the prepare step**: `npm run prepare-subjects`. It prints one line per
   subject with the detected paths, bounding box and aspect ratio, and warnings
   for anything it had to ignore. Fix any `✖` errors before continuing.
4. **Preview** it: `npx remotion studio`, open `<subject-id>-blue`
   (or the `Preview` composition at 1920 × 1080 and pick the subject in the props
   panel — the layout is defined in fractions of frame height, so it is the same
   picture).
5. **Render**: `npm run render -- --subject <subject-id>`.

Removing a subject is the reverse: delete the row (and the SVG if you like).
The batch is at its 30-still cap, so adding a subject means dropping one. The
capsule came out when the caduceus went in; its SVG is still in
`assets/subjects/` if you want to swap them back.

### Tracing a bitmap into a subject

`scripts/trace-bitmap.mjs` turns flat-colour icon/emoji style PNGs (transparent
background) into a usable monochrome SVG — the silhouette becomes a filled path,
thin accent-coloured lines are skeletonised into stroke centre-lines, thick accent
regions become extra filled paths:

```console
node scripts/trace-bitmap.mjs brain.png assets/subjects/brain.svg --min-spur 30
```

Check the result (it is a plain SVG), tidy by hand if needed, then add the row.
`assets/subjects/brain.svg` was produced this way.

## SVG requirements

The template validates these in the prepare step.

- A **single `<svg>`** with a proper `viewBox`. Nested `<svg>` elements are rejected.
- **Monochrome artwork** — outline strokes and/or flat fills. Source colours are
  discarded (the template recolours everything); a multi-colour file only produces
  a warning.
- **No embedded raster images, no external references, no text.** `<image>`,
  `<text>`, `data:` URIs, `http(s)` hrefs and XML entities are all rejected.
- Supported elements: `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`,
  `polygon`, and `g` (with `transform`s — they are flattened at build time).
  `<use>`, `clip-path`, `mask`, `filter`, gradients and `<style>` blocks are
  ignored with a warning: expand them to plain shapes first.

How the artwork is interpreted:

- Elements with a **fill** become the silhouette: translucent interior, hex mesh
  visible through it, inner rim brightening, bright outer stroke + glow.
- Elements with **`fill="none"` and a stroke** are line art: redrawn at the source
  stroke weight (scaled), never filled. Wide strokes (thicker than ~3× the
  template outline) are drawn as hollow bands — two crisp edges with a translucent
  interior — so they read as holograms rather than solid tubes. Thin strokes stay
  solid lines. `stroke-linecap` / `stroke-linejoin` are honoured.
- Mixing the two in one file is normal and is how the references are built:
  `shield-cross.svg` fills the shield body (translucent interior, mesh showing
  through) and strokes the rim and the cross on top of it.
- `fill-rule="evenodd"` is honoured (for shapes with holes).

### Auto-fit, auto-centre and `scaleOverride`

The artwork is scaled so its longest **bounding-box** side occupies 58% of frame
height and centred on that bounding box (not the viewBox — padding in the source
does not shift the subject). Stroke widths are included in the bounding box.

Artwork **wider than 3:1 or taller than 1:2** is refused by the auto-fit — the
prepare step prints a warning and skips the subject rather than guessing. Give it
a `scaleOverride` (fraction of frame height for its longest side) in the data row.
The ring is 0.92 × frame height across, so anything above ~0.88 crosses the ring.

Subjects in this batch that needed one:

| subject     | aspect   | override | why |
|-------------|----------|----------|-----|
| `dna-helix` | 0.35 : 1 (tall) | `0.62` | At the default 58% a 1:2.8 helix is a thin sliver in the middle of the ring; 62% fills the ring's height without touching it. |
| `caduceus` | 0.85 : 1 | `0.66` | The artwork is a cross shape with a lot of empty field inside its bounding box, so the default 58% reads small against the ring; 66% fills it without crowding. |
| `heartbeat` | 4.44 : 1 (wide) | `0.68` | An ECG trace at 58% of frame height is only 1958 px wide on a 6000 px frame; 68% (~4080 px) fills the ring's width while leaving the lens streak room to run past it. |

## Colourways

Exactly two. Field geometry, mesh, ring assembly and light placement are
identical between them — only the base tint and the two cast colours change — so
a subject's pair reads as a matched set.

| | `blue` (reference match) | `violet` |
|---|---|---|
| field base | deep blue, `#00002b` → `#000074` left to right | deep violet, `#100527` → `#2d0e6a` |
| left cast | violet `rgb(71, 34, 112)` | magenta `rgb(112, 20, 95)` |
| right cast | cyan `rgb(0, 89, 107)` | blue `rgb(20, 52, 128)` |
| subject outline | `#d8f4ff` | `#f0d8ff` |
| fill | cyan | violet |
| left arc | `#7a4ae8` | `#e026c0` |
| right arc | `#22d3ee` | `#4a6ae8` |

All colours live in `src/hologram/colourways.ts`; the field model they feed is in
`src/hologram/field.ts`.

## Measured against the reference

The house style is not eyeballed. The two reference stills were sampled on a
1500 × 844 grid (30th percentile of a 21 × 21 window at each point, so the hex
mesh and the stock watermark don't skew the reading) and the template was fitted
to those numbers. Anything a render can be checked against:

| | reference | template |
|---|---|---|
| ring diameter | 0.924 × frame height | 0.924 |
| subject longest side | ~0.59 × frame height | 0.58 |
| hex cell (flat-to-flat) | 0.033 × frame height | 0.0335 |
| mesh line contrast, outer field | +4.0 / 255 | +4.0 |
| tick band radii | 0.435 – 0.50 × frame height | 0.435 – 0.502 |
| tick angular pitch | ~2.7° | 2.7° |
| tick band contrast | ±5.2 – 6.2 / 255 | ±5.1 – 6.3 |
| lens streak, peak over field | +15 at 0.53H from centre, +5 at 0.65H | +14, +12 |
| light bloom reach | — | 0.013 – 0.031 × frame height |
| radial luminance profile | — | within ±5 / 255 at every radius |
| field, 56 sample points | — | RMS 3.4 / 255 |

Two numbers deliberately differ from the brief, which gave them as
approximations: the brief says a 0.78 × height ring and a 52% subject, and the
references measure 0.92 and ~0.59. The template follows the references.

`scripts/` has no comparison tool: the measurements were taken with a throwaway
script against the licensed stock previews, which are not redistributable and so
are not in this project.

The field itself is a fitted layer stack rather than a hand-tuned gradient: a
pure-blue horizontal ramp, an elliptical violet cast on the left, an elliptical
cyan cast on the right, a wide central halo, and a shade toward the bottom edge.
Each layer is one SVG gradient composited with `mix-blend-mode: screen`, which is
exactly `screen(dst, src × a)` — so a stop's opacity is the fitted layer
intensity, with no approximation in the transcription. `src/hologram/field.ts`
carries the model and generates the stops.

## Project layout

```
assets/subjects/          the SVGs, one per subject
src/subjects/subjects.json          the subject data file (edit this)
src/subjects/manifest.generated.json generated by prepare-subjects (do not edit)
src/hologram/MedicalHologram.tsx    the <MedicalHologram subjectId colourway> still
src/hologram/colourways.ts          the two colour treatments
src/hologram/field.ts               the fitted background field model + gradient stops
src/hologram/layout.ts              fit / centre / hex mesh / ring / tick geometry
src/hologram/random.ts              seeded PRNG (keyed on subject id)
src/Root.tsx                        registers one <Still> per subject × colourway + a 1080p Preview
scripts/prepare-subjects.mjs        validate + flatten SVGs, bbox, sparkle anchors
scripts/render-stills.mjs           batch render + dither
scripts/dither-png.mjs              ±1/255 dither for a single PNG
scripts/trace-bitmap.mjs            bitmap -> monochrome SVG helper
previews/                           small JPEG previews of the rendered batch
out/                                rendered PNGs (git-ignored)
```

## Implementation notes

- One `<MedicalHologram>` component taking `{ subjectId, colourway }`; everything
  is a single SVG so the artwork stays vector down to the final pixel (no
  rasterise-and-scale anywhere).
- SVG artwork is flattened at build time into plain paths (transforms baked in),
  loaded inline, and drawn in several passes (glow, translucent fill, mesh
  through a mask, rim, halo, crisp outline).
- The artwork bounding box, aspect ratio and the high-curvature anchor points used
  for sparkle placement are all computed at build time in the prepare step.
- Sparkles and particles use a mulberry32 PRNG seeded from the subject id.
- The points of light on the subject's outline are diffuse blooms, not
  sparkles: a broad soft glow around a diffuse core, the whole thing pushed
  through a heavy gaussian blur so there is no ray, no star and no edge to
  read. The two ring flares are the same element at a larger size. The blur
  radius has to scale with each light, which is why each gets its own filter —
  a single filter on a scaled group rasterises at the wrong size.
  Brightness and blur trade off directly: blurring a small core spreads its
  energy until it disappears, so if you soften them further, grow the core in
  `SoftLight` to match.
- Every size is a fraction of frame height, so the 1920 × 1080 `Preview`
  composition and the 6000 × 3375 stills are the same layout.
- A quirk to know: `remotion.config.ts` only applies to the CLI. The batch script
  passes the same options (browser executable, PNG format, timeouts) to the Node
  APIs itself.
- `mix-blend-mode` belongs on the element, not on a wrapping `<g>`: siblings
  inside a group composite with each other normally and only the finished group
  blends with the backdrop, so grouping the field layers silently turns the
  screen stack into plain over-painting.
