# cyber-alert

A looping 4K (3840×2160, 16:9) cyber-alert animation: a glitching neon warning
triangle over layered data rain, drifting bokeh and a crimson edge bleed.

Two ways to consume it, both driven by the **same renderer**:

| | |
|---|---|
| `dist/cyber-alert.html` | a single self-contained HTML file — `<canvas>` + `requestAnimationFrame`, no assets, no network, no dependencies. Open it in a browser and it plays. |
| Remotion | the same renderer mounted in a Remotion composition, so the loop can be exported to MP4 / ProRes / a PNG sequence. |

`src/engine/cyber-alert.js` is the single source of truth. The HTML file is
generated from it by `scripts/build-html.mjs`, which inlines the engine into a
page template — so the browser page and the exported video are pixel-identical.

## Export

```bash
npm install
npm run render            # 3840x2160 h264 mp4  -> out/cyber-alert-4k.mp4
npm run render:preview    # 1920x1080 h264 mp4  -> out/cyber-alert-1080.mp4
npm run render:prores     # 3840x2160 ProRes HQ -> out/cyber-alert-4k.mov
npm run render:frames     # 3840x2160 PNG seq   -> out/frames/
npm run studio            # Remotion Studio (scrub the timeline)
```

Rendering needs a `chrome-headless-shell` build. Remotion downloads one on
first use; to reuse a Chromium already on the machine, point
`REMOTION_BROWSER_EXECUTABLE` (or `CHROME_PATH`) at it — see
`remotion.config.ts`.

## Rebuild the HTML file

```bash
npm run build:html        # src/engine/cyber-alert.js -> dist/cyber-alert.html
```

## How the loop is made seamless

The renderer is a **pure function of the frame index** — `drawFrame(ctx, scene,
frame)`. Nothing accumulates between frames, so frame *N* always paints the
same pixels regardless of what was drawn before it. That is what lets Remotion
seek frames in any order, and it is what makes the 10.0s loop closed rather
than approximately closed:

- **Data rain** — each column is pre-rendered once into a vertical strip whose
  height is *exactly* the distance that column travels in 10s (the speed is
  quantised to a whole number of glyph rows per loop). Per frame the strip is
  tiled at `stripH × t/10`, so at t = 10.0 it lands back on t = 0 exactly, with
  no floating-point residue — and each column costs 2–4 `drawImage` calls
  instead of ~70 `fillText` calls.
- **Bokeh** — vertical travel is a phase in `[0,1)` over the loop; sideways
  motion is a sinusoid whose period divides 10s, plus an optional whole-lap
  horizontal wrap.
- **Pulse** — a 2.5s sine, i.e. exactly 4 cycles per loop.
- **Glitch schedule** — seeded once at scene build; bursts are laid down until
  one would cross the loop boundary, so no burst is ever cut in half.
- **Stroke jitter / tremor** — resampled on frame blocks of 3 and 4 frames;
  600 is divisible by both, so block 0 recurs at the seam.

## Layers

1. `#0A0E1A` base with broad crimson (`#5A0A14`) vignettes bleeding in from the
   left and right edges, stretched vertically so they are brightest across
   mid-height and the centre stays dark.
2. **Data rain** — 150 far columns of monospace `1`/`0`, glyphs 18–40px,
   opacity 8–45%, falling 60–260 px/sec, in cool cyan `#4A9FD4` and dim slate
   `#3A4257`. Column x is rejection-sampled against a centre-suppressing
   density curve, so the left and right thirds are dense and the middle is
   sparse enough for the icon to read.
3. **Buried detail** — faint red glyph clusters and small padlock / shield
   outlines at 5–15% opacity.
4. **Near plane** — 26 more columns, larger (34–54px), faster (190–300 px/sec)
   and softer; the defocus is baked into the strip sprite at build time, so it
   costs nothing per frame.
5. **Bokeh** — ~35 soft cyan `#5AC8F5` / red `#E03040` circles, radius 8–40px,
   drifting up and sideways, plus a few sharp small cyan dots for contrast.
   Composited additively.
6. **The icon** — an equilateral, rounded-corner warning triangle at 45% of
   frame height, outline only, with an outline exclamation mark inside. Drawn
   as white-hot core (`#FFF0F0`, 4px) inside saturated red (`#FF1A25`, 10px),
   wrapped in additive bloom passes that spill onto the background. Glow
   brightness breathes between 85% and 115% on a 2.5s sine; the geometry never
   scales.
7. **Glitch** — see below.

## Glitch treatment

The triangle's stroke is never clean. Each path is resampled to uniform arc
length and then sliced into runs separated by micro-breaks, every run carrying
its own jitter, thickness multiplier and alpha. The layout is redistributed
every 3 frames, so the stroke crawls instead of boiling.

Every 0.8–2.0s a burst fires for 2–5 frames only:

- 3–6 horizontal slices (10–60px tall) displaced sideways by 20–120px, with
  the off-edge remainder wrapped back in
- RGB channel split on the icon — red pulled 8px left, cyan pushed 8px right
- solid black and solid red bars, 4–20px tall and 60–300px wide, at random
  positions
- an overall opacity dip on the icon to ~60%

Between bursts a constant ±2px tremor on the icon is resampled every 4 frames.

## Notes

- All dimensions are authored in 4K pixels and multiplied by `s = height/2160`,
  so the identical scene renders correctly at the 1080p preview size.
- The HTML page locks the backing store to 3840×2160 and derives its CSS box
  from the viewport, snapping to whole device pixels via `devicePixelRatio`.
  Motion is time-based off the wall clock and quantised to 60fps, so the loop
  keeps real time on displays that are not 60Hz.
- `scripts/check.mjs` is a dev-only harness: it loads the built HTML, drives
  the engine through Chromium, asserts determinism and loop closure, and writes
  contact sheets to `out/check/`.
