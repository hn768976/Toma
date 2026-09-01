# remotion-lib

Shared components for the Remotion stock-footage projects in this repo.
A local folder future projects read from — not published, not versioned.

**→ [CATALOG.md](./CATALOG.md) is the file to read.** It lists every component
with its parameters, defaults, which projects it came from, a usage snippet and
its gotchas. This README is only the ground rules.

## Where this came from

The 78 `claude/*` branches in `hn768976/Toma` are separate Remotion projects.
Surveying them turned up the same techniques rebuilt over and over — and almost
never copied. `grainPass` appeared in 57 projects, `vignettePass` in 55,
`neonStroke` in 51 across **122 distinct implementations**. Each one had been
retyped from scratch.

18 components were extracted. Nothing that appeared in fewer than 2 projects was
taken (see *Deliberately NOT extracted* in the catalog).

No existing project was modified. Migration is a separate job.

## Rules every component follows

- **Pure.** No internal state, no `Date.now()`, no `requestAnimationFrame`.
  Everything takes a frame number or a progress value and returns a result.
- **Deterministic.** Same seed and frame → identical output, every render, every
  machine. Remotion renders frames out of order across workers, so anything else
  pops.
- **Fully parameterised.** Where projects disagreed on a value it became a
  parameter, defaulting to the most common one.
- **Typed.** Explicit prop and argument types. No `any`. `tsc --strict` clean.
- **Palette-agnostic.** No colour is baked in anywhere. Every component takes
  its colours as parameters.
- **Documented.** Every file carries a docblock: what it does, what it is for,
  what each parameter means, a usage example, and the gotchas.

## Layout

```
remotion-lib/
  src/
    random/       seeded helpers, radial placement, irregular dashes
    geo/          projection setup, dot-map generation
    effects/      DOF buffers, grain, vignette, bloom, low-res upscale
    strokes/      neon, tapered, draw-on
    generators/   recursive branching, price series, particles from a mask
    shapes/       blob paths, torn edges
  demo/           one composition per component
  CATALOG.md
```

## Using it

```ts
import { neonStroke } from '../../remotion-lib/src/strokes';
// or, with a path alias to remotion-lib/src:
import { neonStroke, mulberry32 } from 'remotion-lib';
```

Subpath imports (`remotion-lib/strokes`, `/effects`, `/geo`, …) are declared in
`package.json` exports. The library ships TypeScript source, not a build — these
are local projects and there is nothing to publish.

Only dependency: `d3-geo` (used by `geo/` alone).

## Demo

```bash
cd demo && npm install
npx remotion studio                                        # browse all 18
npx remotion render LibDemo out/lib-demo.mp4 --codec=h264 --crf=18
```

30 seconds, 1080p, ten sections. Every component also renders standalone — a
component that cannot be demonstrated in isolation is not properly
parameterised.

The demo bakes `world-atlas` land into `demo/src/land.ts` so it renders offline
and deterministically. Regenerate with `node demo/scripts/bake-land.mjs`. **The
library itself bundles no data** — pass your own GeoJSON to `fitProjection`.

### In this sandbox

Remotion's Chrome download host is not on the proxy allowlist. Point it at the
preinstalled Chromium instead:

```bash
npx remotion render LibDemo out/lib-demo.mp4 --codec=h264 --crf=18 \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```
