# Vendored from remotion-lib

These modules are the reusable, palette-agnostic half of this project,
extracted into a shared library and copied back in so each distribution zip
stands alone. Nothing in here knows about the node-hub variants: no colour
value, no icon name and no label copy appears below this directory.

Do not edit these files to change how a variant looks — change the variant
config in `src/node-hub/variants.ts`, or the project-side adapters in
`src/node-hub/`, which bind these generic modules to this project's constants
and icon registry.

See `CATALOG.md` in the library for the full catalogue.
