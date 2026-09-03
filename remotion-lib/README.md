# remotion-lib

See [CATALOG.md](./CATALOG.md).

Read the catalogue before starting a new piece and reuse whatever fits.
After a build ships, extract anything that is fully parameterised,
palette-agnostic, deterministic and plausibly reusable back into `src/`,
add a docblock and a CATALOG.md entry, then vendor it into the project so
the project's zip stays standalone.

## Where this lives

The canonical location a build reads from is `~/projects/remotion-lib`. This
copy is committed to the repo so the catalogue survives ephemeral working
environments — sync the two when you add a module.
