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
