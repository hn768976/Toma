# Hand-made check (fresh sub-agent per round; given only 6 frames + 4 stills)

## Round 1 — verdicts
frame_1 watercolour: PARTLY · frame_2 Art Deco loop: FAKE · frame_3 ink wash: PARTLY→FAKE · frame_4 stained glass: FAKE ·
frame_5 watercolour draw-on: PARTLY (not honest "in progress") · frame_6 stained-glass draw-on: FAKE ·
still_1 watercolour coast: PARTLY · still_2 Art Deco forest: PARTLY · still_3 ink-wash forest (indigo): FAKE ·
still_4 linocut coast: closest to convincing (partly).

Main findings: global grain overlay instead of mark-based texture; cloned pines/clouds/birds/houses/tufts/dashes;
flip-and-blur reflections, Gaussian mist, ripple-filter water (Art Deco), cylinder-gradient trunks and straight
god-rays (ink forest); Voronoi glass with uncuttable slivers and painted overlays (clouds, glitter ellipses,
boat) crossed by leads; vector primitives (circle+rectangle rower, pawn rower, box houses); draw-ons not
honest (watercolour starts finished-looking without underdrawing; glass shows overlapping blended pieces).
Declined: adding lettering/borders for period cues (stock backgrounds must stay text-free).

Fixes: per-style rework of all 15 scene scripts (see docs/handmade_round1_brief.md and the per-style notes below).

### Round 1 fixes — Art Deco
Sunburst built ray by ray (unequal widths/tones, one knife edge + one oversprayed edge); clouds = stacked hand-cut
stencil lumps (no inner hairline); mountains with one consistent sun-side light and varied creases/sub-facets;
even grain replaced by droplet speckle following spray density; lib ripple-displacement water replaced by
stencilled horizontal strips sprayed with the reflected colour (never an image copy); varied pines (3–6 tiers,
asymmetric, lean); cut-shape rower and per-bird wing poses; mist sprayed down from a hand-cut edge; limited
period palette with stepped sky bands; forest trunks/agaves/shadows/canopy all varied, hand-cut light wedges.

### Round 1 fixes — Linocut
Lib's even hatch replaced by form-following gouge rows (irregular spacing, per-mark width/taper, slips); silhouettes
re-cut as knife facets with nicks; reflections carved as broken strokes (no flipped block); baren pressure gradient,
ink starvation, brayer lanes, plate wear in solids; vermilion block with uneven film and larger fixed misregistration;
waves, birds, clouds, ferns, tufts varied per instance; thin lines now >=2.6 px fragile ridges printing broken;
pines individual; mist cleared with a U-gouge; forest rays waver and break.

### Round 1 fixes — Watercolour
New per-mark wash engine (_watercolour_kit.py): patchy pigment, wet-in-wet drop-ins, density-driven granulation,
varying dried edges and pooling, irregular back-runs, uneven lifting; paper grain halved. Varied clouds, pines built
tree by tree as one wet wash per island (no stacked opacity, ghost tree gone), reflections as sampled horizontal
strokes (no mirror blur), clustered lifted water marks, mist as ragged lifted veils, real seated rower and wobbly hull,
tapered reeds, varied birds. Draw-on now opens with a pencil underdrawing on raw paper and shows real unfinished
passes. Coast: hand-nudged houses with individual windows, banded lighthouse with lifted beam, bowed sails,
angular rock clusters, varied bushes. Forest: clumped varied trunks, lifted broken light shafts, varied ferns/tufts.

### Round 1 fixes — Ink wash
Mountains as 2–4 overlapping glazes with ragged wet/tide-line edges, pooling, dry-brush breaks, blooms
(replacing lib gradient wash); cun/dian placed by form; even-width ridge outline removed; xuan fibre paper with
absorbency; ink colour follows dilution (no duotone); pale wet-wash sky with a pale sun (no radial glow);
four tree types with irregular tiers; reflections as broken horizontal strokes over a pale broken wash; water
mostly bare paper with clustered varied dashes; varied birds. Indigo forest: side-brush trunks with dry streaks,
varied branches, ragged wash shadows, god-rays removed (light from reserved paper and mist).
