# Verify loop results (final renders)

Banding is measured on the encoded Y plane (see scripts/verify/banding-check.mjs).
Control: comp 1 frame 300 with grain/dither blurred away, re-encoded, fails 4/4
regions (max run 20–40 px, mean run 2.3–3.3 px) — the test discriminates.

## ChipGrid_ShieldSweepTop  (attempt 3 — consistency re-render on the final pipeline)
- Step 1 ffprobe: h264, 1920x1080, yuv420p, 30/1, 15.000000 s, 450 frames, no audio stream — PASS
- Step 2 determinism: frame 300 cold still == frame 300 of full render, byte-identical (sha256 45f2cfa5eb8f138d…) — PASS
- Step 3 spread: logic check PASS (causality, fronts, diamond r=0.999, end state); 1-in-10 sheet: red -> blue square-on-screen (diamond at 45°) from the centre, fronts travel along cables, all visible blue by ~frame 210 — PASS
- Step 4 banding (frame 300 of the mp4, Y plane): 4/4 regions PASS (codes filled 100 %, max run 4–7 px, mean run 1.12–1.17 px)
- Step 5 content: top-down at 45°, red -> blue, shields on node tops, grid edge to edge, no text — PASS
- Flicker: 2 events flagged (frames 199, 229), both inspected: intended node-switch flash + shield glint, not artifacts

## ChipGrid_AttackPullback  (attempt 2; attempt 1 failed the flicker check: MSAA sparkles, double-sided glass pops, half-res DOF edge shimmer)
- Step 1 ffprobe: h264, 1920x1080, yuv420p, 30/1, 15.000000 s, 450 frames, no audio stream — PASS
- Step 2 determinism: frame 300 byte-identical (sha256 13f76ac0641343e9…) — PASS
- Step 3 spread: logic check PASS (causality, fronts incl. 166 two-ended tangential links, circle r=0.999, 100 % of visible nodes red at end, source at frame-0 centre); 1-in-10 sheet: red circle from the camera's node from frame 60, growing with the pull-back — PASS
- Step 4 banding (frame 300 of the mp4, Y plane): 4/4 regions PASS (codes filled 100 %, max run 5–10 px, mean run 1.18–1.26 px)
- Step 5 content: opens close/low (35°) on one node, pulls back/up/rotates, ends top-down grid-aligned, red grows outward with the view — PASS
- Flicker: 0 with the motion-tolerant detector (±30 px). The same-block-only version flagged 164 events, all at moving edges during the pull-back; at ±10 px 12 marginal (+41–45) remain, inspected: moving cable highlights / core pulses. Detector still catches an injected one-frame dot inside this fast-moving stretch.

## ChipGrid_AttackSpread  (attempt 1 on the final pipeline)
- Step 1 ffprobe: h264, 1920x1080, yuv420p, 30/1, 15.000000 s, 450 frames, no audio stream — PASS
- Step 2 determinism: frame 300 byte-identical (sha256 95f40b84824eaf5d…) — PASS
- Step 3 spread: logic check PASS (causality, fronts, diamond r=1.000 from source (6,14) projecting off-frame at NDC (-2.0,-1.3), all 45 visible nodes red by frame 263); 1-in-10 sheet: red enters at the near-left edge ~frame 70 and crosses diagonally to the far right — PASS
- Step 4 banding (frame 300 of the mp4, Y plane): 4/4 smooth regions PASS (codes filled 100 %, max run 5–7 px, mean run 1.15–1.19 px). One first-pick region (800,580) reads 83 % codes filled: it straddles a dark tile seam and the tile (all tile codes present); runs 7 px / 1.18 px. Seam edge, not banding — inspected; kept in the log.
- Step 5 content: ~40° oblique, grid at 45°, slow sideways track, red enters from an edge and crosses the frame — PASS
- Flicker: 0 one-frame pops (±30 px motion tolerance)

## ChipGrid_ShieldRecovery  (attempt 1 on the final pipeline)
- Step 1 ffprobe: h264, 1920x1080, yuv420p, 30/1, 15.000000 s, 450 frames, no audio stream — PASS
- Step 2 determinism: frame 300 byte-identical (sha256 b5de09b9db4307bd…) — PASS
- Step 3 spread: logic check PASS (causality, fronts incl. 169 two-ended tangential links, circle r=0.999, all 57 visible nodes blue by frame 261, source at frame-0 centre); 1-in-10 sheet: blue spreads from the centre from ~frame 30, shields pop up as nodes turn, all visible blue with shields from ~frame 260 — PASS
- Step 4 banding (frame 300 of the mp4, Y plane): 4/4 regions PASS (codes filled 97–100 %, max run 4–7 px, mean run 1.14–1.20 px)
- Step 5 content: ~35° angled, close (4–5 nodes across) pulling back, floating camera-facing shields above blue nodes, readable — PASS
- Flicker: 0 one-frame pops (±30 px motion tolerance)
