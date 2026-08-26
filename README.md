# Neon Stock Line

A glowing green price trend climbing across black, with floating price labels at
varying depths. Everything is drawn to a single `<canvas>` — no images, no
video, no external assets beyond one webfont.

- **Composition id:** `NeonStockLine`
- **Duration:** 840 frames at **30 fps** — 28.0 s, a seamless loop (frame 840 is
  pixel-identical to frame 0)
- **Native size:** 3840 × 2160 (4K). The artwork is authored in a 1920 × 1080
  design space and drawn through a single scale factor, so any `--scale` is
  clean in either direction.
- **Fonts:** Roboto Mono is fetched via `@remotion/google-fonts` on first run
  (no font files to install), gated behind `delayRender()` so no frame is ever
  captured before the face is usable.

## Render

```bash
npm install

npx remotion studio                          # preview and tune
```

Final 4K master:

```bash
npx remotion render NeonStockLine out/neon-stock-line.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

1080p from the same composition:

```bash
npx remotion render NeonStockLine out/neon-stock-1080p.mp4 \
  --codec=h264 --crf=12 --concurrency=8 --scale=0.5
```

`--scale` changes only the output resolution; the composition is untouched.
Because stroke weights, font sizes and bloom radii all live in the 1920 × 1080
design space and are multiplied by `compositionWidth / 1920`, the 4K render is
the 1080p artwork at exactly 2× — the hot core stroke does not thin out. If you
ever want the line heavier or lighter, change the three stroke widths in
`MAIN_PASSES` / `MA_PASSES` in `src/lib/draw.ts` rather than re-authoring.

`--concurrency` may not exceed your CPU core count; lower it if Remotion
complains.

## Offline / restricted networks

If the render machine cannot reach `fonts.gstatic.com` (no outbound network, or
a TLS-intercepting proxy the browser does not trust), set:

```bash
REMOTION_OFFLINE_FONTS=1 npx remotion render NeonStockLine out/neon-stock-line.mp4 --codec=h264 --crf=12
```

That loads the identical Roboto Mono woff2 that ships in
`public/fonts/` instead of fetching it. Same file, same glyphs, same pixels.

## How it holds together

| file | what it does |
| --- | --- |
| `src/Root.tsx` | registers the composition |
| `src/NeonStockLine.tsx` | the component; draws once per React render, no rAF |
| `src/lib/series.ts` | the tiling price series and its moving average |
| `src/lib/labels.ts` | the depth-sorted label field and the bokeh |
| `src/lib/draw.ts` | camera, three-pass neon stroke, bloom, vignette, grain |
| `src/lib/text.ts` | label tiles baked once to offscreen canvases |
| `src/lib/grain.ts` | seeded noise tiles |
| `src/lib/font.ts` | the gated webfont load |

Every value comes from Remotion's `random()` with a stable string seed and every
motion is a pure function of `useCurrentFrame()`, so renders are deterministic
and repeatable. The price series and the label tiles are built once and reused
on every frame.
