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

### Round 1 fixes — Stained glass
Voronoi replaced by designed cut lines that follow the forms (sky rows arching over the glow, mountain strata and
spur leads, water rows growing toward the viewer, cliff strata, converging path strips); aspect/min-width limits and
merging remove uncuttable slivers; leads vary in width with rounded came and solder blobs at every joint; per-piece
glass types (cathedral, streaky, seedy, opalescent, reamy) with own shade/density; clouds, sun glitter, reflections,
boat, rower, pines, reeds cut in glass with their own leads; grisaille only for fine detail. Draw-on in workshop
order: cartoon → cut glass laid with gaps → grisaille → leading → solder → daylight. Saddle bars not added
(would cross the stock image and be baked into every parallax layer).

## Round 2 — verdicts
frame_1 watercolour: PARTLY · frame_2 Art Deco: FAKE · frame_3 ink wash: PARTLY · frame_4 stained glass: FAKE ·
frame_5 watercolour draw-on: FAKE as in-progress · frame_6 glass draw-on: FAKE · still_1 watercolour: PARTLY ·
still_2 Art Deco: FAKE · still_3 ink indigo: PARTLY · still_4 linocut: MOSTLY CONVINCING (best of set).
Findings caused by my compositor (fixed by me): water shimmer displacement too strong/high-frequency (stair-step
"displacement filter" reflections) → 2.5 px, broader noise; stained-glass light sweep read as airbrushed hotspots →
glass-only multiplicative brightening; ink-wash mist matte carried tree residue → ghost trees when drifting → correction
may only lighten; all stills shared one paper texture (same seed) → per-scene seed.
Remaining findings sent back to the style agents (round 2 fixes below).

### Round 2 fixes — Linocut
Minimum key-block line ~5–7.5 design px (anything under 4.6 px prints broken); finest details simplified (sun ring,
lighthouse posts, glazing bars); visible ink mottle, starved paper grain, fuzzy edges and gouge chatter in solids;
colour block offset (10, −7) px and turned 0.22° so it overlaps/gaps visibly; every cottage individual; gouge rows
with per-row scale, short flicks/jabs and patchy density.

### Round 2 fixes — Watercolour
Granulation follows pigment load (pale washes smooth, raw-sheet shading 0.14→0.05); reserved-paper lights via a
`hold=` reserve instead of opaque white dashes; stronger wet-in-wet sky with blooms, tide lines and back-runs;
dried rims vary/lose along edges; pencil as an under-layer that vanishes under darks (no halos); more varied pines;
boat/rower/oar as wet strokes bleeding into the water; tapered reeds and dry-brushed bank; underdrawing first in
the draw-on; coast houses back-to-front solid, reserved-paper clouds, wobbly lighthouse, lifted sails, cliff base
bleeding into the sea, clustered dry-brush cliff marks, wet-painted rocks.
