# Cyber-alert spot — "SYSTEM HACKED" / "PHISHING ATTACK"

A 20.000s (600 frame @ 30fps) 16:9 motion graphic: a wall of red binary code
lit from above, a crimson alert plate, CRT scanlines and intermittent
digital-glitch bursts.

## Compositions

| id | size | headline |
|---|---|---|
| `SystemHacked-1080p`    | 1920 × 1080 | SYSTEM HACKED   |
| `SystemHacked-4K`       | 3840 × 2160 | SYSTEM HACKED   |
| `PhishingAttack-1080p`  | 1920 × 1080 | PHISHING ATTACK |
| `PhishingAttack-4K`     | 3840 × 2160 | PHISHING ATTACK |

All four are the same component. The headline is a prop, and the 4K entries
are not upscales — see *Resolution independence* below.

## Rendering

```console
npx remotion render SystemHacked-4K out/system-hacked-4k.mp4 \
  --gl=angle --codec=h264 --crf=18 --muted
```

`--gl=angle` is required on machines without a real GPU: it routes WebGL
through ANGLE/SwiftShader so the three.js pass renders in headless Chrome.
On a workstation with a GPU you can drop the flag.

`--muted` keeps the MP4 free of the silent AAC track Remotion would otherwise
add, which is what you want when the sound design is added downstream.

Expect H.264 files to be large for their length. The picture is
high-frequency noise by design, which is the worst case for inter-frame
prediction; that is a property of the content, not of the settings.

## Structure

| file | role |
|---|---|
| `constants.ts`       | Timing, geometry and palette — all as *fractions* of the frame |
| `glitch.ts`          | The glitch model: a pure function of frame number |
| `shader.ts`          | GLSL for the binary-digit field, light, vignette and scanlines |
| `DataFieldCanvas.tsx`| three.js host for the shader pass |
| `AlertBanner.tsx`    | The red plate and headline, plus their chroma split and tearing |
| `ScreenOverlay.tsx`  | Frame-wide scanlines, tear bars and corner falloff |
| `SystemAlert.tsx`    | Composes the three layers |

## Four things worth knowing before editing

**The background is binary digits, not noise.** At the size the reference
clip ships at, its background looks like a mosaic of small blocks and
dashes, and the first version of this shader built exactly that. Zooming
into the source shows what it really is: a dense wall of legible 0s and 1s
in regular rows, roughly 165 digits to a frame width, blurring together at
small sizes. `dataField()` draws real digits from two primitives — a ring
and a stroke — so they hold up at 4K instead of being a blur that only
works small. Building it as the apparent mosaic was wrong twice over: it
missed the digits, and it had nothing to resolve into at higher resolution.


**Resolution independence.** Nothing in this piece is expressed in pixels.
Banner size, type size, mosaic cell size, scanline count, blur radius and
glow falloff are all fractions of the composition's width or height, so
`SystemHacked-4K` renders the *same design* against a larger canvas rather
than a scaled-up copy of the 1080p one. Measured across both renders, the
banner occupies 41.88% of frame width in each and the frame's mean luminance
differs by 0.1/255. If you add anything, express it the same way or the two
sizes will drift apart.

**Determinism.** Remotion renders frames out of order across parallel
workers, so every time-varying value must be a pure function of the frame
number. There is no `Math.random()`, no `Date.now()` and no mutable module
state anywhere in here.

The per-frame hash in `glitch.ts` is a murmur3 finaliser rather than a seeded
PRNG, and that is deliberate. Seeding a small PRNG from `index * k` feeds it
an arithmetic progression; mulberry32's single round leaves enough lattice
structure that the strongest bursts all landed on frames 36, 72, 108 and 144
— a metronomic 1.2s beat. A full avalanche mix has no correlation between
neighbouring indices.

**The light is a light, not a layer.** In `shader.ts` the vignette and the
vertical shaping apply to the field only; the glow is added afterwards and
*suppresses* the field it falls on (`col *= 1.0 - 0.55 * glow`). Compositing
a glow over a finished field instead makes the lit cells spike to 232/255
where the reference tops out at 165 — bright light washes local detail out,
it does not stack with it.

## Tuning

The compositions take props, so the common adjustments need no code change —
edit them in the Remotion Studio sidebar, or pass `--props` on the CLI:

| prop | default | what it does |
|---|---|---|
| `headline`      | `SYSTEM HACKED` | the copy on the plate |
| `columns`       | `165`    | binary-digit columns across the frame; lower = larger digits |
| `textBlurFrac`  | `0.0016` | headline softness, as a fraction of frame height; `0` is crisp |

```console
npx remotion render SystemHacked-1080p out/sharper.mp4 \
  --gl=angle --codec=h264 --crf=18 --muted \
  --props='{"headline":"SYSTEM HACKED","columns":165,"textBlurFrac":0.0008}'
```

`textBlurFrac` is a fraction of frame height rather than a pixel radius, so
1080p and 4K land on the same apparent focus instead of 4K coming out twice
as sharp. Glitch bursts scale it up on top of the base value, so the screen
loses focus as it fails rather than sitting at one fixed softness.

## Type

The headline is set in Liberation Sans Bold, which is metrically identical to
Arial/Helvetica Bold and is SIL Open Font Licensed, so it ships in
`public/fonts/` (alongside `LiberationSans-Bold.LICENSE.txt`, which the OFL
requires to travel with it) rather than being resolved from system fonts. Cap height is
5.73% of frame height; the font size is derived from that through Arial
Bold's 0.716 cap-height ratio instead of being chosen directly.

The `scaleX(0.912)` on the headline is not an arbitrary squeeze. The
reference sets 36.3% of frame width at a 5.9% cap height, and Arial Bold's
own proportions run ~9% wider than that at the same cap height, so the
reference is using a condensed cut. Compressing horizontally holds both
measurements; dropping the font size would have matched the width but lost
the cap height.
