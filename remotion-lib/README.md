# remotion-lib

Shared, deterministic 2D-canvas building blocks for Remotion pieces.

See [CATALOG.md](./CATALOG.md) for the full inventory and the contract every
module here obeys.

This directory is the canonical source. It is mirrored to
`~/projects/remotion-lib` in working environments, and vendored into each
consuming project's `src/lib/` by that project's `scripts/sync-lib.mjs`, so
Remotion can bundle it from the project root and each distributable archive
stays standalone.

To change a component: edit here, then re-run the consumer's sync script and
re-render to confirm the output is unchanged.
