# Symmetrical HUD Dashboard

A flat, frontal, left-right symmetrical HUD dashboard animation built in
Remotion, in **two versions from one project**. Everything is drawn to 2D
`<canvas>` — no 3D, no Three.js, no camera move, no tilt, no perspective.

| Composition id | Version | Centre form | Rails | 
|---|---|---|---|
| `HudDashBlue` | v1 "blue" | `concentricDial` — counter-rotating dashed ring and broken arc ring, empty centre | `ticked` |
| `HudDashAmber` | v2 "amber" | `hexCore` — two counter-rotating hexagons interlocking into a twelve-pointed star, broken arc ring against both, occupied centre | `segmented` |

Both are **4K, 3840 x 2160, 390 frames @ 30fps = 13.0s**, and both **loop
seamlessly** — frame 0 and frame 390 are pixel-identical.

## Render

```bash
npm install
npx remotion render HudDashBlue  out/huddash-blue.mp4  --codec=h264 --crf=12 --concurrency=8
npx remotion render HudDashAmber out/huddash-amber.mp4 --codec=h264 --crf=12 --concurrency=8
```

1080p previews (half scale) are much quicker:

```bash
npx remotion render HudDashBlue  out/huddash-blue-preview.mp4  --codec=h264 --crf=18 --scale=0.5
npx remotion render HudDashAmber out/huddash-amber-preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

`npx remotion studio` opens both for scrubbing.

> `--concurrency=8` needs at least 8 CPU cores; lower it to your core count if
> Remotion refuses to start.

## Where things live

```
src/
  index.ts            registerRoot
  Root.tsx            <Composition> for both variants
  HudDash.tsx         the composed frame
  variants.ts         VARIANTS — palette, centre form, panel content, rail style
  layout.ts           the fixed 3840x2160 symmetrical layout
  constants.ts        WIDTH / HEIGHT / FPS / LOOP
  lib/                colour, font loading, canvas primitives, loop-safe motion
  components/         CentreDial, SidePanel, RingGauge, BarRow, DataTable,
                      TickRail, MiniChart, PieRow, CornerPods, Backdrop, Finish
public/fonts/         Barlow Condensed woff2 (latin, 400/500/600/700)
tools/make-zips.sh    builds dist/hud-dash-blue.zip and dist/hud-dash-amber.zip
```

`src/variants.ts` is the only file in the project holding a colour literal, and
it is what selects the centre form, the rail style and the panel content. The
centre element is chosen by the `centreForm` config value, never hardcoded.

## Determinism and loop closure

Every value on screen is a pure function of `useCurrentFrame()`. No
`Date.now()`, no `requestAnimationFrame`, no CSS animation, no component state;
all randomness goes through Remotion's `random()` with stable string seeds.
Canvases are painted synchronously once per React render, so
`npx remotion render` is reproducible frame for frame.

Every periodic quantity completes a whole number of periods in 390 frames —
rotations, chart scrolling, rail markers, and the spring cycles driving gauges,
bars, pies and the data table — which is what makes frame 0 and frame 390
identical.

## Fonts

Barlow Condensed ships in `public/fonts` and is registered through the
`FontFace` API behind `delayRender()`/`continueRender()`, so a render needs no
network access. Set `USE_GOOGLE_FONTS_CDN = true` in `src/lib/font.ts` to pull
the identical family through `@remotion/google-fonts` instead. Numeric readouts
are laid out on a fixed digit advance in `src/lib/draw.ts` for true tabular
figures, so values never jitter as they change.

No logos, no watermark, no audio.
