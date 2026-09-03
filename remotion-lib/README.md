# remotion-lib

Shared, deterministic canvas components for Remotion pieces.

> Canonical location is `~/projects/remotion-lib`, which is outside any
> repository. This copy is committed here so the modules survive — keep the
> two in step.

Every module here is:

- **parameterised** — colours, sizes and cadences are arguments, never
  literals baked into the component;
- **palette-agnostic** — nothing knows what a project's palette looks like;
- **deterministic** — no `Date.now()`, no `Math.random()`, no rAF, no state.
  Seeded values go through `seeded.ts`, which wraps Remotion's `random()`.
  Frames render out of order across workers; anything that is not a pure
  function of its inputs shows up as flicker.

See `CATALOG.md` for what is in here.

## Using it

There is no package publish step. Projects **vendor** the modules they need
into their own `src/lib/`, so a project directory stays standalone and
shippable as a zip:

```sh
cp ~/projects/remotion-lib/src/{color,seeded,marks,dofBuffers,postFx}.ts \
   ~/my-project/src/lib/
cp ~/projects/remotion-lib/src/{TiltedPlane,PanelChrome}.tsx \
   ~/my-project/src/lib/
```

When you change a module here, re-copy it into the projects that use it and
confirm their previews are unchanged before committing.
