# Third-party assets and licences

| Asset | Where | Licence |
|-------|-------|---------|
| Studio HDRI "Studio Small 03" (1k) | `public/hdri/studio_small_03_1k.hdr` | CC0 1.0 — Poly Haven. Details in `public/hdri/LICENSE.md` |
| Floor tiles (colour, roughness, normal) | generated in code, `src/scene/textures.ts` | Original to this project |
| PCB board, inner wall traces, brushed aluminium, frosted top | generated in code, `src/scene/textures.ts` | Original to this project |
| Shield-with-check mark | SVG path drawn in `src/scene/geometry.ts` | Original to this project (no icon library) |
| All 3D models (node, plinth, sockets, cables, floor) | built in code, `src/scene/geometry.ts` | Original to this project |

All textures are drawn at load time into canvases from seeded random numbers
(`mulberry32`), so there are no texture image files to ship; they come out
identical on every run.

Software dependencies (Remotion, three.js, react-three-fiber, drei,
postprocessing, React) keep their own licences in `node_modules`. Note that
Remotion needs a company licence for some commercial users:
https://www.remotion.dev/license
