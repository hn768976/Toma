# Sphere Ripple — 4K still generator

A Remotion composition that renders **still images** (not video) for stock
illustration: geodesic ripples wrapped over a sphere, projected
orthographically, lit, and thrown through a shallow depth of field.

Composition id: **`SphereRipple`** — 3840 × 2160 (16:9), `durationInFrames: 1`.
Nothing in the piece reads the frame number; the same `composition` +
`palette` always reproduces exactly the same image, because every random value
is seeded from the composition name through Remotion's `random()`.

## Props

| prop          | accepted values                                                         |
| ------------- | ----------------------------------------------------------------------- |
| `composition` | `r01` `r02` `r03` `r04` `r05` `r06` `r07` `r08` `r09` `r10` `r11` `r12` |
| `palette`     | `cobalt` `cyan` `violet` `emerald` `amber` `crimson`                    |

### The twelve compositions

| id    | setup                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------- |
| `r01` | Large sphere sunk below the bottom-right; upper cap only. Tight spacing, many fine rings. The reference composition. |
| `r02` | Very large sphere off the left edge — its right limb crosses the frame as a curved band. Wide spacing, bold rings.   |
| `r03` | Small complete sphere centre-frame, origin at its centre, near-concentric rings.                                     |
| `r04` | Large sphere mostly above the frame, lower cap visible; rings sweep up and to the right.                             |
| `r05` | Close to the surface — gentle curvature, broad arcs, origin off-frame to the right.                                  |
| `r06` | Medium sphere lower-left with the origin out on the limb: a compressed fan.                                          |
| `r07` | Small sphere upper-left with the sharp band placed away from it, so the subject itself is soft.                      |
| `r08` | Large sphere centred on the bottom edge, symmetric. The tightest spacing and highest ring count.                     |
| `r09` | Medium sphere right of centre, origin thrown onto the limb — rings truncate almost at once.                          |
| `r10` | Enormous sphere off the bottom-right corner; only a diagonal sliver of limb. The emptiest of the twelve.             |
| `r11` | Centred sphere lit from below: brightest at the bottom, near-black at the top.                                       |
| `r12` | Two ripple sources — a large sphere upper-left and a smaller, dimmer one lower-right.                                |

## Rendering one still

```bash
npx remotion still SphereRipple out/stills/ripple-r01-cobalt.png \
  --props='{"composition":"r01","palette":"cobalt"}'
```

Any composition/palette pair works the same way:

```bash
npx remotion still SphereRipple out/stills/ripple-r08-cyan.png \
  --props='{"composition":"r08","palette":"cyan"}'
```

## Rendering the batch

`scripts/render-batch.ts` renders all twenty-four stills — each of the twelve
compositions in two palettes — into `out/stills/`, then tiles them into
`out/contact-sheet.png` with each composition's two palettes side by side. It
bundles the project once and reuses it for all twenty-four renders; that is
the only difference from running the CLI command above twenty-four times.

```bash
npm run render:batch                  # all 24 stills + the contact sheet
npm run render:batch -- r01 r08       # only those compositions
npm run render:batch -- --sheet-only  # re-tile whatever is already rendered
```

Output names follow `ripple-<composition>-<palette>.png`.

The palette pairs:

```
r01 → cobalt, violet     r07 → violet, crimson
r02 → cyan,   emerald    r08 → cobalt, cyan
r03 → violet, amber      r09 → emerald, violet
r04 → emerald, cobalt    r10 → amber,  cobalt
r05 → amber,  cyan       r11 → crimson, emerald
r06 → crimson, cobalt    r12 → cyan,   amber
```

## How it is built

`src/sphere-ripple/`

| file                 | what it holds                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `compositions.ts`    | Everything that varies between stills: sphere centre and radius, ripple origin, ring spacing and count, focus band, light direction. The renderer only walks this structure, so a thirteenth composition is a data edit. |
| `palettes.ts`        | The six palettes. The only file in the project allowed a hex literal.                                                                                                                                                    |
| `geometry.ts`        | The sphere maths: rings as circles _on the sphere_, orthographic projection, back-hemisphere culling, per-segment lighting and focus bucketing.                                                                          |
| `SphereRings.tsx`    | Paints the segments into four blur-bracket buffers — a wide soft glow, then a thin bright core, composited with `lighter`.                                                                                               |
| `FocusPass.tsx`      | Blurs each of the four buffers once and adds them together.                                                                                                                                                              |
| `BackgroundWash.tsx` | Deep base, broad radial wash, large-scale mottling, built at 1/8 scale and upscaled.                                                                                                                                     |
| `GrainPass.tsx`      | Fine monochrome grain over the finished frame.                                                                                                                                                                           |

Rings are generated as parametric **paths**, not as a per-pixel distance
field, which is what makes per-segment stroke width, glow and blur possible.
Each ring is the set of surface points at a constant geodesic distance from
the ripple origin; the compression toward the limb and the truncation at the
horizon both fall out of the projection rather than being drawn in. Because
segments — not whole rings — are bucketed by their distance from the focus
band, one ring can be sharp where it crosses the band and soft at both ends.

## Project commands

```console
npm i             # install dependencies
npm run dev       # Remotion Studio
npm run lint      # eslint + tsc
```

This project also contains two unrelated Remotion compositions from earlier
work — `BluetoothExplainer` and `ParticleRingHalo`. They are video
compositions and are not part of the sphere-ripple still set.

Remotion [fundamentals](https://www.remotion.dev/docs/the-fundamentals) ·
[licence terms](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)
(a company licence is needed for some entities).
