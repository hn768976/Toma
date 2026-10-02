# Icon SVGs

One SVG per icon, drawn by hand for this project (no icon libraries, no brand
marks). The composition reads the file named in the icon's data row
(`svgPath` in `src/icons.ts`) and turns it into a solid, bevelled 3D shape at
load time.

## Authoring rules

- `viewBox="0 0 100 100"`. 100 units become `iconScale` world units (1.0 is
  about 18% of frame width).
- Draw **outlines with strokes**: `stroke-width="7"` (about 8% of icon height),
  `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`.
  Thinner inner details (5–5.5) are fine.
- Solid dots: `fill="#fff" stroke="none"` (e.g. `<circle r="5"/>`).
- Supported elements: `path` (incl. arcs/curves), `circle`, `ellipse`, `rect`
  (with `rx`), `line`, `polyline`, `polygon`, `transform`.
- Colours in the SVG are ignored. The gradient comes from the shader.
- Leave at least about 4 units between separate strokes so they don't merge.

### Two extra attributes

| Attribute | Use | What it does |
|---|---|---|
| `<g data-outline="1" fill="#fff">…</g>` | clouds, blobs | The group's **filled** shapes (circles, rects…) are merged, and only the merged outline is stroked. |
| `<g data-knockout="4.5">…</g>` | overlaps | Before the group is added, everything drawn **earlier** is cut away around it with a 4.5-unit gap (front speech bubble over the back one, arrow through the cloud). |

The conversion: strokes become offset polygons (Clipper, round joins and
caps), fills become polygons. Everything is unioned into clean, non-overlapping
shapes with holes, then passed to `THREE.ExtrudeGeometry` (depth 12% of icon
height, rounded bevel).
