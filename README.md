# Neon Stock Line

Two pieces from one project: a glowing price trend against black, with floating
price labels at varying depths. Everything is drawn to a single `<canvas>` — no
images, no video, no external assets beyond one webfont.

| composition id | the piece | palette |
| --- | --- | --- |
| `NeonStockLine` | a market climbing lower-left to upper-right | green on black |
| `NeonStockLineBear` | a market falling upper-left to lower-right | red on black |

Both are **840 frames at 30 fps** — 28.0 s, seamless loops (frame 840 is
pixel-identical to frame 0) — and both are **3840 × 2160 (4K)** natively.

The artwork is authored in a 1920 × 1080 design space and drawn through a single
scale factor, so any `--scale` is clean in either direction.

**Fonts:** Roboto Mono is fetched via `@remotion/google-fonts` on first run (no
font files to install), gated behind `delayRender()` so no frame is ever
captured before the face is usable.

## Render

```bash
npm install

npx remotion studio                          # preview and tune either composition
```

Final 4K masters:

```bash
npx remotion render NeonStockLine out/neon-stock-line.mp4 \
  --codec=h264 --crf=12 --concurrency=8

npx remotion render NeonStockLineBear out/neon-stock-bear.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

1080p from the same compositions — about a quarter the time, good for checking
the loop before a full pass:

```bash
npx remotion render NeonStockLine out/neon-stock-1080p.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

npx remotion render NeonStockLineBear out/neon-stock-bear-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--scale` changes only the output resolution; the composition is untouched.
Because stroke weights, font sizes and bloom radii all live in the 1920 × 1080
design space and are multiplied by `compositionWidth / 1920`, the 4K render is
the 1080p artwork at exactly 2× — the hot core stroke does not thin out. If you
ever want a line heavier or lighter, change the three stroke widths in
`mainPasses` / `maPasses` in `src/lib/draw.ts` rather than re-authoring.

`--concurrency` may not exceed your CPU core count; lower it if Remotion
complains.

## Offline / restricted networks

If the render machine cannot reach `fonts.gstatic.com` (no outbound network, or
a TLS-intercepting proxy the browser does not trust), set:

```bash
REMOTION_OFFLINE_FONTS=1 npx remotion render NeonStockLine out/neon-stock-line.mp4 --codec=h264 --crf=12
```

That loads the identical Roboto Mono woff2 that ships in `public/fonts/` instead
of fetching it. Same file, same glyphs, same pixels.

## How it holds together

| file | what it does |
| --- | --- |
| `src/Root.tsx` | registers both compositions |
| `src/NeonStockLine.tsx` | the component, shared by both; draws once per React render, no rAF |
| `src/lib/variants.ts` | **everything that differs between the two pieces** |
| `src/lib/series.ts` | the tiling price series and its moving average |
| `src/lib/labels.ts` | the depth-sorted label field and the bokeh |
| `src/lib/draw.ts` | camera, three-pass neon stroke, bloom, vignette, grain |
| `src/lib/text.ts` | label tiles baked once to offscreen canvases |
| `src/lib/grain.ts` | seeded noise tiles |
| `src/lib/font.ts` | the gated webfont load |

`variants.ts` is the whole difference between the two pieces: a palette, a bag
of numbers (tilt, camera direction, glow alpha, bloom radii, run lengths, trend
bias) and a description of what punctuates each price series. The component, the
composition size, the design space, the stroke weights, the label sizing, the
bokeh, the motion blur, the vignette and the grain density are shared.

`tileRise` is signed: positive climbs, negative falls, and the camera takes its
vertical direction from the same number — so a bear market is a different set of
numbers rather than a different code path.

Every value comes from Remotion's `random()` with a stable string seed and every
motion is a pure function of `useCurrentFrame()`, so renders are deterministic
and repeatable. Each series and each label tile is built once and reused on every
frame.
