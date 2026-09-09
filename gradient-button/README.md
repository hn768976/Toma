# Gradient Border Button

A dark (or light) rounded pill on a plain field, with a gradient light chasing
continuously around its border. **The centre is intentionally empty** — this is
a placeholder element, meant to have your own logo, title or call-to-action
dropped into the middle. Nothing is drawn inside the pill, the interior fill is
kept deliberately even so text is legible anywhere within it, and the pill has
generous internal padding relative to its height.

## Versions

| Composition id                | Description                                                 |
| ----------------------------- | ----------------------------------------------------------- |
| `V1-GradientButtonSpectrum`   | Dark pill on black, full spectrum border (reference match).  |
| `V2-GradientButtonCyan`       | Dark pill on black, cyan-to-blue only. For where the rainbow is too playful. |
| `V3-GradientButtonLight`      | White pill on a pale ground, same spectrum border.           |

All three are **3840×2160, 30 fps, 600 frames (20s)** and loop seamlessly.

## Rendering at 4K

Compositions are defined at 3840×2160. Every size in the component is a
fraction of the frame (via `useVideoConfig()`), so a scaled preview and a full
4K render are the same picture.

```bash
npm install

npx remotion render V1-GradientButtonSpectrum out/V1_GradientButtonSpectrum.mp4 --scale=1 --crf=15
npx remotion render V2-GradientButtonCyan     out/V2_GradientButtonCyan.mp4     --scale=1 --crf=15
npx remotion render V3-GradientButtonLight    out/V3_GradientButtonLight.mp4    --scale=1 --crf=15
```

Stills:

```bash
npx remotion still V1-GradientButtonSpectrum out/V1_GradientButtonSpectrum.png --frame=120 --scale=1
```

1080p previews are the same commands with `--scale=0.5`.

Open the studio to scrub and adjust:

```bash
npx remotion studio
```

## How the animation is built

Two separate things, which is the whole effect:

- **Fixed hue positions.** The colour sequence is pinned to the *shape* —
  magenta at the upper left, violet along the top, blue at the upper right,
  cyan at the lower right, green along the bottom, yellow at the lower left,
  easing back to magenta. These never rotate.
- **A travelling highlight.** A soft brightness envelope circuits the perimeter
  at constant speed, brightening whatever hue it currently sits over. Away from
  it the border falls off in both saturation and brightness, so part of the
  border is always dimmer than the rest.

Building it instead as one rotating rainbow would make the colours spin, which
is not what the reference does.

The border is drawn as several hundred short coloured segments sampled
analytically along the pill outline (`src/pill.ts`), rather than as a CSS conic
gradient masked to a stroke — the mask route seams at the corners. Gradient
stops are interpolated through Oklab so the ramp stays even.

Everything is a pure function of `useCurrentFrame()` and periodic over 600
frames: the highlight makes exactly **3 laps**, and the border's overall
"breathing" runs on a 150-frame cycle. No state, no timers — Remotion renders
frames out of order across threads.

## Notes

- Bloom is applied to the border only and kept tight. Widening it makes the
  element read as neon signage rather than as UI.
- V1/V2 carry ~1.5% animated grain; pure black bands around a glow ramp
  otherwise. Check the encoded file, not the studio preview. V3 uses minimal
  grain — on a pale ground the risk is mosquito noise around the border rather
  than banding.
- The pill is rendered as a real path with anti-aliasing, never a scaled
  bitmap. Inspect the curved ends at full resolution after a 4K render.
- No audio track.

## Layout

Sizes are fractions of the frame, in `src/GradientButton.tsx`:

- pill: `0.52 × frame width`, `0.16 × frame height`, corner radius = half height
- border stroke: 3px at 4K
- background: `#000000` (V1/V2), `#f4f5f7` (V3)

Palettes and per-version theming live in `src/theme.ts`.
