You are writing procedural scene scripts for a style audit. Project root:
/home/user/Toma/painted-styles (Python venv at .venv; run everything with
`.venv/bin/python` from the project root). The drawing skill is vendored at
vendor/claude-drawing-skill (READ-ONLY: never edit vendor/). Its SKILL.md is huge and in
Chinese; grep it for your style's section in "## 二、接口速查" (API) and
"## 三、毛病清单" (known problems list) rather than reading it all. Read your style's
lib file and its example script in vendor/claude-drawing-skill/examples/ — the example
is the quality benchmark and shows idiomatic API use.

Read first: docs/scene_lake_spec.md (the composition), docs/scene_script_contract.md
(file contract), scripts/drawkit.py (helpers).

For EACH style assigned to you, write scripts/scenes/<key>_lake.py painting the lake
scene in that style, faithfully using that library's own primitives/look (adapt the
example — don't reimplement the style yourself with raw numpy unless the lib truly has
no primitive for an element; if so keep it in the style's idiom).

Process per style:
1. Iterate at 960x540 (fast) — render, open the PNG with the Read tool, check against the
   spec and the style's problems list; 2–4 rounds, fix the most visible issue each round.
2. Final render at 1920x1080 to audit/<key>.png, timing it (time.perf_counter around
   paint()). Then look at it once more.
3. Render it twice at 960x540 with the same seed and confirm the two PNGs are
   byte-identical (sha256). Save scratch output under
   /tmp/claude-0/-home-user-Toma/9d926092-8916-59f8-b78b-43bf9f1ef0b0/scratchpad/<key>/.
The machine has only 4 cores shared with 4 other agents doing the same: never run more
than one render at a time yourself, and don't render above 1920x1080.

Return, per style, exactly:
- key, exact repo display name, lib/class
- 1080p paint time (s)
- one honest line on how good it looks (be critical; would it sell as a stock background?)
- problems seen (muddy colours, artefacts, broken shapes, things the lib couldn't do,
  anything not resolution-independent, any global-RNG use you noticed in the lib)
- whether stage() snapshots worked and how many stages you emitted
Do not commit to git.
