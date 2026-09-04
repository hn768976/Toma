# Data Breach Flythrough

A slow flight through layered planes of hex data in dark space, past large red
open padlocks and the category names of the records they were guarding. Two
colour treatments, both 3840x2160, 30fps, 360 frames (12s), seamlessly looping.

| Composition ID             | Look                                            |
| -------------------------- | ----------------------------------------------- |
| `V1-BreachFlythroughCyan`  | Cyan data, white labels, red padlocks           |
| `V2-BreachFlythroughAmber` | Amber data, warm white labels, red padlocks     |

## Running it

```bash
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are defined at 3840x2160, so `--scale=1` is a true 4K render:

```bash
npx remotion render V1-BreachFlythroughCyan out/V1_BreachFlythroughCyan.mp4 --scale=1 --crf=16
npx remotion render V2-BreachFlythroughAmber out/V2_BreachFlythroughAmber.mp4 --scale=1 --crf=16
```

Codec, pixel format and CRF are already set in `remotion.config.ts`
(h264 / yuv420p / crf 16, muted — a silent audio track would push the container
past an exact 12.000s and put a hitch in the loop), and frames are handed to
the encoder as PNG — the
scene is one large very dark falloff and lossy intermediate frames put visible
blocking into it before the encoder ever sees it. Check the encoded file rather
than the studio preview when judging banding.

A 1080p preview is the same render at half scale:

```bash
npx remotion render V1-BreachFlythroughCyan out/V1_BreachFlythroughCyan.mp4 --scale=0.5 --crf=16
```

Stills:

```bash
npx remotion still V1-BreachFlythroughCyan out/V1_BreachFlythroughCyan.png --frame=320 --scale=0.5
```

## How it is built

Everything is a flat billboard in CSS 3D space — no 3D engine. Text blocks,
padlock icons and labels are absolutely positioned DOM layers inside a
`perspective` container, each parked at its own `translateZ`, so the text stays
real text and the parallax comes for free.

- `src/depth.ts` — the depth model. A layer's Z is computed directly from the
  frame and wrapped over one cycle, rather than a camera being moved, so a
  plane that passes the camera reappears at the back with nothing carried
  between frames. Travel over `durationInFrames` is exactly one cycle, which
  puts every layer back where it started; that is what makes the loop seamless.
  Also holds the depth-of-field maths and the camera drift.
- `src/scene.ts` — the contents of the eight planes, built once at module level
  from a seeded PRNG. Layer roles are hand-assigned so the mix stays right at
  every point in the cycle: four breached records spread through the depth, and
  the two secured ones half a stack apart so one is always in frame.
- `src/components/` — padlocks (inline SVG), hex blocks, the per-layer
  transform and blur, grain and vignette.
- `src/load-fonts.ts` — JetBrains Mono and Barlow Semi Condensed ship with the
  project in `public/fonts`. A substituted font would change every glyph advance
  and shift the layout enough to break the loop.

### Depth of field

Only a narrow slab of Z is sharp; the blur is recomputed every frame from each
plane's distance to that slab, so elements sharpen as they approach focus and
soften as they pass. CSS filters run in the element's own coordinate space and
the 3D transform then scales the result, so the on-screen radius is
`local * perspectiveScale`. Working back from a thin-lens circle of confusion
gives a local radius that is linear in the distance from the focal plane, with
a gentler coefficient behind the plane than in front of it — deep grids stay
legible as texture while the layers about to pass the camera smear out.

Because every size, distance and blur radius is derived from
`useVideoConfig().width` (always 3840, whatever `--scale` is) and `--scale`
only changes the device pixel ratio, the 1080p preview and the 4K render are
the same picture at different pixel counts.

## Content

Category names only. No real, invented or implied personal data of any kind —
the "records" are random hex tokens and `xxxx` placeholders.
