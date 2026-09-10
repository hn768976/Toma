# Zodiac Sign Symbol — 12 signs, gold overlay plates

Twelve 4K compositions: a golden zodiac glyph on pure black, turning slowly on
its vertical axis with a specular highlight that travels as it turns, over the
sign's own constellation.

One component, twelve entries in one data file. The animation, material,
lighting and framing are identical for every sign — only the artwork changes.

- **3840×2160, 30 fps, 300 frames (10 s), seamless loop**
- **12 compositions**, one per sign
- No audio track
- Built with Remotion 4.0.515 (pinned)

## This is an overlay plate — screen-blend it

The clips are gold on **pure black**, not gold on transparency. mp4 cannot carry
an alpha channel, so anything claiming a "transparent background" in an mp4 is
really this: black that you composite additively.

**Drop the clip over your footage and set the blend mode to `Screen`** (or `Add`
/ `Linear Dodge`). Black contributes nothing under a screen blend, so the
surround disappears and only the gold lands on your shot.

For that to work the black has to be *actually* black, so:

- there is no vignette and no lift anywhere in frame;
- the grain is multiplied into the artwork rather than laid over the frame, so
  it never lifts the surround off zero;
- **verified in the encoded file**: decoding `Zodiac_AquariusGold.mp4` and
  `Zodiac_CapricornGold.mp4` at 0 s, 3 s, 6 s and 9 s, every one of the
  1,057,536 pixels outside the centre 70% × 70% box is exactly `0,0,0`
  (`max=0, nonzero=0`). Peak value in frame is 255, on the specular.

If you need a real alpha channel instead, render to ProRes 4444:
`npx remotion render <id> out/<name>.mov --codec=prores --prores-profile=4444`,
and change the background in `ZodiacSymbol.tsx` to `transparent`.

## The twelve signs

| Sign | Glyph | Dates | Composition id | Output name |
|---|---|---|---|---|
| Aries | ♈ | Mar 21 – Apr 19 | `Zodiac-AriesGold` | `Zodiac_AriesGold` |
| Taurus | ♉ | Apr 20 – May 20 | `Zodiac-TaurusGold` | `Zodiac_TaurusGold` |
| Gemini | ♊ | May 21 – Jun 20 | `Zodiac-GeminiGold` | `Zodiac_GeminiGold` |
| Cancer | ♋ | Jun 21 – Jul 22 | `Zodiac-CancerGold` | `Zodiac_CancerGold` |
| Leo | ♌ | Jul 23 – Aug 22 | `Zodiac-LeoGold` | `Zodiac_LeoGold` |
| Virgo | ♍ | Aug 23 – Sep 22 | `Zodiac-VirgoGold` | `Zodiac_VirgoGold` |
| Libra | ♎ | Sep 23 – Oct 22 | `Zodiac-LibraGold` | `Zodiac_LibraGold` |
| Scorpio | ♏ | Oct 23 – Nov 21 | `Zodiac-ScorpioGold` | `Zodiac_ScorpioGold` |
| Sagittarius | ♐ | Nov 22 – Dec 21 | `Zodiac-SagittariusGold` | `Zodiac_SagittariusGold` |
| Capricorn | ♑ | Dec 22 – Jan 19 | `Zodiac-CapricornGold` | `Zodiac_CapricornGold` |
| Aquarius | ♒ | Jan 20 – Feb 18 | `Zodiac-AquariusGold` | `Zodiac_AquariusGold` |
| Pisces | ♓ | Feb 19 – Mar 20 | `Zodiac-PiscesGold` | `Zodiac_PiscesGold` |

Composition ids use a hyphen because Remotion does not allow `_` in an id; the
delivered files keep the `Zodiac_<Sign>Gold` name.

## Rendering

```console
npm install
```

**4K, one composition** — this is the delivery render:

```console
npx remotion render Zodiac-AriesGold out/Zodiac_AriesGold.mp4 --scale=1 --crf=15
```

Substitute the composition id and output name from the table above for each
sign. Codec, pixel format, CRF and the muted (audio-free) output are all set in
`remotion.config.ts`, so `--scale=1 --crf=15` is the whole of what you need on
the command line.

**All twelve at 4K**, one after another:

```console
for S in Aries Taurus Gemini Cancer Leo Virgo Libra Scorpio Sagittarius Capricorn Aquarius Pisces; do
  npx remotion render "Zodiac-${S}Gold" "out/Zodiac_${S}Gold.mp4" --scale=1 --crf=15
done
```

**1080p preview** (what is shipped for the two test signs):

```console
npx remotion render Zodiac-AriesGold out/Zodiac_AriesGold.mp4 --scale=0.5 --crf=15
```

**A still**:

```console
npx remotion still Zodiac-AriesGold out/Zodiac_AriesGold.png --scale=0.5 --frame=75
```

**Studio**:

```console
npm run dev
```

### Measured 4K render time

Measured on this project, on **4 vCPU / 15 GB RAM, Linux, Chromium headless
shell, default concurrency**. Timed as `(t₆₀ − t₁₀) / 50` — two runs of the same
composition, at 60 and 10 frames, so browser start-up, bundling and mux are
cancelled out rather than amortised.

| Sign | Per frame @ 3840×2160 | Per 300-frame composition |
|---|---|---|
| Aquarius (widest glyph, largest filter region) | **0.365 s** | ≈ 1 min 50 s |
| Capricorn (dense glyph, smaller filter region) | **0.259 s** | ≈ 1 min 22 s |

Budget **0.26–0.37 s/frame**, i.e. **80–115 s per composition**. The remaining
ten signs are roughly **15–20 minutes** of wall clock on this class of machine,
plus about 5 s of start-up per composition. Cost scales with the area the
glyph's filter region covers, so the wide signs (Aquarius, Libra) sit at the top
of that range and the compact ones (Gemini, Taurus) at the bottom.

For reference, the 1080p previews take ≈ 35 s each for the full 300 frames.

## What is rendered here

**Rendered — 2 signs, 1080p previews.** They were chosen to test the layout, not
to look good:

- **Aquarius ♒** — the widest glyph in the set (2.12:1). It stresses the
  horizontal framing: if the fit rule lets anything overflow or crowd the frame
  edge, it happens here first.
- **Capricorn ♑** — the densest glyph, a single continuous stroke with a tight
  interior spiral. It stresses the metallic gradient and the bloom on fine
  strokes and on curvature that doubles back on itself.

Both frame and shade correctly, so the remaining ten will.

- `out/Zodiac_AquariusGold.mp4` — 1920×1080, H.264, yuv420p, 30 fps, 300 frames, 10.000 s, no audio
- `out/Zodiac_AquariusGold.png` — 1920×1080 still, frame 75 (peak yaw)
- `out/Zodiac_CapricornGold.mp4` — same spec
- `out/Zodiac_CapricornGold.png` — same spec

**Not rendered — the other ten.** They ship fully configured: composition
registered, glyph paths and constellation data entered, framing verified. Render
them at 4K with the command above.

## Completion checklist — all 12 verified

Framing was checked on the `Zodiac-ContactSheet` composition, which lays all
twelve plates on one frame at the same scale. It was rendered and inspected at
**frame 0** (no yaw), **frame 40** (mid-turn) and **frame 75** (peak yaw, ±20°,
the worst case for anything reaching the frame edge). Each sign was confirmed to
sit optically centred, to hold a visual weight consistent with the other eleven,
and to stay clear of the frame edge through the full turn.

Where a mechanical "fit the height to 0.45 × frame height" left a sign reading
heavy or light against the set, it carries a hand-set `opticalScale` in
`src/zodiac-data.ts`, noted in the last column.

| Sign | Composition registered | Glyph paths | Constellation | Framing checked | Optical correction |
|---|---|---|---|---|---|
| Aries ♈ | ✅ | ✅ | ✅ 4 stars | ✅ | — |
| Taurus ♉ | ✅ | ✅ | ✅ 8 stars | ✅ | 1.04 — narrow for its height |
| Gemini ♊ | ✅ | ✅ | ✅ 9 stars | ✅ | 1.03 — tall and narrow |
| Cancer ♋ | ✅ | ✅ | ✅ 5 stars | ✅ | 0.98 |
| Leo ♌ | ✅ | ✅ | ✅ 9 stars | ✅ | — |
| Virgo ♍ | ✅ | ✅ | ✅ 9 stars | ✅ | — |
| Libra ♎ | ✅ | ✅ | ✅ 6 stars | ✅ | 0.97 — very wide for its height |
| Scorpio ♏ | ✅ | ✅ | ✅ 15 stars | ✅ | 0.98 |
| Sagittarius ♐ | ✅ | ✅ | ✅ 10 stars | ✅ | 1.02 — square diagonal reads small |
| Capricorn ♑ | ✅ | ✅ | ✅ 9 stars | ✅ | 1.02 |
| Aquarius ♒ | ✅ | ✅ | ✅ 10 stars | ✅ | 0.94 — widest glyph in the set |
| Pisces ♓ | ✅ | ✅ | ✅ 14 stars | ✅ | — |

Other checks:

| Check | Result |
|---|---|
| Loop seam | No seam. Frame 299 → 0 differs by mean 0.140 / 8-bit channel, against 0.134 for the ordinary adjacent pair 0 → 1 at the same point in the cycle. |
| Pure black surround | Verified in the encoded mp4s, all sampled frames: `max=0`, `nonzero=0` outside the centre 70%. |
| No audio track | Verified with ffprobe: `nb_streams=1`, video only. |
| Duration / frame count | 300 frames, 10.000 s, 30 fps exactly. |
| Edge quality | Inspected at 4K 1:1 on Capricorn at peak yaw. Curves anti-alias cleanly, no stair-stepping; strokes are real paths, never rasterised artwork. |

## Artwork

The glyphs are **original SVG paths authored for this project**, drawn on a
100×100 grid and stroked so the metal gradient runs along the stroke.

Two deliberate choices:

- **Glyphs, not pictorial figures.** The zodiac glyphs (♈ ♉ ♊ …) are ancient
  public-domain symbols. The illustrated figures used by most stock zodiac clips
  — the centaur archer, the crab, the ram — are somebody's *drawing*: the
  concept is free, that particular illustration is not. Nothing here is traced
  or adapted from any existing illustration. A glyph also reads better at
  thumbnail size than a detailed figure.
- **Paths, not font characters.** A missing or substituted typeface on a render
  machine would silently change all twelve at once, and glyph weights vary a lot
  between typefaces.

**Constellations** are drawn from the published right ascension and declination
of each constellation's named stars, projected into the same grid, with
`mag` the apparent visual magnitude driving dot size and brightness. Star
positions and magnitudes are facts and carry no rights.

## Adding a variant style

Everything a variant needs is already a prop on `<ZodiacSymbol>` or a field in
`src/zodiac-data.ts` — no new component.

**A different metal.** `metal` takes `[shadow, midtone, specular]`; `edgeColor`
is the darker rim under the stroke:

```tsx
<Composition
  id="Zodiac-AriesSilver"
  component={ZodiacSymbol}
  durationInFrames={DURATION_IN_FRAMES}
  fps={FPS}
  width={WIDTH}
  height={HEIGHT}
  defaultProps={{
    sign: 'Aries',
    metal: ['#4c5560', '#aab6c4', '#ffffff'],
    edgeColor: '#12161c',
    constellationColor: '#d8e4f0',
  }}
/>
```

Register it in `src/Root.tsx` next to the loop that builds the twelve gold ones.

**Glyph only, no constellation.** Pass `showConstellation={false}`.

**A labelled variant.** Every sign already carries `dates: { from, to }` and
`char` in `src/zodiac-data.ts`, unused by the gold style. Read them from
`SIGN_BY_NAME[sign]` and draw the label; nothing else has to change.

**A different sign list or new artwork.** Edit `src/zodiac-data.ts` only. The
framing is computed from the paths themselves at render time
(`src/path-bounds.ts`), so a redrawn glyph re-frames itself — there is no
bounding box to keep in sync. Re-render `Zodiac-ContactSheet` afterwards to
re-check the set.

## Project layout

```
src/
  index.ts          entry point
  Root.tsx          the twelve compositions + the contact sheet
  ZodiacSymbol.tsx  the one component: material, lighting, motion, framing
  ContactSheet.tsx  review tool - all twelve on one frame, for the framing check
  zodiac-data.ts    THE data file: glyph paths, constellation stars, dates,
                    per-sign optical correction
  path-bounds.ts    tight bounding box of a path, by sampling
  motion.ts         every animated value, as a pure function of the frame
remotion.config.ts  codec, pixel format, CRF, muted output
```

### How it works

- **Motion.** `motion.ts` is the whole of it. Yaw is `20° · sin(2πf/300)`, so the
  plate swings between −20° and +20° and never goes edge-on. The scale breath is
  `1 + 0.015 · cos(2πf/300)`, a quarter-cycle out of step so it reads as its own
  thing. Star twinkle runs on a whole number of cycles per loop, staggered per
  star. Everything is periodic over exactly 300 frames — no state, no timers, no
  drift, no camera move, and frame 300 is frame 0.
- **Material.** A tight specular band travelling across a bronze field, not one
  long ramp end to end: `#8a5a10` → `#a86a14` → `#e0a828` → `#fff0c0`, with the
  band's position tied to the yaw. A gradient that does not move as the shape
  turns reads as a printed sticker; this is the detail that carries the metal. A
  darker stroke sits just under the metal so the gold does not bleed into the
  black.
- **Bloom** thresholds to the near-white specular only, blurs it and adds back
  55%. Below the threshold nothing is contributed, so the black stays black.
- **Grain** is ±0.5%, applied as `art × (0.995 + 0.01 · noise)` inside the
  glyph's filter — multiplicative, so it scales with brightness and is exactly
  zero where there is no artwork. It also dithers the gradient, which matters in
  8-bit yuv420p.
- **Framing.** Each glyph's ink is measured at render time and fitted so its
  height is `0.45 × frame height`, times the sign's `opticalScale`. Stroke weight
  is a constant fraction of frame height across all twelve, so the set holds one
  visual weight the way a type family does.
- **Depth.** The glyph and the constellation are two planes under one
  perspective; the constellation sits further back and takes 55% of the yaw, so
  they separate as the plate turns.

## Third-party

Remotion is free for individuals and small companies; larger companies need a
company licence. See <https://remotion.dev/license>.
