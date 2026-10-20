# Painted Styles — claude-drawing-skill stock project

Procedural "hand-painted" landscapes painted on the CPU with
[claude-drawing-skill](https://github.com/cloveric/claude-drawing-skill) (numpy + Pillow, no image model), animated as
painted layers in Remotion (WebGL2).

- **Skill commit (pinned):** `24418f3f61963ea6c4964537dad732c4ad7467c6` — MIT, licence in `licenses/claude-drawing-skill-LICENSE.txt`
  (and `vendor/claude-drawing-skill/LICENSE`). The repo had **74** styles at this commit (advertised as 63); list in `docs/styles.md`.
- **Styles chosen:** Watercolour, Art Deco, Stained glass, Ink wash, Linocut.
- **Deliverables:** 5 × `Painted_<Style>_LakeLoop` (20 s seamless), 3 × `Painted_<Style>_DrawOn` (12 s: Watercolour,
  Ink wash, Stained glass), 30 stills `stills/<Style>_<Scene>_<Colourway>.png` (3840×2160), `StillsSheet.png`,
  `StyleAudit.png` + `audit/` (Phase 1).

## Layout

```
scripts/paint.py          all painting (Phase 1 audit, Phase 2 layers / draw-on frames / stills, sheets)
scripts/scenes/           one script per style × scene: <key>_lake.py, <key>_coast.py, <key>_forest.py (+ per-style kits)
scripts/layers.py         cuts a painting into transparent layers (see "How the layers are made")
scripts/drawkit.py        seeding, bleed-aware design->canvas scaler, byte-stable PNG writer
remotion/                 Remotion 4 project; src/gl/ = WebGL2 compositor, public/ = painted layers + draw-on frames
docs/                     audit, contracts, check logs, timings, hashes
```

## Python setup

Python ≥ 3.10 (developed on 3.13).

```bash
scripts/setup_vendor.sh          # clones the skill at the pinned commit (skip if vendor/ already exists, e.g. from the zip)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt     # numpy==2.5.4, pillow==13.0.0
```

## Re-painting

Everything is painted at build time with fixed seeds; Remotion only loads images.

```bash
.venv/bin/python scripts/paint.py layers  [--keys watercolour,...] [--jobs 3]   # 4K layers + draw-on frames + manifest
.venv/bin/python scripts/paint.py stills  [--keys ...] [--jobs 3]               # 30 stills at 3840x2160
.venv/bin/python scripts/paint.py stillsheet                                     # StillsSheet.png
scripts/repaint.sh <key> [jobs]                                                  # one style from scratch (clears its caches)
.venv/bin/python scripts/paint.py audit|sheet                                    # Phase 1 audit (20 styles, 1080p)
```

Painted layers go to `remotion/public/layers/<key>/` (+ `layers.json`), draw-on frames to `remotion/public/drawon/<key>/NNN.png`,
and `remotion/src/manifest.json` is regenerated. Re-running gives byte-identical PNGs (verified, see below).

## How the layers are made

The skill paints onto paper; it cannot paint onto transparency. So each lake script is split into layer **groups**
(`sky, clouds, far, near, water, mist, boat, birds, reeds`), each drawing from its own seeded RNG, and finishing passes
(paper, print, lead, grain) always run. `paint.py layers` paints the scene cumulatively — sky; sky+clouds; …; everything —
at 3840×2160 **plus 10 % bleed on each side** (4608×2592). Layer *n* is the difference between paint *n* and *n−1*:

- opaque groups: alpha from the colour difference (holes closed), colour un-mixed against the known background, so soft
  edges carry no halo;
- translucent mist (watercolour, ink wash, Art Deco): colour-key matte with a smooth key colour (on paper media lightly
  blurred and lighten-only so the drifting mist carries no ghost of what was behind it);
- the boat is split at its waterline into hull and reflection (they bob in opposite directions);
- mist and clouds are made horizontally seamless inside the bleed so they can drift and wrap.

Because every layer below is itself a complete painting, moving a layer reveals painted content, never a hole.
`scripts/check_layers.py <key>` recomposites the layers at rest and reports the error against the painting
(visible frame, max per style: Stained glass 8, Linocut 9, Art Deco 40, Watercolour 46, Ink wash 110 /255 on a few
thousand mist-edge pixels; means 0.04–0.45 /255).

This is the **difference-mask route** from the brief (the skill can't paint layers separately).

## Motion (Remotion, all values from `useCurrentFrame()`)

`remotion/src/gl/scene.ts` (per-style presets) and `shaders.ts`:

- camera on one cosine cycle per 20 s loop, horizontal parallax per layer depth (no vertical, so no gaps open at the horizon);
- mist (and clouds) drift sideways, wrapped and handed over between two copies mid-loop;
- water shimmer: displacement shader on the water layer only, noise on a time circle (`cos θ, sin θ`);
- boat bobs (rotation + lift, 4 whole cycles), its reflection mirrored; birds glide across and wrap (one canvas width per loop);
- style-specific: **Stained glass** — a light band sweeps through the glass (brightens glass, never the leads); mist/clouds/birds
  stay still and parallax is tiny (leads can't slide over leads). **Ink wash** — mist only, everything else still.
  **Linocut** — the mist is a solid printed band, so it doesn't drift.
- Draw-on: the stage snapshots (45–52 numbered 3840×2160 PNGs, never GIF) are cross-faded with easing over 0–9 s, then a 9–12 s
  hold fades into the layered painting with the mist moving.

Banding: layers are accumulated in an **RGBA16F (half-float)** framebuffer; the final pass adds a fixed-formula grain (~1 %)
and a **64×64 blue-noise dither (±1/255)** (`remotion/public/bluenoise64.png`, generated by `scripts/bluenoise.py`).
Images load behind `delayRender`; no `Math.random`, `Date.now`, `useState` or `useFrame` drive visuals.

## Rendering

```bash
cd remotion && npm ci
npx remotion studio                                   # preview

# 720p previews (what renders/ contains) — scripts/render_previews.sh does all 8:
npx remotion render src/index.ts Painted-Watercolour-LakeLoop out.mp4 --frames=0-599 \
  --scale=0.3333333333333333 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted

# 4K masters (not rendered here):
npx remotion render src/index.ts Painted-Watercolour-LakeLoop Painted_Watercolour_LakeLoop.mp4 --frames=0-599 \
  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render src/index.ts Painted-Watercolour-DrawOn Painted_Watercolour_DrawOn.mp4 \
  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

- **`--gl=angle` is required** (WebGL2 + half-float render targets); it's also set in `remotion.config.ts`.
- Composition IDs use hyphens (`Painted-<Style>-LakeLoop`, `Painted-<Style>-DrawOn`) because Remotion rejects
  underscores in IDs; the output files use the requested `Painted_<Style>_LakeLoop.mp4` names.
- Loops are **601-frame** compositions (frame 600 must equal frame 0); encode `--frames=0-599` for a 20.0 s file.
- The canvas renders at the output's device-pixel size, so 4K renders draw at full 3840×2160.

## Adding a style or a scene

1. **Style:** copy a lake script (e.g. `scripts/scenes/inkwash_lake.py`) to `<key>_lake.py`, keep the contract in
   `docs/phase2_contract.md` (signature `paint(W, H, seed, colourway, bleed, include, stages_dir, dense_stages)`, the nine
   `GROUPS`, `drawkit.group_rng(seed, group)` per group, positions via `S.x/S.y/S.pts`, full-width elements across
   `S.X0..S.X1`), then add `(key, FilePrefix, loop colourway)` to `PHASE2` in `scripts/paint.py` and a `MOTION` preset in
   `remotion/src/gl/scene.ts`. Verify group independence (prefix with/without each group must not differ outside the
   group's footprint) before painting layers.
2. **Scene (still):** add `<key>_<scene>.py` for every style with `paint(W, H, seed, colourway, ...)` and add
   `('<scene>', '<Name>')` to `SCENES` (and a seed offset to `SCENE_SEED`) in `scripts/paint.py`.

## Checks (Phase 2 verify loop)

| Check | Result | Where |
|---|---|---|
| ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, 20.0 / 12.0 s | 8/8 PASS (first time) | `scripts/verify_videos.sh` |
| Loops: frame 0 vs 600 pixel-for-pixel | 5/5 PASS (Stained glass failed first time: light band never reached 0 → compact band) | `docs/loopcheck.txt` |
| Re-run paint → identical files | PASS: 271 files byte-identical | `docs/hashes_run1.txt`, `hashes_run2.txt` |
| Cold-start frame == full render frame | PASS (4 frames, byte-identical) | `docs/coldstart.txt` |
| Layers: no gaps past the bleed / seams / halos | PASS after fixes (mist matte reworked twice) | `docs/layercheck.txt` |
| Stills: 30 present, 3840×2160, named | PASS | `stills/` |
| Hand-made check (3 fresh reviewers) | not passed: linocut "mostly convincing"; others "partly"/"fake" | `docs/handmade_check_log.md` |
| Buyer check | ~2/3 of the set "would buy" | `docs/buyer_check.md` |

## Timings

See `docs/timings.md` (paint time per layer and per still, Remotion time per frame, 4K frame times and 4K estimates).

## Packaging

`scripts/make_zips.sh` builds `dist/painted-styles-project.zip` (source, scripts, layers, draw-on frames, pinned skill +
licence, requirements, package.json/lock, README — no node_modules, .git, venv or renders) and `dist/stills.zip`.
