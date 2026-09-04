# Macro Code Screen / Shallow Focus

Three versions of an extreme close-up of code on a monitor: the screen plane is
angled away from the camera, most of the frame is defocused, and the code drifts
slowly upward on a seamless twelve-second loop.

| Composition id       | Look                                  | Language   |
| -------------------- | ------------------------------------- | ---------- |
| `V1-MacroCodeBlue`   | Cool blue, the reference match        | Python     |
| `V2-MacroCodeAmber`  | Warm amber with teal accents          | TypeScript |
| `V3-MacroCodeGreen`  | Phosphor green on near-black, high contrast | Rust  |

All three are defined at **3840x2160, 30fps, 360 frames (12s)**.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

One command per composition. `--scale=1` is the composition's native 3840x2160.

```bash
npx remotion render V1-MacroCodeBlue  out/V1_MacroCodeBlue.mp4  --scale=1 --crf=16
npx remotion render V2-MacroCodeAmber out/V2_MacroCodeAmber.mp4 --scale=1 --crf=16
npx remotion render V3-MacroCodeGreen out/V3_MacroCodeGreen.mp4 --scale=1 --crf=16
```

Stills:

```bash
npx remotion still V1-MacroCodeBlue out/V1_MacroCodeBlue.png --frame=90 --scale=1
```

The 1080p previews shipped alongside this project were rendered with
`--scale=0.5`. `--scale` changes the browser's device pixel ratio and leaves the
CSS layout at 3840x2160, so a preview and a 4K render are the same picture at
two resolutions -- every size, blur radius and offset in the source is derived
from `useVideoConfig()`, never hard-coded in pixels.

Codec settings (`h264`, `yuv420p`, `crf 16`) live in `remotion.config.ts`, so
they apply to every render without repeating the flags.

## How it works

**The screen is a CSS 3D transform, not a 3D scene.** Each code surface is a
flat HTML panel under `perspective` + `rotateY(27deg) rotateX(4deg)`, so the
glyphs stay real DOM text all the way to the compositor. That is what keeps the
in-focus band looking photographic; rendering text into a texture would lose
exactly the crispness the shot is built on.

**Depth of field is the product.** The focal surface is drawn seven times, each
copy blurred by a different radius and masked to a vertical band of the frame:
heavy on the near (left) edge, falling fast to a sharp band across the middle
third, then climbing again more gently toward the far (right) edge. The bands
are painted far-to-near and each one fades out only on its right-hand side, so
neighbouring slices cross-fade at full opacity instead of stacking two
half-transparent copies. A smooth gradient blur reads as a Photoshop filter;
discrete slices that overlap read as optics.

Each slice clips its own blur source to its band plus a margin of three blur
radii, so seven blurred copies cost barely more than one, and no transparent
edge ever bleeds into the visible part of a band.

**Two further surfaces** sit behind and to the left at steeper angles under a
heavy uniform blur. They are what fills the gaps between panes with soft
coloured blocks.

### The loop

`durationInFrames` is 360 and every animated value is periodic over exactly that
span:

- Each surface scrolls by a whole number of **its own** line heights, and its
  content tiles with that same period. Row `r` shows
  `lines[(floor(scroll) + r) % lines.length]`, so when `scroll` reaches
  `lines.length` the surface is pixel-identical to frame 0. The three surfaces
  have different line heights, so they drift at visibly different rates.
- The camera float, the flare breath and the corner veil are all `sin`/`cos` of
  `2 * PI * frame / durationInFrames`, with the flare on its own beat so nothing
  appears to pulse in time with anything else.
- Line height is set explicitly in pixels rather than left to the font's own
  metrics, and the monospace face is embedded in `public/fonts` rather than
  taken from a system stack -- a substituted font would change the line height
  and break the integer-line scroll.

## Layout

```
src/
  Root.tsx           three compositions, one per palette
  MacroCode.tsx      the scene: surfaces, depth slices, flare, cast, grain
  CodePlane.tsx      one 3D-transformed code surface
  palettes.ts        the three colour treatments
  fonts.ts           embedded monospace face
  code/
    sources.ts       the source listings, tokenised once at module load
    tokenize.ts      a small dependency-free lexer
public/fonts/        JetBrains Mono (SIL Open Font License 1.1)
```

Syntax highlighting is computed once when the module loads, never per frame.

## Notes

`remotion.config.ts` pins the Chromium renderer to `angle`. The seven blurred
slices are compositing-heavy and ANGLE is meaningfully faster than the software
path; drop the line if you are rendering somewhere without a usable GPU stack
and would rather let Remotion pick the per-platform default.

The embedded face is JetBrains Mono, under the SIL Open Font License 1.1 --
see `public/fonts/JetBrainsMono-LICENSE.txt`.
