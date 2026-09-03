# remotion-lib

Shared, reusable Remotion pieces. Everything in `src/` is meant to be
copied or imported into a project unchanged, so each entry must be:

- **fully parameterised** — no hard-coded sizes, counts or timings;
- **palette-agnostic** — colours arrive as props or as a supplied function;
- **deterministic** — a pure function of the frame number and its inputs,
  using Remotion's `random()` with stable string seeds, never
  `Math.random()`, `Date.now()`, `requestAnimationFrame` or component
  state. Remotion renders frames in parallel and out of order, so
  anything else desynchronises from the frames it was drawn on.

See `CATALOG.md` for the index. Read it before building anything new.

## Typechecking

`tsconfig.json` here is for checking the entries in isolation. It needs
React and Remotion types to resolve, so `node_modules` is a symlink to a
consuming project's install rather than a dependency set of its own:

```
ln -sfn /path/to/a/remotion/project/node_modules node_modules
npx tsc
```
