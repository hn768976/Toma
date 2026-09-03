# remotion-lib

Reusable, palette-agnostic pieces for deterministic 2D canvas work in
Remotion. See [CATALOG.md](./CATALOG.md) for the catalogue.

This is the shared library the node-hub compositions in `../remotion-video`
were built against. Consumers **vendor** these files (copy them into their own
`src/`) rather than depending on a package, so a project can be zipped and
rendered standalone — `remotion-video/src/lib/` is that copy.

Anything added here must be deterministic (no `Date.now()`, no
`Math.random()`, no `requestAnimationFrame`, no state), hold no colour value
of its own, and import no project constant.
