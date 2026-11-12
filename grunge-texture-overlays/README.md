# Grunge Texture Overlays (Remotion)

Eight full-frame, stop-motion **distressed texture overlays** in four looks. A different texture "card"
flashes up every 2–4 frames, so footage under them looks scratched, photocopied or drawn on paper.
All compositions are **3840×2160, 30 fps, 600 frames (20 s), seamless loops**.

| Composition (file name) | Remotion id | Look | Background | Blend mode in your editor |
|---|---|---|---|---|
| `ScratchGrunge_Black` | `ScratchGrunge-Black` | white scratches, dust, scuffs on black | (0,0,0) | **Screen** |
| `ScratchGrunge_White` | `ScratchGrunge-White` | exact inverse: dark scratches on white | (255,255,255) | **Multiply** |
| `PhotocopyGrunge_White` | `PhotocopyGrunge-White` | worn xerox: toner haze, specks, folds, roller streaks | (255,255,255) | **Multiply** |
| `PhotocopyGrunge_Black` | `PhotocopyGrunge-Black` | exact inverse on black | (0,0,0) | **Screen** |
| `CharcoalGrunge_White` | `CharcoalGrunge-White` | charcoal/pencil streaks, rubbed smudges, specks, hairs | (255,255,255) | **Multiply** |
| `CharcoalGrunge_Orange` | `CharcoalGrunge-Orange` | same marks, dark brown-black on flat orange | `#E0920A` | **Normal** (a backdrop) |
| `BrushFrame_White` | `BrushFrame-White` | ink-wash brush frame over faint charcoal, clean centre | (255,255,255) | **Multiply** |
| `BrushFrame_Black` | `BrushFrame-Black` | same frame in light grey on black | (0,0,0) | **Screen** |

Remotion ids cannot contain `_`, so each composition is registered with a hyphen (`ScratchGrunge-Black`).
The render commands below write the underscore file names.

Empty areas are exact: **(0,0,0)** in the black versions, **(255,255,255)** in the white versions and
**`#E0920A`** in the orange one, so the empty areas vanish in their blend mode. Every clip except the
orange one is pure greyscale (R = G = B). In the brush frames, the centre 75% × 65% is always clean.

## Setup

```bash
npm ci
```

```bash
npm run dev
```

`npm run dev` opens Remotion Studio. The Studio preview renders at up to 4K, so scrubbing is slow.

## Render at 4K

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 12, PNG frame capture (needed for exact
levels), no audio and `--gl=angle`. One clip:

```bash
npx remotion render ScratchGrunge-Black out/ScratchGrunge_Black.mp4
```

All eight:

```bash
for id in ScratchGrunge_Black ScratchGrunge_White PhotocopyGrunge_White PhotocopyGrunge_Black CharcoalGrunge_White CharcoalGrunge_Orange BrushFrame_White BrushFrame_Black; do npx remotion render ${id/_/-} out/$id.mp4; done
```

- On a machine **without a GPU**, Chromium's `angle` backend may give no WebGL2 context. Add
  `--gl=swangle` (the same ANGLE path on the SwiftShader software renderer). The previews were rendered
  that way.
- To use a local Chrome instead of Remotion's downloaded headless shell, set
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome`.
- To render a 720p preview, add `--scale=0.3333333333333333`, or run `scripts/render-previews.sh`.
- `remotion.config.ts` raises Remotion's per-frame timeout to 5 minutes. Without a GPU, painting one 4K
  brush-frame card takes longer than the 30 s default.

The textures are resolution-independent: every size is defined as a fraction of the frame height, and the
WebGL buffers are allocated at the output resolution. A 4K render has the same look as the preview, with
finer grain: above about 1000 px frame height, a pixel-scale grain octave is blended in, so the paper grain
stays fine instead of showing the noise grid.

## Tweaking (one data row each, in `src/settings.ts`)

| What | Row | Notes |
|---|---|---|
| **Flicker speed** | `export const HOLD_FRAMES: [number, number] = [2, 4];` | A card is held for 2–4 frames. Use `[3, 6]` for a slower boil, `[1, 2]` for frantic. The schedule still sums to exactly 600 frames, so the loop stays seamless. |
| **Texture density** | `export const DENSITY = { ScratchGrunge: 1, PhotocopyGrunge: 1, CharcoalGrunge: 1, BrushFrame: 1 };` | 1 = as designed, 0.5 = sparser, 1.5 = busier. Scales scratch counts, specks, charcoal marks and so on. |
| **Orange colour** | `export const ORANGE = "#E0920A";` | Background of `CharcoalGrunge_Orange`; the marks multiply onto it. |

## How it works

Everything is a pure function of `useCurrentFrame()`. There is no `Math.random()`, `Date.now()`,
`useFrame` or state driving the visuals.

- **Schedule** (`src/lib/schedule.ts`): a seeded `mulberry32` list of holds (2–4 frames) summing to
  exactly 600. Each hold has:
  - a card, cycling through a working set of four of the 12 cards, with a new card rotated in every
    5–9 holds, and never the same card twice in a row, even across the loop seam;
  - a gate weave of ±0.5% offset, ±1% scale and a tiny rotation;
  - in `ScratchGrunge` only, occasional 1–2-frame exposure jumps.

  **Persistent marks** (a long scratch, a dark streak, a stain) live for 2–3 holds and drift
  0.1–0.2% per hold.
- **Cards** (`src/engine/CardEngine.ts`): rendered on demand from their seed into a WebGL render target
  2% larger than the frame on each side, so the weave never shows an edge. Only the 4 most recently used
  cards are kept (LRU). Three engines build each card:
  - a **WebGL2 fragment shader** on a three.js plane (via `@remotion/three`): stains, haze, toner,
    dust, paper grain, smudges and rubbing (`src/looks/*.ts`, the `shader` field;
    `src/gl/noise.glsl.ts`);
  - **Canvas 2D** line work: scratches, hairlines, fold lines, fibres and flicks;
  - **p5.brush** (MIT, standalone build) for the charcoal sticks and the ink-wash frame strokes, painted
    once per card into offscreen canvases, seeded with `brush.seed()` from the look id and card index.
    The brush frame paints each group of strokes into its own layer, so the shader can make crossings
    multiply, which is darker.
- **Display pass** (`src/gl/shaders.ts`): samples the held card with the weave, adds the persistent marks,
  applies the exposure jump and maps "ink" to the clip's colours. Black versions use `ink`; white
  versions use `1 - ink`, which makes each pair an exact inverse; orange multiplies the marks onto
  `#E0920A`.
- Pairs (Black/White, White/Orange) share their seeds, so they show identical textures.

## Checks

`scripts/verify.py` (needs numpy and Pillow) runs:
- ffprobe;
- levels on 50 empty points, plus the greyscale check;
- the blend test over a colourful test image;
- the flicker / hold-length check;
- byte-for-byte determinism.

The loop check renders frames 0 and 600 with `--props='{"variant":"<file name>","loopCheck":true}'`,
which makes the composition 601 frames long.

## Timings

Measured in a 4-core cloud container with **no GPU** (SwiftShader, `--gl=swangle`, concurrency 2).
A GPU machine with `--gl=angle` will be considerably faster.

**720p previews** (1280×720, all 600 frames, wall-clock time of `remotion render` including encoding):

| Clip | Total | Per frame |
|---|---|---|
| ScratchGrunge_Black | 404 s | 673 ms |
| ScratchGrunge_White | 428 s | 713 ms |
| PhotocopyGrunge_White | 414 s | 691 ms |
| PhotocopyGrunge_Black | 408 s | 679 ms |
| CharcoalGrunge_White | 374 s | 623 ms |
| CharcoalGrunge_Orange | 357 s | 595 ms |
| BrushFrame_White | 775 s | 1292 ms |
| BrushFrame_Black | 771 s | 1285 ms |

**One 4K frame** (3840×2160, frame 300, cold `npx remotion still ... --scale=1`, so it includes starting
the browser and painting the card from scratch):

| Clip | One 4K frame | Same frame at 720p, for comparison |
|---|---|---|
| ScratchGrunge_Black | 28.5 s | 5.4 s |
| BrushFrame_White | 56.9 s | 11.0 s |

In a full render each card is painted once and reused for the 2–4 frames it is held, and only the 4 most
recent cards are kept, so most frames cost much less than a cold still. The brush frames are the slowest
because p5.brush paints four stroke layers per card.

## Licences

- p5.brush © Alejandro Campos Uribe, MIT licence.
- three.js, MIT licence.
- Remotion: see remotion.dev/license; a company licence may be required for commercial use by larger
  teams.
