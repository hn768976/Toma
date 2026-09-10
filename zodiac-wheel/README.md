# Golden Zodiac Wheel — Remotion project

Two procedurally generated, seamlessly looping stock clips of a tilted golden
astrological chart wheel turning over a cosmic nebula.

| Composition id          | Deliverable                  | Look                          |
| ----------------------- | ---------------------------- | ----------------------------- |
| `V1-ZodiacWheelGold`    | `V1_ZodiacWheelGold.mp4`     | Gold wheel on an amber nebula |
| `V2-ZodiacWheelSilver`  | `V2_ZodiacWheelSilver.mp4`   | Silver-blue on deep space     |

Both compositions are defined at **3840×2160, 30 fps, 900 frames (30 s)** and
loop exactly.

## Render

Preview deliverables — 1920×1080, H.264, `yuv420p`, no audio track:

```bash
npm install
npx remotion render V1-ZodiacWheelGold  out/V1_ZodiacWheelGold.mp4   --scale=0.5 --crf=16
npx remotion render V2-ZodiacWheelSilver out/V2_ZodiacWheelSilver.mp4 --scale=0.5 --crf=16
```

Full 4K masters:

```bash
npx remotion render V1-ZodiacWheelGold  out/V1_ZodiacWheelGold_4K.mp4   --scale=1 --crf=16
npx remotion render V2-ZodiacWheelSilver out/V2_ZodiacWheelSilver_4K.mp4 --scale=1 --crf=16
```

Stills:

```bash
npx remotion still V1-ZodiacWheelGold out/V1_ZodiacWheelGold.png --frame=75 --scale=0.5
```

`npm run dev` opens Remotion Studio for interactive tweaking.

## How it is built

**2D with one baked projection.** The wheel is authored in polar coordinates in
a normalised disc space (outer radius = 1000 units) and the tilt is a *single*
vertical squash applied to the whole group — nothing is projected per element.
That keeps the ring detail and the glyphs perfectly crisp and makes the whole
thing cheap to render.

```
translate(cx, cy) · scale(1, 0.575) · rotate(θ) · scale(R/1000)
```

- `src/config.ts` — frame constants, both palettes, every ring radius.
- `src/wheel-geometry.ts` — polar helpers. The dotted ring and both degree-tick
  bands are single dashed circles: a thick dashed stroke on a circle draws
  evenly spaced radial marks, so 360 ticks cost one SVG node and stay crisp.
- `src/glyphs.ts` — the twelve zodiac glyphs as hand-authored SVG paths, not
  font characters, so the wheel renders identically anywhere.
- `src/WheelLinework.tsx` — all the rings, ticks, dividers, aspect chords, sign
  names and glyphs. Rendered twice: once blurred for the glow, once crisp.
- `src/Sunburst.tsx` — the centre star, 12 long points alternating with 12 short
  ones over a white-hot core.
- `src/noise.ts` / `src/cosmos.ts` — seeded Perlin noise, domain-warped fBm for
  the nebula, the starfield, the constellations and the grain tiles. Everything
  is generated once from a seeded PRNG and cached at module level.
- `src/CosmicBackground.tsx` — draws the three nebula layers, ~2200 stars and 26
  constellations to a canvas each frame.
- `src/ZodiacScene.tsx` — composes the layers and owns all the motion.

Everything on screen is procedural. No photographic space imagery is used, so
the clips are clean to license.

## Motion and the loop

All motion is a pure function of `useCurrentFrame()` and periodic over 900
frames:

| Element         | Motion                                                 |
| --------------- | ------------------------------------------------------ |
| Wheel           | 1 full revolution (`turns` prop)                       |
| Sunburst        | 2 revolutions, counter to the wheel (`burstTurns`)     |
| Ring glow       | 3 breathing cycles                                     |
| Nebula          | Three layers drifting on sine paths, back to start     |
| Stars           | Twinkle periods chosen from divisors of 900            |
| Constellations  | Opacity pulses on 180/225/300/450-frame cycles         |

No camera movement, no zoom.

### One deliberate change from the brief

The brief asked for the wheel to turn exactly `360°/12` over the loop, on the
reasoning that each sector then lands where its neighbour began. That is true of
the rotationally symmetric parts, but the twelve glyphs and sign names are *not*
interchangeable: after a twelfth-turn Aries sits where Taurus started, so at the
loop point every glyph on the wheel would jump one sector. The default is
therefore **one full revolution**, which closes the loop with glyph identities
intact.

It is also the reference's actual speed: tracking glyph positions across frames
of the reference clip gives roughly 12°/s, i.e. one revolution per 30 s.

To take the brief literally anyway, pass `turns: 1/12` as a prop (in
`src/Root.tsx` or via `--props`).

## Rendering notes

- Bloom is confined to the sunburst and the brightest ring arc; the wheel's own
  glow is a tight blur (≈7 disc units) so the line work stays readable — that
  detail is the product.
- Grain runs at about 2 %, cycling six pre-rolled tiles. It is mostly there to
  dither the dark nebula gradients so H.264 does not band them. Six tiles divide
  900 exactly.
- Output is `yuv420p` / bt709 with **no audio track** (`Config.setMuted(true)`).
  Verify with `npx remotion ffprobe out/V1_ZodiacWheelGold.mp4`.
- The sign names are set with a system sans stack (`DejaVu Sans`, then Trebuchet
  MS / Helvetica Neue / Arial). Point the `fontFamily` in
  `src/WheelLinework.tsx` at a bundled face if you need byte-identical text
  across machines.
- `remotion.config.ts` picks up a Playwright Chromium at
  `/opt/pw-browsers/...` when one exists, for sandboxes that cannot download
  Remotion's own headless shell. On a normal machine that path is absent and
  Remotion uses its managed browser.

## Tweaking

Most of what you would want to change lives in `src/config.ts`: the two
palettes, and the `WHEEL` block with the centre position, the vertical squash
and every ring radius as a fraction of the outer radius.

Per-composition props (`src/Root.tsx`): `turns`, `burstTurns`, `starCount`,
`seed`, `grain`, and `labelMode` (`"curved"` sets the sign names on an arc and
turns them with the wheel; `"upright"` keeps names and glyphs screen-upright).
