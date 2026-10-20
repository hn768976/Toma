# Anatomy notes

Pinned: `wheresryan22/anatomy` at commit `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`
(`v1.1.0-53-g1482e84`, 2026-10-18, "Printable sheets: A4 and Letter PDFs from any figure (#126)").
Licence: MIT, © 2026 Ryan — copied to `LICENSES/anatomy-MIT.txt`. The kit is vendored in
`vendor/anatomy/` (everything but `.git`).

## What was read

`SKILL.md`, `README.md`, `LICENSE`, every file in `kit/` (the large 3D runtime files
`turn.mjs` and `turn-fixed.mjs` skimmed), every reference in `references/`, and the examples
(`dial-indicator`, `desk-computer`, `arcade-cabinet`, `raptor-engine`, `ripple-tank`,
`push-button`, `turning-dial`, `test-rig`, `spot-plate`).

Workflow followed from the skill: truth first (the historical design and real physics:
gravity, rolling at 5/7 g, hinge stops), invent the object (five machines, each a dense
real build: plinths on feet, A-frame trestles, pillow blocks, collars, pegs, hoops), build
geometry once with the kit (`slabOf`, `cylinder`, `extrude`, `G.disc`, `G.prismOf`,
`G.sphereOf`, `G.arcOf`, `T.tubePieces`, `knurl`, `sideArc`, `sideSeam`), paint back to
front, and verify by zooming in. Parts the skill builds for an interactive card (the card,
corner labels, legend, readout, hover) are left out: the brief forbids any text.

## The three questions, from the example SVGs (`examples/dial-indicator/dial-indicator-light.html`)

**Are parts in separate named groups?** No. A built figure is one flat run of about fifty
anonymous `<g class="iso-solid">` groups (each solid's fill, four shade sheets, top, crease
and edge paths) plus loose `<path class="iso-line">` and `<g class="iso-dots">`. There are
no `id`s. Only the three live parts of that example carry a `data-part` attribute, added by
hand in its `build.mjs` so its script can find them.

**Does it give pivot points?** No. Nothing in the SVG records a centre, axis or plane. Live
parts are moved by rebuilding their path each frame (the dial's needle via `lineOnTop`, the
arcade coin via `G.disc` on a rotated frame) or by `translateAlong`. The kit does provide
`sideMatrix` / `topMatrix`, affine matrices that put flat drawing onto a face.

**Are paths already projected to isometric?** Yes. Every coordinate is a screen coordinate
(`iso()` applied at build time, rounded to 0.1 px), so a part cannot be rotated in its own
plane by transforming its path.

## What was changed to animate it

- **Static parts** (bases, trestles, posts, tanks, ramps, chutes, the glass) are drawn by the
  kit in each machine's camera, exactly as anatomy draws them.
- **Turning parts** (wheels, hammers, spokes, gears, the crown, the lantern, the millstone's
  dressing, pegs) are rebuilt in **flat coordinates** of their own plane, in anatomy's
  style (the same line weight, tone classes and colours), and placed in the video with
  `transform = isoFace · rotate(θ)`. `isoFace` is the affine map of that plane from the kit's
  own camera (`src/lib/iso.ts`, `faceAffine`, the same idea as the kit's `sideMatrix`, for
  any plane). Thickness comes from stacking copies of the flat part along the plane's
  normal (back outline, side tone, front face), all with the same transform.
- **Balls** are spheres, which project to circles, so only their centres go through the
  plane's matrix.
- `scripts/build-art.mjs` writes each machine's raw anatomy-style SVG with parts marked
  `data-part` (anatomy's own convention). `scripts/split-parts.mjs` then:
  1. splits it into one named group per part (`id="<machine>-<part>"`);
  2. records each turning part's plane and pivot (`data-face`, `data-along`) and places it at
     rest in `art/svg/<machine>.svg`;
  3. fixes two kit quirks (below) and drops anatomy's blurred `iso-halo` paths (the video
     draws its own dithered floor shadows);
  4. writes `src/generated/<machine>.ts` for React.
- Anatomy's monochrome tone tokens (`--anatomy-*`) are replaced by a material palette
  (`m-brass`, `m-oak`, `m-iron`, …) over the same class names (`src/lib/look.ts`), one table
  per look (Workshop, Blueprint).
- The kit's `vector-effect: non-scaling-stroke` 0.6 px lines are kept, scaled to the
  3840-wide composition (3.6 px, anatomy's 0.6 px on a ~600 px card).

## Things in the skill that did not work well here

- **`G.prismOf` fills and outlines with the convex hull**, so a gear outline drawn with it
  loses its teeth. Gears are drawn flat instead.
- **`ringBand` / `lathe` with a hole**: the hole is wound the same way as the hull and
  `solidSvg` sets no fill rule, so the hole stays filled. For a ring on a vertical axis
  (the flask's ring stand) the fill and side shades also span the hole. Fixed by building a
  washer from `k.cylinder` with the hole cut (`scripts/art/common.mjs`, `washer`) and by
  `evenodd` on multi-subpath fills and tops in `split-parts.mjs`.
- **`figureSvg({ standalone })`** writes `data-theme="true"` (the theme name is lost), so the
  light tokens never apply to a standalone SVG.
- **Stroke weight**: `.iso-svg path { vector-effect: non-scaling-stroke }` with 0.6 px lines
  is a hairline at 4K; video needs the weight scaled.
- **Wall-clock CSS animation** (`data-flow` dashes and `pulse` dots run on 1600 ms CSS
  keyframes) is not frame-driven, so it cannot be used in Remotion; flow dashes are driven by
  the frame number instead.
- The 3D mode (`kit/turn*.mjs`) needs a DOM runtime, turns continuously only about vertical
  axes, and its audit takes 15–20 min per figure; not suited to frame-by-frame video of
  horizontal axles, so the flat-plane approach above was used.
- `kit/audit.mjs` and `scripts/lines.mjs` assume the interactive page workflow; the
  machines here were checked by renders and close-ups instead.
- `references/3d.md` says there is no canvas painter, but `kit/canvas-painter.mjs` exists
  (listed as experimental in the README); it also cites `3d/engine/plants.mjs`, which is not
  in the repository.
