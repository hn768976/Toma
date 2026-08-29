# Access Denied / Access Granted — 4K terminal alert

Two versions of a 4K "terminal alert" animation, built in Remotion as a single
2D canvas composition driven by one variant table. No 3D, no Three.js, no audio,
no real logos and no real text — every line on screen is invented for this piece.

| | `AccessDenied` | `AccessGranted` |
| --- | --- | --- |
| Resolution | 3840 × 2160 | 3840 × 2160 |
| Duration | 300 frames @ 30 fps (10.0 s) | 300 frames @ 30 fps (10.0 s) |
| Palette | red | green, darker and less saturated |
| Banner | `ACCESS DENIED` | `ACCESS GRANTED` |
| Instability | holds 0.65–1.0, no arc | 1.0 → 0.0, then a confirmation pulse |
| Loops | **yes** — frame 0 and frame 300 are pixel-identical | **no** — one-shot resolution, by design |

## Running it

```bash
npm install
npm run dev                    # Remotion studio
```

1080p previews (half scale, same framing):

```bash
npx remotion render AccessDenied  out/access-denied-preview.mp4  --codec=h264 --crf=18 --scale=0.5
npx remotion render AccessGranted out/access-granted-preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

Full 4K:

```bash
npx remotion render AccessDenied  out/access-denied.mp4  --codec=h264 --crf=12 --concurrency=8
npx remotion render AccessGranted out/access-granted.mp4 --codec=h264 --crf=12 --concurrency=8
```

`--concurrency` must not exceed the number of CPU cores available.

## Deliverable zips

```bash
npm run zips
```

Writes `deliverables/access-denied.zip` and `deliverables/access-granted.zip`. Each is
a self-contained, independently runnable Remotion project containing only its own
version: its `Root.tsx` registers one composition and its `src/variants.ts` holds
that variant's data inlined, rather than importing a shared two-key object.
`node_modules/`, `out/` and `.git/` are excluded.

## Layout

```
src/
  variants.ts          the one place a colour, a banner string or a curve is written down
  TerminalAlert.tsx    builds the per-frame stage and mounts the five layers in order
  stage.ts             what a layer is handed for one frame
  fonts.ts             @remotion/google-fonts, pointed at the vendored woff2 files
  components/
    TextLayer.tsx      layer 1 — the scrolling terminal page
    ColourWash.tsx     layer 2 — the flood, its striations and streaks
    Banner.tsx         layer 3 — the bar, the italic caps, the chromatic fringe
    TearPass.tsx       layer 4 — slice displacement, channel splits, drops, echoes
    ScanlinePass.tsx   the finish — scanlines, vignette, grain
  lib/
    constants.ts       composition geometry
    terminal-text.ts   the invented BBS-dump content and the garbler
    buffers.ts         the offscreen text page, wash texture and scanline tile
    glitch.ts          tear and corruption timelines
    draw.ts            canvas helpers, seeded pickers, channel isolation, grain tiles
```

### One curve drives everything

`variants.ts` exports a single `VARIANTS` object keyed by `"denied" | "granted"`,
holding each version's palette, banner text, glitch profile, text-layer behaviour
and **instability curve** — a function of frame returning 0–1. Tear frequency,
slice count, slice displacement, chromatic offset, wash opacity, striation
strength and banner jitter are all scaled from that one value. There is no glitch
schedule hardcoded anywhere; version 2 is version 1 with the curve inverted.

### Determinism and the loop

Every frame is a pure function of `useCurrentFrame()`. No `Date.now()`, no
`requestAnimationFrame`, no CSS animation, no state that survives a frame; all
randomness comes from Remotion's seeded `random()` with stable string seeds.

For `AccessDenied` the loop is closed by construction and verified by render:
the text block is exactly one frame tall and scrolls by `(frame / 300) × blockHeight`;
every oscillation period in the instability curve divides evenly into 300; every
tear and jitter schedule is keyed on `frame % 300`; and the tear walk is bounded
to frames 3–296 so no event straddles the loop point. Rendering frame 0 and frame
300 produces byte-identical PNGs.

`AccessGranted` is deliberately not a loop — it opens as unstable as the denied
cut and resolves to a clean, still frame.

### Performance

The terminal page is laid out once into an offscreen canvas and blitted with a
translation each frame; so are the wash texture, the scanline tile and the grain
field. Tears copy slices of the already-composited buffer with `drawImage` rather
than re-rendering content per slice.

## Fonts

Roboto Mono (400/700) and Roboto Italic 900 are loaded through
`@remotion/google-fonts`, gated with `delayRender()`/`continueRender()`. The
woff2 files are vendored into `public/fonts/` and the font metadata is pointed at
them, so a render never touches the network and is reproducible on any machine.
