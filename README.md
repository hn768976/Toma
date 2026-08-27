# agent-icons

Flat-vector "AI agent" animations built in Remotion — **three versions in one
project**, sharing a single component and driven entirely by a `variant` prop.

No 3D, no Three.js, no canvas. Everything is inline SVG inside a
`viewBox="0 0 3840 2160"`, with all motion derived from `useCurrentFrame()`
via `interpolate()` and `spring()`.

---

## Compositions

| Composition id     | Variant | Domain   | Layout  | Resolution  | Duration        | fps |
| ------------------ | ------- | -------- | ------- | ----------- | --------------- | --- |
| `AgentIconsLight`  | `light` | General  | Scatter | 3840 × 2160 | 300 frames / 10.0 s | 30 |
| `AgentIconsDark`   | `dark`  | Security | Scatter | 3840 × 2160 | 300 frames / 10.0 s | 30 |
| `AgentIconsWarm`   | `warm`  | Data     | Grid    | 3840 × 2160 | 300 frames / 10.0 s | 30 |

All three render independently.

### v1 — `AgentIconsLight`

Saturated blue chip on pure white, nine colourful icons in a loose scatter,
four-pointed sparkles. Completely flat: solid fills and clean strokes, no
gradients, shadows, textures or glow.

### v2 — `AgentIconsDark`

The inversion: a lime chip as the brightest thing on deep charcoal, with the
satellite set swapped to the **security** domain (padlock, key, fingerprint,
firewall, alert, eye, shield-with-keyhole, bug). Most icons are cool grey —
lime and coral are held back as accents. Sparkles become **scan ticks**: short
straight dashes at varied angles, at the same positions and on the same
twinkle timing. A soft lime halo sits behind the centre chip only, since on a
dark ground the chip needs separation it did not need on white.

### v3 — `AgentIconsWarm`

Muted, earthy, editorial. The chip reads `DATA HUB` and the satellites are the
**data** domain (database, bar chart, pie chart, line graph, cloud, funnel,
table, up-arrow). The layout is a genuine second branch: a structured **3 × 3
grid** with the chip in the centre cell, joined to each of the eight cells by
thin right-angle **connector traces** with rounded corners — circuit-trace
style, never diagonal. The cascade changes with it: the chip appears, then each
trace draws on via stroke-dash and its icon pops in as the trace reaches it —
the hub wiring itself up. Idle motion is reduced to ±5 px with no rotation so
nothing drifts out of alignment, and two small dots travel along each trace
through the idle section.

---

## Timing

Every version is a one-shot build-and-hold over 300 frames, not a loop.

| Frames    | What happens                                                               |
| --------- | -------------------------------------------------------------------------- |
| 0 – 12    | Empty background.                                                           |
| 12 – 120  | Staggered cascade. Scatter versions order elements from the chip outward, 5 frames apart, each springing in from `0.75` with `{damping: 13, stiffness: 95}`. The grid version instead draws one connector at a time over ~10 frames and lands each icon as its trace arrives. |
| 120 – 300 | Idle. Every element bobs on its own tiny closed elliptical path with a seeded phase, on a period that divides evenly into 180 so the idle section is internally consistent. Sparkles twinkle 0.85 → 1.15 on seeded sines. The chip never moves. No camera move, no zoom. |

---

## Structure

```
src/
  index.ts          registerRoot
  Root.tsx          the three <Composition> registrations
  AgentIcons.tsx    VARIANTS, layout tables, and every component
remotion.config.ts
tsconfig.json
package.json
public/
renders/            pre-rendered output for all three compositions
  agent-light.mp4           3840 x 2160, crf 14
  agent-dark.mp4            3840 x 2160, crf 14
  agent-warm.mp4            3840 x 2160, crf 14
  agent-light-preview.mp4   1920 x 1080, crf 18
  agent-dark-preview.mp4    1920 x 1080, crf 18
  agent-warm-preview.mp4    1920 x 1080, crf 18
```

`renders/` is output, not input — delete it and re-run the commands below to
regenerate. Everything needed to build is the rest of the tree.

`src/AgentIcons.tsx` holds one exported `VARIANTS` object keyed by
`"light" | "dark" | "warm"`. For each variant it carries the palette, the
centre chip label, the satellite icon list and the layout mode. **No hex
literal, no chip label string and no icon list exists anywhere else in the
file** — icon entries reference palette keys by name rather than by colour.

Components are separate: `<CentreChip>` (reused at 60 % as the outline-only
chip echo), `<SatelliteIcon>` (one component with a switch over icon names,
not one component per icon), `<Sparkle>` and `<Connector>`.

Randomness comes from Remotion's `random()` with stable string seeds —
never `Math.random()`. Motion never touches `Date.now()`, rAF, CSS animations
or React state.

Stroke weight is a single exported constant, `STROKE = 7` (4K units), with
round caps and joins throughout.

---

## Render commands

Previews (half scale):

```bash
npx remotion render AgentIconsLight out/agent-light-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

npx remotion render AgentIconsDark out/agent-dark-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

npx remotion render AgentIconsWarm out/agent-warm-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

Full 4K:

```bash
npx remotion render AgentIconsLight out/agent-light.mp4 --codec=h264 --crf=14
npx remotion render AgentIconsDark  out/agent-dark.mp4  --codec=h264 --crf=14
npx remotion render AgentIconsWarm  out/agent-warm.mp4  --codec=h264 --crf=14
```

> `--concurrency` may not exceed the number of CPU cores on the rendering
> machine; drop it (or lower it) on a machine with fewer than 8.

Studio:

```bash
npm install
npm start
```

---

## Notes

- Outputs carry **no audio track** (`Config.setMuted(true)`), no watermark, no
  bloom, vignette or grain. The flat look is the identity of this set.
- The chip label renders in a `"Liberation Sans", Helvetica, Arial` stack so
  rendering has no network dependency. Swap `FONT` in `src/AgentIcons.tsx` for
  a bundled geometric sans (Poppins, Inter) if you prefer.
