# Chip Dashboard

A looping 4K "AI chip dashboard" animation built in Remotion, in two versions
that share a single codebase and differ only by a `variant` prop.

|                | v1                     | v2                            |
| -------------- | ---------------------- | ----------------------------- |
| Composition id | `ChipDashboard`        | `ChipDashboardReverse`        |
| Variant        | `violet`               | `teal`                        |
| `flowDirection`| `+1`                   | `-1`                          |
| Reads as       | AI producing outputs   | AI ingesting inputs           |
| Fibre fan      | left edge              | right edge                    |
| Chip           | ~28% across            | ~72% across                   |
| Panels         | right of the chip      | left of the chip              |
| Connector dots | chip → panels          | panels → chip                 |
| Fibre pulses   | inward, toward the chip| outward, away from the chip   |
| Chip rim       | cyan `#3FD8F5`         | amber `#F5C542`               |

**Both compositions:** 3840 × 2160, 372 frames, 30 fps — 12.4 s, seamless loop,
no audio.

## Render

Dependencies first: `npm install`.

The compositions are authored at 4K; `--scale=0.5` renders them out at 1080p.

```bash
npx remotion render ChipDashboard        out/chip-dashboard-1080p.mp4 --codec=h264 --crf=18 --scale=0.5
npx remotion render ChipDashboardReverse out/chip-reverse-1080p.mp4   --codec=h264 --crf=18 --scale=0.5
```

Drop `--scale=0.5` for full 3840 × 2160 output. Add `--concurrency=N` to use
more workers — Remotion caps `N` at the machine's core count, and each worker
holds several full-resolution offscreen canvases, so leave headroom on a
memory-constrained box. `remotion.config.ts` defaults to 3.

Interactive preview: `npm start`.

## How it is put together

Everything is drawn with the Canvas 2D API onto one 3840 × 2160 backing store.
There is no `requestAnimationFrame`, no `Date.now()`, no CSS animation and no
component state: every value is a pure function of `useCurrentFrame()`, and
every random value comes from Remotion's seeded `random()` with a stable string
seed, so a given frame renders identically every time.

    src/
      theme.ts       THEMES — the only place a hex literal appears
      config.ts      VARIANT_CONFIG (flowDirection), plane, layout, timings
      scene.ts       the plane matrix, and all geometry built once per variant
      flicker.ts     the deterministic panel-content event schedule
      layers.ts      the layer contract (see "Layer order" below)
      fonts.ts       Inter + Roboto Mono, gated with delayRender()
      ChipDashboard.tsx   composition: compositing, bloom, vignette, grain
      components/    CircuitBackground, FibreFan, Connector, UiPanel, ChipBadge

### One signed value drives the mirror

`flowDirection` in `config.ts` is the only thing that differs geometrically
between the two versions. It decides which frame edge the fibre fan sits on,
which side of centre the chip sits on, where panels distribute, which way
connector dots run and which way fibre pulses run. Panel positions are declared
in *flow space* — `du` downstream of the chip, `dv` across it — so mirroring the
piece needs no second coordinate table. Nothing hardcodes left-to-right.

Panel *contents* (code lines, list bullets, title-bar dots) are deliberately not
mirrored: those are UI conventions rather than flow, and a mirrored code window
reads as broken rather than as reversed.

### The tilted plane

A single affine transform — rotate −14°, shear, compress vertically 8% — applied
via `ctx.setTransform`. Every element inherits it, the chip included. It is
affine on purpose, so parallel lines stay parallel; it is a tilt, not a
perspective projection, and at this blur level the difference is invisible.

Layout anchors are chosen in screen space and pulled back onto the plane through
the inverse matrix, so the composition can be art-directed directly while the
shapes still sit on the plane.

### Layer order

Stacking six 4K DOM canvases would be wasteful, so all elements draw into one
small set of contexts that the composition flattens in a fixed order:

    main            background plate and the fibre fan
    dof[0..2]       sharp / mid / far buckets: panels and their traces
    top             the chip, above the blurred buckets

Each child draws in its own `useLayoutEffect`. React flushes layout effects in
tree order — children before parents, siblings in render order — so
`<StageClear>` wipes the buffers first, the elements fill them in declaration
order, and `<ChipDashboard>`'s own effect runs last to flatten and finish. None
of those effects takes a dependency array: the draw must run on *every* render,
or a component whose props happened not to change would be left out of the
frame.

### The fibre funnel

The strand bundle is a funnel, not a spindle: a wide curtain that tapers the
whole way to a single tight focus at the chip's upstream face, where a hot spot
marks the convergence. Each strand is built from two 1-D Bezier profiles —
`spread` running 1 → 0 across the curtain, `advance` running 0 → 1 along the
axis — so every strand lands exactly on the focus by construction.

The curtain sits well outside the frame: the strands enter from off-screen and
only the converging part of the bundle is ever in shot. It has to sit far
enough out that *both* ends clear the frame edge, because the curtain lies on
the plane and therefore leans.

That lean does **not** mirror when the piece does — the plane transform is the
same for both variants, only the layout flips. So the strands nearest the frame
edge are the bundle's lower ones when the fan is on the left and its upper ones
when it is on the right, which drags the visible bundle down in one variant and
up in the other. The origin's vertical offset is therefore signed by
`flowDirection` like everything else, which puts the bundle across the chip's
own height in both. Leaving it unsigned is what makes the reversed version look
like it has come off the plane.

The funnel spreads along the plane's own y axis, so every cross-section of the
bundle recedes exactly like the panels and the connector traces do. Orienting
the curtain in screen space instead makes it stand up out of the plane and the
scene stops reading as one surface.

Hue is organised across the bundle rather than at random: cool on the outside,
warmer through the core, blowing out to the chip's own hue at the focus.

### Depth of field

Panels are bucketed into three offscreen buffers by depth and each buffer is
blurred exactly once at composite time (0 / 10 / 24 px at 4K). Blurring nine
panels individually at this resolution is not affordable. The far bucket is
composited a second time additively, because defocused highlights should gain
rather than just smear.

### Loop closure

Frame 0 and frame 372 are pixel-identical — verified by rendering both as PNG
stills from a temporary 373-frame composition and comparing checksums, with
frame 371 checked to differ so the loop is a real cycle rather than a frozen
frame.

Three things make that exact rather than approximate:

* Every periodic term is evaluated on `frame % 372` and uses an integer
  frequency, so frame 372 produces the same double as frame 0 rather than
  `sin(2πk)`, which is only approximately zero.
* Travelling-pulse periods are all divisors of 372 (62, 93, 124, 186).
* The background drifts by `DRIFT_STEP = (372, −93)` screen px over the loop —
  whole pixels, one 372nd per frame — and the texture plate is built by
  replicating its content at exact integer multiples of that same vector. A
  fractional step would land the final frame on a different sub-pixel phase and
  the loop would not close bit-for-bit. The vector's direction, −14.04°, tracks
  the plane's own x axis, so the texture slides along the plane rather than
  across it.

### Performance

The background plate, each panel sprite, the strand geometry and the grain tiles
are all built once in `useMemo` and reused. Per frame the work is: two blits for
the background, the strand undulation offset (the geometry itself is not
regenerated), one sprite blit per panel plus the few pixels that actually
change, three buffer blurs, and a quarter-resolution bloom pass.

The fibre glow accumulates one path per hue rather than one per strand — a real
blur 140 times a frame at 4K is not affordable, and a grouped path gives the
same soft bloom for three shadow operations. The sharp core is still drawn
per strand, because a single thick semi-transparent stroke reads flat.

## Notes

No real logos, no real code, no watermark, no audio. All panel text is
deliberately illegible — it is texture, not content.
