# Periodic element cards — Remotion template

Two styles of periodic-table element card, animated as a 10-second clip per
element. Compositions are authored at **3840×2160, 30 fps, 300 frames**.

- **V1 — neon blue.** A neon-outlined rounded tile on a dark navy bokeh field
  with out-of-focus periodic-table squares behind it. The card enters rotated
  and settles face-on.
- **V2 — metallic on purple.** A sharp-cornered metal-framed card on a deep
  purple field with flowing violet ribbons. The card swings continuously
  around its vertical axis and the brushed-metal gradient on the symbol
  travels with it.

The set currently ships three elements — Hydrogen, Lithium and Mercury —
chosen to cover the layout's extremes: a one-character symbol with a
one-digit number, the two-character reference case, and the widest case
(two-letter symbol, two-digit number, five-character mass).

## Install and preview

```console
npm install
npm run dev        # Remotion Studio
```

## Compositions

| Composition id | Delivered file stem |
| --- | --- |
| `V1-HydrogenElementNeon` | `V1_HydrogenElementNeon` |
| `V2-HydrogenElementMetallic` | `V2_HydrogenElementMetallic` |
| `V1-LithiumElementNeon` | `V1_LithiumElementNeon` |
| `V2-LithiumElementMetallic` | `V2_LithiumElementMetallic` |
| `V1-MercuryElementNeon` | `V1_MercuryElementNeon` |
| `V2-MercuryElementMetallic` | `V2_MercuryElementMetallic` |

Remotion composition ids accept letters, digits and hyphens only, which is why
the id uses `-` where the file name uses `_`.

## Rendering at 4K

One command per composition. `--scale=1` renders at the authored 3840×2160.

```console
npx remotion render V1-HydrogenElementNeon    out/V1_HydrogenElementNeon.mp4    --scale=1 --crf=16
npx remotion render V2-HydrogenElementMetallic out/V2_HydrogenElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-LithiumElementNeon     out/V1_LithiumElementNeon.mp4     --scale=1 --crf=16
npx remotion render V2-LithiumElementMetallic out/V2_LithiumElementMetallic.mp4 --scale=1 --crf=16
npx remotion render V1-MercuryElementNeon     out/V1_MercuryElementNeon.mp4     --scale=1 --crf=16
npx remotion render V2-MercuryElementMetallic out/V2_MercuryElementMetallic.mp4 --scale=1 --crf=16
```

A face-on still:

```console
npx remotion still V1-MercuryElementNeon out/V1_MercuryElementNeon.png --frame=150 --scale=1
```

The 1080p previews in this delivery were rendered with `--scale=0.5 --crf=18`.
H.264 / `yuv420p` / 30 fps and **no audio track** are set in
`remotion.config.ts` and by the compositions themselves; nothing in the project
mounts an audio tag.

## Atomic mass convention

**Four significant figures**, for all 118 elements, stored pre-formatted as a
string in `src/data/elements.ts`:

```
H   1.008
Li  6.941
Hg  200.6
```

The convention lives in the data rather than in formatting code, so there is
one place to look and one place to be consistent. Four significant figures is
at most five characters wide for every element, which is what lets a single
type size serve all of them. For elements with no stable isotope, use the mass
number of the most stable isotope in brackets, e.g. `[294]`.

The Lithium reference clip shows `6.9410` — a four-decimal form. Either
convention is defensible; what matters is that one of them is applied to all
118. If you switch, change every entry, not some.

## Adding an element

The element list is pure data. Adding one is a data edit — no component,
composition, layout or render script changes.

1. Open `src/data/elements.ts`.
2. Append an entry to `ELEMENTS`:

   ```ts
   {
     number: 26,
     symbol: "Fe",
     name: "Iron",
     mass: "55.85",        // four significant figures, as a string
     category: "transition metal",
   },
   ```

   `category` is one of the values in the `ElementCategory` union at the top of
   the file. It is not drawn on either card — it is stored so a future style
   variant can colour-code the accent by category at no extra data cost.
3. That is all. `src/compositions.ts` derives the composition ids from the
   list, so `V1-IronElementNeon` and `V2-IronElementMetallic` appear in the
   Studio and in `npx remotion compositions` immediately.
4. Render them with the commands above, substituting the new ids.

Sanity checks worth doing on a new entry: the mass is five characters or
fewer, the name is not longer than `Rutherfordium` (the longest element name,
which the layout is sized for), and the symbol is at most two letters.

## How it is built

- **No 3D engine.** The card is a flat DOM/SVG plane inside a CSS
  `perspective` container, rotated with `rotateX`/`rotateY`. The type stays
  live text under the transform, so it is crisp at any render scale. Nothing
  is rasterised — the only `blur()` filters are on separate decorative copies
  (the bloom pass, the bokeh, the ribbons), never on a layer containing type.
- **Everything is a pure function of `useCurrentFrame()`.** No state, no
  timers, no `Math.random()` at render time — Remotion renders frames out of
  order across threads, so anything else would flicker. Scatter comes from a
  seeded mulberry32 PRNG in `src/lib/random.ts`, evaluated once at module load.
- **Sizes are fractions of frame height** via `useVideoConfig()`, so a 4K
  render and a 1080p preview are the same picture at different scales.
- **Fonts are embedded.** Inter (SIL Open Font License 1.1) ships in
  `public/fonts` and is registered through `FontFace` in `src/load-fonts.ts`
  behind a `delayRender()`. No system font is relied on, and no network fetch
  happens at render time. Numbers use tabular figures so digits never re-flow
  between elements.
- **Grain** (`src/Grain.tsx`) is one tileable `feTurbulence` tile encoded as a
  data URI, repeated and offset per frame. Both styles sit on large, very dark
  gradients, which is exactly what H.264 bands on; check the encoded file
  rather than the Studio preview when judging it.

### Looping

The 300-frame cycle is closed for everything driven by a sine of
`frame / 300` or by a whole-cycle wrap: the bokeh field, the ghost tiles, the
neon glow breath, the ribbons, the grain, and V2's card rotation, sheen and
metal gradient. **V2 loops seamlessly end to end.**

**V1's card does not**, deliberately: its brief calls for the card to start at
~35° and settle face-on over the first 90 frames, then hold. That is an
entrance, not a cycle, so V1's background loops but its card is at 0° on the
last frame and 35° on the first. The reference clip behaves the same way. If
you want V1 to loop end to end as well, set `ENTRY_ROT_Y`, `ENTRY_ROT_X` and
`ENTRY_ROT_Z` in `src/v1/NeonScene.tsx` to `0` — the ±4° hold oscillation is
already periodic and will carry the motion on its own.

## Layout

`src/layout.ts` holds every size as a fraction of the card's edge length, and
the same fractions are used for all elements — nothing shrinks per element,
which is what makes a set of 118 look like a set. The layout is sized for the
worst case on each axis at once: a three-digit atomic number, a two-letter
symbol with a descender (`Hg`, `Ag`, `Rg`), a five-character mass, and the
longest element name.

## Licence

Inter is licensed under the SIL Open Font License 1.1; the licence text is in
`public/fonts/Inter-LICENSE.txt` and permits embedding in footage you sell.

Atomic numbers, symbols, names and standard atomic weights are factual and in
the public domain.
