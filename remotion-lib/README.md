# remotion-lib

Shared building blocks for Remotion canvas pieces.

**Read [`CATALOG.md`](./CATALOG.md)** — it is the index: every component and
helper, with parameters, defaults, a usage snippet, the gotchas, and which
project first used it.

## House rules

Everything in `src/` is:

- **deterministic** — a pure function of a frame number and a stable string
  seed. No `Math.random()`, no `Date.now()`, no `requestAnimationFrame`, no
  component state. Remotion renders frames out of order across workers, so
  anything else flickers between frames.
- **palette-agnostic** — every colour is a parameter. No hex literals.
- **fully parameterised** — no subject-specific constants baked in. If a value
  only makes sense for one project, it does not belong here.

## Consuming it

This is a source-only library — there is no build step and no published
package. Projects vendor the sources so their own shipped zip stays
standalone, using a sync script that treats this directory as canonical:

```bash
node scripts/sync-lib.mjs          # library -> project src/lib
node scripts/sync-lib.mjs --check  # fail if they have drifted apart
```

Edit the library, then re-sync. Never edit a project's vendored copy directly.

Types are checked through the consuming project, which supplies `react` and
`remotion`.

## Contributing

Extract something only when it is fully parameterised, palette-agnostic,
deterministic and plausibly reusable. Strip the hardcoded colours into
parameters, write a docblock, add a `CATALOG.md` entry, then import it back so
the originating project uses this version rather than a copy — and confirm its
render is unchanged.

If you cannot fully parameterise it, or it is specific to one subject, leave it
in the project and note it as a candidate instead.
