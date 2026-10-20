You are extending procedural scene scripts for a stock-art project. Project root:
/home/user/Toma/painted-styles (Python venv `.venv`; run everything as `.venv/bin/python` from the project
root). The drawing skill is vendored read-only at vendor/claude-drawing-skill (lib/ + examples/; its
SKILL.md is in Chinese — grep its "## 三、毛病清单" problems list for your style).

Read first: docs/phase2_contract.md (the contract — follow it exactly), scripts/drawkit.py, your style's
existing scripts/scenes/<key>_lake.py (Phase 1, approved look), docs/scene_lake_spec.md, and your
style's lib + example.

Deliver for your ONE style:
1. Rework scripts/scenes/<key>_lake.py to the contract: bleed, groups (incl. new `clouds`), per-group RNG,
   two colourways, dense draw-on stages. With colourway=<the Phase 1 one>, bleed=0, include=None the
   result should look like the Phase 1 image (it needn't be byte-identical).
2. Write scripts/scenes/<key>_coast.py and scripts/scenes/<key>_forest.py (scenes B and C), both
   colourways, same quality bar as the lake: clearly readable scene, style-faithful, no muddy colours,
   broken shapes or smears. Iterate looking at renders (Read tool on the PNG), 2–4 rounds each.

Checks you must run and report (save scratch to
/tmp/claude-0/-home-user-Toma/9d926092-8916-59f8-b78b-43bf9f1ef0b0/scratchpad/p2_<key>/ — make your own
subfolder; other agents share the scratchpad):
- Group independence at 960x540 with bleed=0.1: for each group g, render include=all-groups-up-to-and-
  including-g in GROUPS order (prefix) and the prefix without g; pixels outside g's footprint (dilate the
  diff mask by ~6px) must be identical — report the max abs diff outside the footprint per group.
- Bleed: at bleed=0.1 the border region must be painted scene, not empty paper/edge artefacts.
- Determinism: two identical renders give identical sha256.
- Dense stages: count, and that the last equals the final.
Iterate at 960x540; do a final look at 1920x1080 per scene/colourway. Never render above 1920x1080 and
never run more than one render at a time (4 cores shared by 5 agents). Don't commit to git.

Report back concisely: files written; per scene/colourway one honest quality line; group-independence
numbers; stage count; paint times at 1920x1080; anything that didn't work.
