# remotion-lib

Shared components for Remotion stock-footage projects. A local folder, not
an npm package — future projects import from it by relative path.

**Start with [CATALOG.md](./CATALOG.md).** It lists every component with its
import path, parameters, defaults and gotchas, and is written to be
skimmable in about ten seconds per entry.

---

## Provenance — read this before trusting a default

This library was **written from specification**, not extracted from a
working corpus. That distinction matters and is recorded per component in
CATALOG.md's *Provenance* column.

The session that built it had access to exactly one Remotion project
(`remotion-video`, containing two unrelated builds: a hand-drawn SVG
explainer and a canvas particle-ring). The ~20-project corpus the
extraction was meant to draw on was never reachable. So:

| Provenance | Meaning | Count |
|---|---|---|
| **Extracted** | Lifted from real project code that existed and worked. | 2 |
| **Adapted** | A real implementation existed; reworked here for purity or parameterisation. | 4 |
| **Spec** | Written from a description of the technique. Correct as written and demonstrated, but its defaults are reasoned, not measured. | 19 |

**What this means in practice:** every component typechecks, is pure, and is
demonstrated working in isolation in `demo/`. But for a *Spec* component,
nobody has yet checked its default against the values real projects used,
because those projects were not available. Treat *Spec* defaults as
starting points. When you use one against a real shot and find the default
wrong, change it here and note it — that is how this library earns the
authority it does not have yet.

The one component found genuinely duplicated across projects is
`loopPhase` (three copies, two builds). It is marked *Extracted*.

---

## Conventions

Every file in `src/` follows these. Breaking one is a bug.

**Pure.** No component holds state, reads `Date.now()`, or schedules
`requestAnimationFrame`. Nothing in `src/` calls `useState`, `useEffect`,
`useRef` or `useLayoutEffect` — verifiable with a grep.

**Time enters as a parameter.** Either `frame` (integer) or `progress`
(0..1). Never both, never implicitly.

**Deterministic.** Randomness comes from `seed`. The same seed and frame
produce byte-identical output on any worker, in any render order. This is
not a style preference: Remotion renders frames out of order in parallel,
so anything drawn from `Math.random()` differs between frame 40 and frame
41 and the result visibly boils.

**Palette-agnostic.** No colour is baked in anywhere. Not one hex code,
`rgb()` or `hsl()` literal appears in `src/` outside a docblock. Colour
parameters that have no sensible neutral are *required*, so you cannot
forget to pass one and silently get someone else's brand blue.

**Typed.** Explicit prop and argument types. No `any`. `tsc --noEmit`
passes with `strict: true`.

**Documented.** Every file opens with a docblock covering what it does,
what it is for, what each parameter means, at least one gotcha, and a
minimal usage example. Where a component exists to avoid a specific
failure — a rosette, a ladder, a flat noise walk — the docblock says what
the failure looks like and why the obvious implementation produces it.

---

## Layout

```
src/
  types.ts       Point, Rect, Color, Rng — the shared vocabulary
  random/        seeded helpers, loop cycles, anti-regularity placement
  geo/           projections and dot-map generation
  effects/       full-frame canvas passes (DOF, bloom, grain, vignette)
  strokes/       neon, taper, draw-on, scale-corrected widths
  generators/    branching, walks, noise fields, mask sampling
  shapes/        SVG path builders
demo/            one composition per component
```

Import from a subpath so a composition pulls in only what it uses:

```ts
import { loopPhase } from "../../remotion-lib/src/random";
import { NeonStroke } from "../../remotion-lib/src/strokes";
```

The root barrel (`src/index.ts`) re-exports everything, for discovery.

---

## Renderer split

Knowing which kind of thing you are calling saves reading the signature:

| Module | Returns |
|---|---|
| `random`, `generators` | plain data (numbers, points, series) |
| `shapes` | SVG path **strings** — style them where you use them |
| `effects` | mutate a `CanvasRenderingContext2D`, restoring every property they touch |
| `strokes` | mixed: `NeonStroke` is a React component, `drawOn`/`strokeFor` are functions, `taperedStroke` returns path data |
| `geo` | plain data; does **no I/O** and ships no map data |

---

## Performance rules

Two mistakes account for nearly every slow Remotion render:

**1. Calling a generator per frame.** Everything in `generators/`, plus
`dotMapFromLand`, is meant to be called **once**, in a `useMemo`. Animate
by moving what it returned. Re-running them per frame is both slow and
wrong-looking — the figure boils because each frame gets a different one.

**2. Per-element filters.** Setting `ctx.filter = "blur(...)"` per particle
forces a filter region allocation per element. Use `threeBufferDOF` or
`bloomPass`, which blur whole buffers a fixed number of times regardless of
element count.

Also: **blur radii and stroke widths are in device pixels** and do not
survive a resolution change. Multiply them by your resolution scale, or a
4K render gets half the apparent blur of the 1080p one.

---

## Demo

```bash
cd demo
npm install
npm run dev                    # studio: every component as its own composition
npm run render                 # 1080p h264 reel of all 22 panels
```

If Remotion cannot download Chrome Headless Shell (a restricted network,
for instance), point it at a local browser:

```bash
npx remotion render LibDemo out/lib-demo.mp4 --codec=h264 --crf=18 \
  --browser-executable=/path/to/headless_shell
```

The demo defines its own palette in `demo/src/theme.ts` and passes every
colour into the library as a parameter. That file is the worked example of
palette-agnosticism — swap its values and all 22 panels re-skin with no
library change.

---

## Adding to this library

Two rules, inherited from the brief that created it:

- **Do not add anything used in only one project.** Single-use code belongs
  in its project.
- **Do not add anything you cannot fully parameterise.** A component with a
  hardcoded assumption is worse than no component, because the next person
  has to discover the assumption before they can trust anything.

When you add something, give it a CATALOG.md row, a docblock in the house
style, and a demo panel. If it cannot be demonstrated in isolation, it is
not properly parameterised yet.
