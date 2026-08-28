# Neon shield HUD

Three versions of one 4K looping HUD animation, built from a single engine
and one variant table.

| Composition | Version | Glyph | Panels | Sweep |
| --- | --- | --- | --- | --- |
| `ShieldHudBlue` | v1 "blue" | shield, solid | medium, steady | smooth, 2 circuits |
| `ShieldHudGreen` | v2 "green" | guard shield + inner keyhole, solid | high, active | smooth, 3 circuits |
| `ShieldHudBreach` | v3 "breach" | shield, fractured | high, failing | stutter, 2 circuits |

All three are 3840x2160, 330 frames at 30fps (11.0s), and loop seamlessly.

## Previews

```bash
npx remotion render ShieldHudBlue   out/shield-blue-preview.mp4   --codec=h264 --crf=18 --scale=0.5
npx remotion render ShieldHudGreen  out/shield-green-preview.mp4  --codec=h264 --crf=18 --scale=0.5
npx remotion render ShieldHudBreach out/shield-breach-preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

Drop `--scale=0.5` for the full 4K render.

## How it works

Everything is drawn to one 3840x2160 canvas through a ref, once per React
render. There is no requestAnimationFrame, no component state and no CSS
animation: every value is a pure function of `useCurrentFrame()`, and all
randomness comes from Remotion's `random()` with stable string seeds, so
`npx remotion render` is deterministic.

- **The plane.** One affine transform, applied with `ctx.setTransform()`:
  rotate -12 degrees, shear the right side up, compress vertically. Every
  element — the centre glyph included — sits on it.
- **The glyph.** An outline only, stroked in four passes composited with
  `lighter`: a very wide atmospheric glow, an outer glow, the palette's mid
  channel, and a thin near-white core. Brightness runs uneven along the path:
  a dash-based band per step of the trail, decaying from the head over 40% of
  the outline.
- **Depth of field.** Elements draw into three depth buffers (far, mid, near)
  plus one for the accent bars. Each buffer is blurred exactly once, when it
  is composited — per-element blurring at 4K is not affordable. The glyph
  keeps its own full-resolution buffer and is the only sharp thing in frame.
- **Ordering.** `ShieldHud` clears the buffers in its render pass; each
  element draws in its own layout effect; `ShieldHud`'s layout effect runs
  last and composites. That is the only ordering React's effect phase
  guarantees.

## Verifying the loop

Frame 330 must be pixel-identical to frame 0. Register a temporary
composition with `durationInFrames={331}` and compare the two stills:

```bash
npx remotion still ShieldHudLoopCheck /tmp/f0.png   --frame=0   --props='{"variant":"blue"}'
npx remotion still ShieldHudLoopCheck /tmp/f330.png --frame=330 --props='{"variant":"blue"}'
md5sum /tmp/f0.png /tmp/f330.png
```

All three versions have been checked this way and match byte for byte. The
sweep completes a whole number of circuits, and every reroll, drift, glitch
and grain offset derives from `frame % 330`.

## Standalone packages

```bash
node tools/build-shield-hud-packages.mjs
```

Writes `packages/shield-hud-{blue,green,breach}/` and a zip of each: three
self-contained Remotion projects, one version apiece, carrying only that
version's data.
