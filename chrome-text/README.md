# chrome-text — 4K neon chrome text

Three 4K, seamlessly looping "neon chrome text" animations, drawn entirely on a
2D canvas. No 3D, no Three.js, no WebGL.

| Composition | Word | Palette | Cap height |
|---|---|---|---|
| `ChromeWelcome` | WELCOME | blue and magenta | 16% of frame height |
| `ChromeThanks` | THANK YOU | gold and amber | 14% of frame height |
| `ChromeSubscribe` | SUBSCRIBE | red and crimson | 15% of frame height |

All three are 3840x2160, 300 frames at 30 fps (10.0 s), and loop: frame 0 and
frame 300 are pixel-identical.

The three versions differ **only** in the word, its cap height and the palette.
Every component, gradient band position and timing is shared, and all three
differences live in one place, `src/variants.ts`.

## Render

```bash
npm install

# 4K
npx remotion render ChromeWelcome   out/chrome-welcome.mp4   --codec=h264 --crf=12 --concurrency=8
npx remotion render ChromeThanks    out/chrome-thanks.mp4    --codec=h264 --crf=12 --concurrency=8
npx remotion render ChromeSubscribe out/chrome-subscribe.mp4 --codec=h264 --crf=12 --concurrency=8

# 1080p preview
npx remotion render ChromeWelcome out/chrome-welcome-preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

Lower `--concurrency` if the machine has fewer cores than that; Remotion
refuses a value above the available core count.

```bash
npm run dev     # Remotion studio
npm run lint    # tsc
```

## Construction

Every layer draws to its own `<canvas>` once per React render, and every
quantity is a pure function of `useCurrentFrame()` — no `Date.now()`, no
`requestAnimationFrame`, no CSS animation, no component state. Randomness comes
from Remotion's seeded `random()`, so renders are deterministic and frames can
be produced out of order across worker processes.

Back to front:

1. **Glow pools** (`src/components/GlowPool.tsx`) — overlapping radial
   gradients in the palette's accent hues, computed at 1/8 resolution and
   upscaled. They drift on closed paths, so the colour behind each letter
   changes across the loop.
2. **Reflection bed** (`src/components/ReflectionBed.tsx`) — a mirrored,
   blurred, downward-fading copy of the word. Without it the word floats.
3. **The word** (`src/lib/ChromeText.tsx`) — see below.
4. **Spark field** (`src/components/SparkField.tsx`) — ~180 drifting,
   twinkling points, denser near the word.
5. **Finish** (`src/components/FinishPass.tsx`) — a strong vignette, then fine
   film grain on an `overlay` layer.

### The letterforms

The letter face is a five-band vertical gradient with one **hard horizontal
boundary** at the optical centre. That single hard edge among soft, unevenly
spaced bands is the horizon a reflective surface shows, and it is what makes
the word read as polished metal rather than as coloured text. A vertical
highlight brighter than any base band sweeps across the word, clipped to the
glyphs; directional rims (bright top and left, dark bottom and right) give the
letters thickness; and the outer glow is tinted by whichever light pool sits
behind it.

Canvas 2D has no text-to-path API, so the letterform "path" is a mask canvas
built once and reused every frame as a clip region via `destination-in`. The
per-frame cost is two gradient fills, not text layout.

### Timing

The loop period is 300 frames. The highlight makes exactly 2 traversals, the
glow breathes exactly 2 times at +/- 8%, and every drift path — the pools, the
sparks, the +/- 6px ambient drift of the picture — is a closed Lissajous figure
with integer frequencies.

### Fonts

Archivo Black, identified through `@remotion/google-fonts` but with its woff2
files vendored into `public/fonts` and registered via `FontFace` behind a
`delayRender()` gate. The whole layout is derived from measured font metrics,
so no frame may be captured before the face is available — and a render that
reaches the network is a render that can stall behind a proxy.

## Shared library

`src/lib/` is a vendored copy of `~/projects/remotion-lib`, kept byte-identical
so the project stays standalone and zippable. See that repository's
`CATALOG.md`.
