# Hand-made check, round 1: fixes to make (all styles)

An independent reviewer judged frames and stills as mostly "computer-generated". Fix these in your
style's scripts (lake, coast, forest), keeping the Phase 2 contract (docs/phase2_contract.md): same GROUPS,
per-group RNG, group independence = 0 outside footprint, bleed, determinism, dense stages, both colourways.
No lettering/text/borders (stock backgrounds) even if that would be "period-correct".

Generic (every style):
1. **No clones.** Every pine, cloud, bird, house, tuft, wave mark, water dash must vary per instance:
   shape, proportion, lean, asymmetry, tier spacing, stroke weight, spacing (irregular, clustered, not evenly
   scattered). Pines especially: not stacked identical triangles on a ruler-straight trunk.
2. **No digital-filter tells.** Reflections must not be a flipped, blurred copy: build them in the medium
   (broken horizontal strokes/washes/carved lines/glass pieces, with gaps, shorter and paler than the object).
   Mist must not be a plain Gaussian band: make it in the medium (lifted/reserved paper, soft wash with ragged
   edges, carved/printed band with texture, opal glass). No straight digital god-rays; no cylinder gradient
   shading; no "ripple filter" water.
3. **Texture from the marks, not an overlay.** Use the lib's own per-mark effects (granulation, blooms,
   back-runs, hard dried edges, dry-brush breaks, ink starvation, chatter, speckle following density).
4. **Primitives in the medium.** The boat, rower, sails, houses, lighthouse must be painted/carved/cut in the
   medium with wobble and wear, not clean vector shapes (no circle-head + rectangle-body rower).
