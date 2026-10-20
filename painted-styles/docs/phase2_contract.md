# Phase 2 scene-script contract (layered, bleed-aware, colourways)

Chosen styles: Watercolour (`watercolour`, file prefix `Watercolour`), Art Deco (`artdeco`, `ArtDeco`),
Stained glass (`stainedglass`, `StainedGlass`), Ink wash (`inkwash`, `InkWash`), Linocut (`linocut`, `Linocut`).

## Files (per style key `k`)
- `scripts/scenes/k_lake.py`   — scene A (keep the Phase 1 composition; extend it)
- `scripts/scenes/k_coast.py`  — scene B: a coastal village on a cliff, a lighthouse, sailing boats, gulls
- `scripts/scenes/k_forest.py` — scene C: a forest path through tall trees, sun rays, a deer in the distance

Every file exposes:
```python
STYLE = "Watercolour · 水彩"
COLOURWAYS = ("Day", "Dusk")          # exactly two; names become part of the still file name
GROUPS = (...)                         # layer groups, back to front (see below)
def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None,
          stages_dir=None, dense_stages=False) -> PIL.Image   # RGB, size = canvas (W,H grown by bleed)
```
- `include=None` means all groups; otherwise a set of group names. Groups not in `include` are skipped
  entirely, but **finishing passes (paper, print, lead, grain, vignette, film, etc.) always run.**
- Build the canvas with `S = drawkit.Scaler(W, H, bleed)`; construct the style class with `S.W, S.H`.
  Positions go through `S.x(), S.y(), S.pt(), S.pts()`; lengths/radii/widths through `S(v)`.
  Anything full-width (sky, ridges, water, mist bands, ground) must span the design range
  `S.X0..S.X1` × `S.Y0..S.Y1` so the bleed is painted, not empty paper.
- **Per-group RNG**: at the start of each group do `rng = drawkit.group_rng(seed, name)` and point the
  class's own generator(s) at a generator from it too (e.g. `p.rng = drawkit.group_rng(seed, name)`), and
  re-seed the same way (`'finish'`) right before the finishing passes. Result: skipping a group must
  not change a single pixel outside that group's footprint. Verify this (see checks).
- A group must not depend on another group having been painted. If the water group needs mountain or
  tree masks for reflections, compute those masks (cheaply, without painting) regardless of `include`.
- Scale lib knobs that are in pixels (tile/cell size, pen width, ss…) with `S.s` where it keeps the look.

## Layer groups for scene A (lake) — exactly these names, back to front
`sky` · `clouds` (new: 3–5 thin soft dusk clouds high in the sky, style-idiomatic) · `far` (far range) ·
`near` (near range + pines + shore) · `water` (water, its ripples and all reflections of sky/mountains/pines) ·
`mist` · `boat` (boat, rower and the boat's own reflection) · `birds` · `reeds` (foreground plants)

Scenes B and C are stills only — no groups needed beyond `GROUPS = ("all",)`, but still accept
`include=None`, `bleed`, `colourway`.

## Colourways
Two per style, e.g. `Day` and `Dusk`; or two palettes that suit the medium (ink wash: `BlackInk` and
`Indigo`; linocut e.g. `Vermilion` and `Indigo` second block). Scene A's Dusk (or equivalent) is the
look approved in Phase 1. All three scenes use the same two colourway names.

## Draw-on stages (scene A only)
With `dense_stages=True`, call `p.stage()` (or the lib's equivalent) often enough to give **40–60
snapshots** in true painting order (e.g. one per pine, per ripple batch, per mountain glaze, per bird),
written to `stages_dir` as `NNN_name.png` (3-digit, sequential), the last one identical to the final image.

## Rules
- Original compositions only; nothing recognisable as a known artwork. No text, signatures, frames.
- Do not edit `vendor/`. Deterministic (no time, no global random). numpy+Pillow only.
