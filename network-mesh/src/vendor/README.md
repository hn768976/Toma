# vendor/

Copied verbatim from the shared `remotion-lib` (see its CATALOG.md). Vendored
rather than depended on so this project is standalone. Palette-agnostic and
frame-pure: every colour arrives as a prop and every value is a function of
the frame number.

- `core/` seeded random, colour and canvas helpers
- `mesh/` node-field geometry, `<NodeMesh>`, `<FacetLayer>`
- `light/` `<AnamorphicFlare>`
- `atmosphere/` `<BokehLayer>`, `<PostFx>`
