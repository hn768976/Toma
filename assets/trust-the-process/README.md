# Trust The Process — animated sticker

A vector re-creation of the reference sticker, authored as a SVGator project so the
artwork stays editable and the motion is keyframed rather than baked.

- **SVGator project:** `pi_e987854b458a4e97954106cc1430fbb8`
  ([open in the editor](https://app.svgator.com/editor#/e987854b458a4e97954106cc1430fbb8))
- **Canvas:** 600 × 600, transparent background
- **Timeline:** 3600 ms, looping forever, seamless (every channel returns to its t=0 pose)

## Files

| File | What it is |
| --- | --- |
| `trust-the-process.svg` | Static single-frame export, font subset embedded |
| `preview.png` | Rendered still |
| `build_document.py` | Generates the SVGator project document JSON |

Export the animated SVG / Lottie / GIF from the SVGator project — the animation lives
there, not in the static file above.

## Design

| Role | Colour |
| --- | --- |
| Ink outline | `#1a1814` (warm near-black, not pure black) |
| Backing | `#92e7a7` mint |
| Face | `#f3de68` yellow |
| Sparkles | `#fdfbf2` cream |

Hand-drawn sticker language throughout: one wobbly squircle silhouette, round line caps
and joins, a single weight ramp (14 → 12 → 11 → 8 → 6 → 5 px) so the outline hierarchy
reads at sticker size. Lettering is Baloo 2 ExtraBold, tilted -3° / +2° so the two lines
sit off-axis like hand-placed type.

## Motion

Playful personality, built on three layers:

- **Primary** — the whole sticker bounces in place: anticipation squash (300 ms),
  stretch (620 ms), landing squash (900 ms) on an ease-out-back, settling by 1400 ms.
  The pivot sits at the sticker's base so the squash reads as ground contact.
- **Secondary** — the sprout follows through with lag: the stem starts its sway 120 ms
  after the bounce, each leaf 80 ms after that, pivoting at its own attachment point.
- **Ambient** — the two sparkles twinkle on opposite phases so they never blink
  together, and the two headlines rock a degree or so under the main beat.

No linear easing on anything spatial; every keyframe carries a felt curve.

## Coordinate model (worth knowing before editing the JSON)

SVGator composes an element as `T(origin) · rotate · skew · scale · T(translate)`.
`origin` is both the element's placement in its parent and the pivot at its own local
`(0,0)` — so geometry must be authored **relative to its pivot**, not in absolute canvas
coordinates. `build_document.py` takes absolute coordinates plus a pivot per element and
does that conversion, which is why it exists.
