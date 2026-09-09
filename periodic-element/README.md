# Periodic element cards — Remotion template

Two styles of periodic-table element card, animated as a 10-second clip per
element. **33 elements × 2 styles = 66 compositions**, authored at
**3840×2160, 30 fps, 300 frames**.

- **V1 — neon blue.** A neon-outlined rounded tile on a plain dark navy
  gradient. The card enters rotated and settles face-on.
- **V2 — metallic on purple.** A sharp-cornered metal-framed card on a deep
  purple field, with two flowing violet ribbons running behind it. The card
  swings continuously around its vertical axis and the brushed-metal gradient
  on the symbol travels with it.

The element list is pure data. The remaining 85 elements are added by
appending rows to `src/data/elements.ts` — no component, composition or
render-script change. See **Adding an element**.

## Install and preview

```console
npm install
npm run dev        # Remotion Studio, all 66 compositions
```

## The 33 elements

Composition ids accept letters, digits and hyphens only, which is why an id
uses `-` where the delivered file name uses `_` (`V1-GoldElementNeon` renders
to `V1_GoldElementNeon.mp4`).

| # | Sym | Element | Mass | Category | V1 composition id | V2 composition id |
|---|-----|---------|------|----------|-------------------|-------------------|
| 1 | H | Hydrogen | 1.008 | nonmetal | `V1-HydrogenElementNeon` | `V2-HydrogenElementMetallic` |
| 2 | He | Helium | 4.003 | noble gas | `V1-HeliumElementNeon` | `V2-HeliumElementMetallic` |
| 3 | Li | Lithium | 6.941 | alkali metal | `V1-LithiumElementNeon` | `V2-LithiumElementMetallic` |
| 6 | C | Carbon | 12.01 | nonmetal | `V1-CarbonElementNeon` | `V2-CarbonElementMetallic` |
| 7 | N | Nitrogen | 14.01 | nonmetal | `V1-NitrogenElementNeon` | `V2-NitrogenElementMetallic` |
| 8 | O | Oxygen | 16.00 | nonmetal | `V1-OxygenElementNeon` | `V2-OxygenElementMetallic` |
| 9 | F | Fluorine | 19.00 | halogen | `V1-FluorineElementNeon` | `V2-FluorineElementMetallic` |
| 10 | Ne | Neon | 20.18 | noble gas | `V1-NeonElementNeon` | `V2-NeonElementMetallic` |
| 11 | Na | Sodium | 22.99 | alkali metal | `V1-SodiumElementNeon` | `V2-SodiumElementMetallic` |
| 12 | Mg | Magnesium | 24.31 | alkaline earth metal | `V1-MagnesiumElementNeon` | `V2-MagnesiumElementMetallic` |
| 13 | Al | Aluminium | 26.98 | post-transition metal | `V1-AluminiumElementNeon` | `V2-AluminiumElementMetallic` |
| 14 | Si | Silicon | 28.09 | metalloid | `V1-SiliconElementNeon` | `V2-SiliconElementMetallic` |
| 15 | P | Phosphorus | 30.97 | nonmetal | `V1-PhosphorusElementNeon` | `V2-PhosphorusElementMetallic` |
| 16 | S | Sulfur | 32.06 | nonmetal | `V1-SulfurElementNeon` | `V2-SulfurElementMetallic` |
| 17 | Cl | Chlorine | 35.45 | halogen | `V1-ChlorineElementNeon` | `V2-ChlorineElementMetallic` |
| 18 | Ar | Argon | 39.95 | noble gas | `V1-ArgonElementNeon` | `V2-ArgonElementMetallic` |
| 19 | K | Potassium | 39.10 | alkali metal | `V1-PotassiumElementNeon` | `V2-PotassiumElementMetallic` |
| 20 | Ca | Calcium | 40.08 | alkaline earth metal | `V1-CalciumElementNeon` | `V2-CalciumElementMetallic` |
| 22 | Ti | Titanium | 47.87 | transition metal | `V1-TitaniumElementNeon` | `V2-TitaniumElementMetallic` |
| 24 | Cr | Chromium | 52.00 | transition metal | `V1-ChromiumElementNeon` | `V2-ChromiumElementMetallic` |
| 26 | Fe | Iron | 55.85 | transition metal | `V1-IronElementNeon` | `V2-IronElementMetallic` |
| 27 | Co | Cobalt | 58.93 | transition metal | `V1-CobaltElementNeon` | `V2-CobaltElementMetallic` |
| 28 | Ni | Nickel | 58.69 | transition metal | `V1-NickelElementNeon` | `V2-NickelElementMetallic` |
| 29 | Cu | Copper | 63.55 | transition metal | `V1-CopperElementNeon` | `V2-CopperElementMetallic` |
| 30 | Zn | Zinc | 65.38 | transition metal | `V1-ZincElementNeon` | `V2-ZincElementMetallic` |
| 47 | Ag | Silver | 107.9 | transition metal | `V1-SilverElementNeon` | `V2-SilverElementMetallic` |
| 50 | Sn | Tin | 118.7 | post-transition metal | `V1-TinElementNeon` | `V2-TinElementMetallic` |
| 53 | I | Iodine | 126.9 | halogen | `V1-IodineElementNeon` | `V2-IodineElementMetallic` |
| 78 | Pt | Platinum | 195.1 | transition metal | `V1-PlatinumElementNeon` | `V2-PlatinumElementMetallic` |
| 79 | Au | Gold | 197.0 | transition metal | `V1-GoldElementNeon` | `V2-GoldElementMetallic` |
| 80 | Hg | Mercury | 200.6 | transition metal | `V1-MercuryElementNeon` | `V2-MercuryElementMetallic` |
| 82 | Pb | Lead | 207.2 | post-transition metal | `V1-LeadElementNeon` | `V2-LeadElementMetallic` |
| 92 | U | Uranium | 238.0 | actinide | `V1-UraniumElementNeon` | `V2-UraniumElementMetallic` |

## Rendering at 4K

`--scale=1` renders at the authored 3840×2160. One command per composition:

```console
npx remotion render V1-HydrogenElementNeon out/V1_HydrogenElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-HydrogenElementMetallic out/V2_HydrogenElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-HeliumElementNeon out/V1_HeliumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-HeliumElementMetallic out/V2_HeliumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-LithiumElementNeon out/V1_LithiumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-LithiumElementMetallic out/V2_LithiumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-CarbonElementNeon out/V1_CarbonElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-CarbonElementMetallic out/V2_CarbonElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-NitrogenElementNeon out/V1_NitrogenElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-NitrogenElementMetallic out/V2_NitrogenElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-OxygenElementNeon out/V1_OxygenElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-OxygenElementMetallic out/V2_OxygenElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-FluorineElementNeon out/V1_FluorineElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-FluorineElementMetallic out/V2_FluorineElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-NeonElementNeon out/V1_NeonElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-NeonElementMetallic out/V2_NeonElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-SodiumElementNeon out/V1_SodiumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-SodiumElementMetallic out/V2_SodiumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-MagnesiumElementNeon out/V1_MagnesiumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-MagnesiumElementMetallic out/V2_MagnesiumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-AluminiumElementNeon out/V1_AluminiumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-AluminiumElementMetallic out/V2_AluminiumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-SiliconElementNeon out/V1_SiliconElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-SiliconElementMetallic out/V2_SiliconElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-PhosphorusElementNeon out/V1_PhosphorusElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-PhosphorusElementMetallic out/V2_PhosphorusElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-SulfurElementNeon out/V1_SulfurElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-SulfurElementMetallic out/V2_SulfurElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-ChlorineElementNeon out/V1_ChlorineElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-ChlorineElementMetallic out/V2_ChlorineElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-ArgonElementNeon out/V1_ArgonElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-ArgonElementMetallic out/V2_ArgonElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-PotassiumElementNeon out/V1_PotassiumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-PotassiumElementMetallic out/V2_PotassiumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-CalciumElementNeon out/V1_CalciumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-CalciumElementMetallic out/V2_CalciumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-TitaniumElementNeon out/V1_TitaniumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-TitaniumElementMetallic out/V2_TitaniumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-ChromiumElementNeon out/V1_ChromiumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-ChromiumElementMetallic out/V2_ChromiumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-IronElementNeon out/V1_IronElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-IronElementMetallic out/V2_IronElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-CobaltElementNeon out/V1_CobaltElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-CobaltElementMetallic out/V2_CobaltElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-NickelElementNeon out/V1_NickelElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-NickelElementMetallic out/V2_NickelElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-CopperElementNeon out/V1_CopperElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-CopperElementMetallic out/V2_CopperElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-ZincElementNeon out/V1_ZincElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-ZincElementMetallic out/V2_ZincElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-SilverElementNeon out/V1_SilverElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-SilverElementMetallic out/V2_SilverElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-TinElementNeon out/V1_TinElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-TinElementMetallic out/V2_TinElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-IodineElementNeon out/V1_IodineElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-IodineElementMetallic out/V2_IodineElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-PlatinumElementNeon out/V1_PlatinumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-PlatinumElementMetallic out/V2_PlatinumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-GoldElementNeon out/V1_GoldElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-GoldElementMetallic out/V2_GoldElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-MercuryElementNeon out/V1_MercuryElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-MercuryElementMetallic out/V2_MercuryElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-LeadElementNeon out/V1_LeadElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-LeadElementMetallic out/V2_LeadElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-UraniumElementNeon out/V1_UraniumElementNeon.mp4 --scale=1 --crf=16
npx remotion render V2-UraniumElementMetallic out/V2_UraniumElementMetallic.mp4 --scale=1 --crf=16
```

Or the whole set:

```bash
# --quiet prints every id on one space-separated line, and the memory
# diagnostics go to stderr, hence the 2>/dev/null.
for id in $(npx remotion compositions src/index.ts --quiet 2>/dev/null); do
  npx remotion render "$id" "out/${id/-/_}.mp4" --scale=1 --crf=16
done
```

A face-on still from any composition:

```console
npx remotion still V1-GoldElementNeon out/V1_GoldElementNeon.png --frame=150 --scale=1
```

### Measured 4K render time

On 4 CPU cores, timed over a 30-frame sample that includes process and browser
startup:

| Style | Per frame | Per 300-frame composition |
| --- | --- | --- |
| V1 neon | 1.21 s | ~6 min |
| V2 metallic | 1.75 s | ~9 min |

The fixed startup cost amortises over a full 300-frame render, so expect
slightly better than these figures in a real batch — call it 5–6 min for a V1
and 8–9 min for a V2. **All 66 is roughly 8 hours on 4 cores**, and scales
down with core count: Remotion renders frames concurrently.

V2 is the slower style because of the two blurred SVG ribbon filters covering
the frame.

H.264 / `yuv420p` (limited range, bt709) / 30 fps and **no audio track** are
set in `remotion.config.ts`. Verify a finished render with
`npx remotion ffprobe out/<name>.mp4` — a correct file reports one video
stream and no audio stream.

## Verification: all 66 compositions checked

Every composition was rendered and inspected before delivery, because a
composition nobody looked at fails silently in an unattended 4K batch after
the render time is already spent.

Reproduce with:

```console
node scripts/verify-compositions.mjs --frame=150 --scale=0.3 --out=verify
```

It bundles once and reuses a single browser, so all 66 stills take about 45
seconds rather than an hour. Frame 150 is face-on in both styles (V1 has
settled by frame 90; V2's swing sine is zero at 150), which is the frame that
shows the layout most plainly.

Each still was then checked two ways — measured, and looked at:

- **Measured** off the pixels: card centre against frame centre, symbol ink
  midpoint against frame centre, and the ink extents of the symbol, the name
  and the number/mass row against the card's padding box.
- **Looked at**: all 66 cards inspected as contact sheets at full resolution,
  confirming symbol, atomic number, mass and name are correct and correctly
  set on every one.

Results across all 66: card centre within 0.5 px of frame centre on every
composition (sub-pixel rounding); no overflow anywhere; symbol centring within
±3.5 px of frame centre on a 311–325 px card, i.e. within ~1% of card width.

### Completion checklist

| Element | V1 neon | V2 metallic |
|---------|:-------:|:-----------:|
| H &nbsp;Hydrogen | ✓ | ✓ |
| He &nbsp;Helium | ✓ | ✓ |
| Li &nbsp;Lithium | ✓ | ✓ |
| C &nbsp;Carbon | ✓ | ✓ |
| N &nbsp;Nitrogen | ✓ | ✓ |
| O &nbsp;Oxygen | ✓ | ✓ |
| F &nbsp;Fluorine | ✓ | ✓ |
| Ne &nbsp;Neon | ✓ | ✓ |
| Na &nbsp;Sodium | ✓ | ✓ |
| Mg &nbsp;Magnesium | ✓ | ✓ |
| Al &nbsp;Aluminium | ✓ | ✓ |
| Si &nbsp;Silicon | ✓ | ✓ |
| P &nbsp;Phosphorus | ✓ | ✓ |
| S &nbsp;Sulfur | ✓ | ✓ |
| Cl &nbsp;Chlorine | ✓ | ✓ |
| Ar &nbsp;Argon | ✓ | ✓ |
| K &nbsp;Potassium | ✓ | ✓ |
| Ca &nbsp;Calcium | ✓ | ✓ |
| Ti &nbsp;Titanium | ✓ | ✓ |
| Cr &nbsp;Chromium | ✓ | ✓ |
| Fe &nbsp;Iron | ✓ | ✓ |
| Co &nbsp;Cobalt | ✓ | ✓ |
| Ni &nbsp;Nickel | ✓ | ✓ |
| Cu &nbsp;Copper | ✓ | ✓ |
| Zn &nbsp;Zinc | ✓ | ✓ |
| Ag &nbsp;Silver | ✓ | ✓ |
| Sn &nbsp;Tin | ✓ | ✓ |
| I &nbsp;Iodine | ✓ | ✓ |
| Pt &nbsp;Platinum | ✓ | ✓ |
| Au &nbsp;Gold | ✓ | ✓ |
| Hg &nbsp;Mercury | ✓ | ✓ |
| Pb &nbsp;Lead | ✓ | ✓ |
| U &nbsp;Uranium | ✓ | ✓ |

## Layout cases

The set is only as good as its worst-fitting card, so these were measured
rather than assumed. Figures are from the 1152 px-wide verification stills;
multiply by 3.33 for 4K.

- **Longest names.** Phosphorus (10 characters) is the longest in the set,
  then Magnesium and Aluminium (9). Phosphorus clears the card's padding box
  by 48.7 px each side in V1 and 56.3 px in V2 — roughly 160 px at 4K. **No
  tracking or padding change was needed**, and none was made: the type size
  is identical on all 66 cards. For reference the layout has headroom to
  `Rutherfordium` (13 characters), the longest element name of all 118.
- **Single-character symbols** (H, C, N, O, F, P, S, K, I, U). The concern was
  that a single wide letter would look off-centre in a layout tuned on
  two-character symbols. Measured, it does not: all ten sit within 1.5 px of
  frame centre in V1 and 2.5 px in V2 — under 1% of card width.
- **Widest overall.** Uranium (number 92, mass `238.0`, seven-letter name) and
  Mercury (`Hg` with a descender, mass `200.6`) both fit with no adjustment.
- **Mass width.** All 33 masses are exactly five characters, from `4.003` to
  `238.0`. The mass is set in Inter Medium with `tabular-nums` and
  `"tnum" 1`, so every digit has the same advance and the right-hand column
  holds its alignment across the whole set.

The largest measured symbol offset is 3.5 px (V2 `Al` and `Au`, ~1% of card
width). That is `text-anchor: middle` centring the glyphs' *advance width*
including side bearings, rather than their ink — standard typographic
behaviour, and what the reference clips do. It is not visible. Centring on ink
bounds instead would make the symbol's position vary per element, which is the
opposite of what makes 118 cards look like one set.

## Atomic mass convention

**Four significant figures**, for all 118 elements, stored pre-formatted as a
string in `src/data/elements.ts`:

```
H   1.008     Fe  55.85     Au  197.0
Li  6.941     Ag  107.9     Hg  200.6
He  4.003     I   126.9     U   238.0
```

The convention lives in the data rather than in formatting code, so there is
one place to look and one place to be consistent. Four significant figures is
at most five characters wide for every element, which is what lets a single
type size serve all of them. For elements with no stable isotope, use the mass
number of the most stable isotope in brackets, e.g. `[294]`.

The Lithium reference clip shows `6.9410` — a four-decimal form. Either
convention is defensible; what matters is that one of them is applied to all
118. If you switch, change every entry, not some.

## Card size

The card's edge length is a fraction of frame height, set in `CARD_FRACTION`
in `src/layout.ts`:

| Style | Fraction of frame height | At 4K (2160 px) |
| --- | --- | --- |
| V1 neon | **0.50** | 1080 px |
| V2 metallic | **0.48** | 1037 px |

These match the reference clips, which measure roughly 0.50 and 0.54. Every
content size is a fraction of the card's edge length, so changing these two
numbers rescales both cards completely, identically, for all elements.

Two values elsewhere are in frame-height units rather than card units, and
follow the card by hand if you change it: the background glow radius in
`src/v1/NeonBackground.tsx`, and the ribbon base positions in
`src/v2/MetallicBackground.tsx` — those are chosen so both ribbons fall inside
the card's horizontal band (at 0.48 the card spans about 0.365 to 0.635 of
frame width).

## Adding an element

The element list is pure data. Adding one is a data edit — no component,
composition, layout or render-script change.

1. Open `src/data/elements.ts`.
2. Append an entry to `ELEMENTS`, keeping the list in atomic-number order:

   ```ts
   {
     number: 55,
     symbol: "Cs",
     name: "Caesium",
     mass: "132.9",        // four significant figures, as a string
     category: "alkali metal",
   },
   ```

   `category` is one of the values in the `ElementCategory` union at the top
   of the file. It is not drawn on either card — it is stored so a future
   style variant can colour-code the accent by category at no extra data cost.
3. That is all. `src/compositions.ts` derives the composition ids from the
   list, so `V1-CaesiumElementNeon` and `V2-CaesiumElementMetallic` appear in
   the Studio and in `npx remotion compositions` immediately.
4. Run `node scripts/verify-compositions.mjs` and look at the new cards before
   committing 4K render time to them.

Sanity checks on a new entry: the mass is five characters or fewer, the symbol
is at most two letters, and the name is not longer than `Rutherfordium`.

## How it is built

- **No 3D engine.** The card is a flat DOM/SVG plane inside a CSS
  `perspective` container, rotated with `rotateX`/`rotateY`. The type stays
  live text under the transform, so it is crisp at any render scale. Nothing
  is rasterised — the only `blur()` filters are on separate decorative copies
  (the bloom pass, the shadow, the ribbons), never on a layer containing type.
- **Everything is a pure function of `useCurrentFrame()`.** No state, no
  timers, no `Math.random()` at render time — Remotion renders frames out of
  order across threads, so anything else would flicker. Scatter comes from a
  seeded mulberry32 PRNG in `src/lib/random.ts`, evaluated once at module load
  — currently the ribbon sway phases and the grain offsets.
- **Sizes are fractions of frame height** via `useVideoConfig()`, so a 4K
  render and a 1080p preview are the same picture at different scales.
- **The backgrounds are deliberately bare.** V1 is a navy radial gradient and
  a soft glow behind the card — no shapes at all. Both the drifting bokeh and
  the out-of-focus periodic-table squares were removed on review; don't
  reintroduce either. V2 is two ribbons and nothing else, both positioned to
  run behind the card.
- **Fonts are embedded.** Inter (SIL Open Font License 1.1) ships in
  `public/fonts` and is registered through `FontFace` in `src/load-fonts.ts`
  behind a `delayRender()`. No system font is relied on, and no network fetch
  happens at render time. Numbers use tabular figures so digits never re-flow
  between elements.
- **Grain** (`src/Grain.tsx`) is one tileable `feTurbulence` tile encoded as a
  data URI, repeated and offset per frame. Both styles sit on large, very dark
  gradients, which is exactly what H.264 bands on. Two details matter, and
  both were found by measuring an encoded file rather than looking at the
  Studio preview:
  - **Two blend passes.** `overlay` alone dithers midtones but collapses
    toward zero as the backdrop approaches black — the very region that bands.
    A second `screen` pass adds light that survives in the shadows.
  - **Grain has to be coarse enough to survive.** At `baseFrequency` 0.8 the
    features were about one composition pixel, so a `--scale=0.5` preview
    averaged them away and the encoder quantised out the rest.
    `BASE_FREQUENCY` is now 0.32, giving roughly three-composition-pixel
    features.

  For reference, measured across a 1920 px row of encoded V1 in the dark
  surround: mean flat run went from 112 px to about 16 px. If you change the
  grain, re-measure on an encoded file — this is not judgeable by eye in the
  preview.

### Looping

The 300-frame cycle is closed for everything driven by a sine of `frame / 300`:
the neon glow breath, the ribbons, the grain, and V2's card rotation, sheen
and metal gradient. **V2 loops seamlessly end to end.**

**V1's card does not**, deliberately: its brief calls for the card to start at
~35° and settle face-on over the first 90 frames, then hold. That is an
entrance, not a cycle, so V1's background loops but its card is at 0° on the
last frame and 35° on the first. The reference clip behaves the same way. If
you want V1 to loop end to end as well, set `ENTRY_ROT_Y`, `ENTRY_ROT_X` and
`ENTRY_ROT_Z` in `src/v1/NeonScene.tsx` to `0` — the ±4° hold oscillation is
already periodic and will carry the motion on its own.

The settle is eased with `Easing.inOut(Easing.cubic)` rather than an ease-out.
An ease-out puts most of the movement in the first third of the window, which
left the card essentially face-on by frame 30 and wasted the entrance. The
ease-in-out spreads it: roughly 30° at frame 30, 5° at frame 60, seated by
frame 90.

### The card is locked to frame centre

The card group carries **no translation** in either style — only
`rotateX`/`rotateY`/`rotateZ` about its own centre, with `perspective-origin`
pinned to `50% 50%`, which is both the card's centre and the frame's. Don't
add a translate to the card. In V2 the ribbons carry the background drift;
V1's background has no moving shapes left, so its motion is the card's settle,
the glow breathing and the grain.

Note that a rotating plane in perspective still moves its *bounding box*, even
though its centre is fixed — the near edge magnifies and the far edge shrinks.
Measured on 1080p previews that is about 6 px at 1920 wide for V1 and 28 px
for V2, and it is inherent to the specified rotation, not a translation that
can be removed. It scales with the card: V2's figure was 18 px before the card
grew from 0.40 to 0.48 of frame height. The only levers on it are card size
and swing amplitude.

What can be kept small is anything moving *near* the card: V2's shadow tracks
the rotation, but its lateral travel is deliberately limited (`0.035` and
`0.02` of the card size, in `src/v2/MetallicScene.tsx`), because a shadow
sliding under a static card reads as the card drifting.

## Naming and listing keywords

Two elements in this set have divergent regional spellings. The **IUPAC
spelling is what appears on the card** — it is the scientific standard and is
what educational buyers expect:

| On the card (IUPAC) | Also list as | Note |
| --- | --- | --- |
| **Aluminium** | Aluminum | US spelling; a large share of searches use it |
| **Sulfur** | Sulphur | Older British spelling; IUPAC and US both use Sulfur |

Include both spellings in the keywords when listing those two clips. This
affects listing metadata only — nothing on the card changes, and
`src/data/elements.ts` carries the IUPAC spelling.

## Licence

Inter is licensed under the SIL Open Font License 1.1; the licence text is in
`public/fonts/Inter-LICENSE.txt` and permits embedding in footage you sell.

Atomic numbers, symbols, names and standard atomic weights are factual and in
the public domain.
